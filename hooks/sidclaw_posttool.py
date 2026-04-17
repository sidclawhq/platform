#!/usr/bin/env python3
"""SidClaw PostToolUse hook — record outcome + error classification.

Runs AFTER every governed tool call. Looks up the trace_id remembered by the
PreToolUse hook, classifies the outcome, and updates the trace on SidClaw.

Exit code is always 0 — we never want to retroactively block a tool call
that has already happened. Failures are logged to stderr for debugging.

License: MIT
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sidclaw_agent_intel.mcp_monitor import record_tool_outcome
from sidclaw_agent_intel.session_tracker import pop_pending
from sidclaw_agent_intel.sidclaw_client import SidClawError, record_outcome


def _log(msg: str) -> None:
    if os.environ.get("SIDCLAW_HOOK_DEBUG"):
        print(f"[sidclaw] {msg}", file=sys.stderr)


def _classify_error(tool_response: dict) -> tuple[str | None, int | None]:
    """Extract (error_classification, exit_code) from a tool response payload."""
    if not isinstance(tool_response, dict):
        return None, None

    exit_code = tool_response.get("exit_code") or tool_response.get("code")
    if isinstance(exit_code, bool):
        exit_code = None
    try:
        exit_code = int(exit_code) if exit_code is not None else None
    except (TypeError, ValueError):
        exit_code = None

    error_text = (
        str(tool_response.get("error", ""))
        + " "
        + str(tool_response.get("stderr", ""))
        + " "
        + str(tool_response.get("message", ""))
    ).lower()

    classification: str | None = None
    if exit_code == 124 or "timed out" in error_text or "timeout" in error_text:
        classification = "timeout"
    elif "permission denied" in error_text or "eacces" in error_text or exit_code == 126:
        classification = "permission"
    elif "command not found" in error_text or "no such file" in error_text or exit_code == 127:
        classification = "not_found"
    elif exit_code is not None and exit_code != 0:
        classification = "runtime"
    elif tool_response.get("error") or tool_response.get("is_error"):
        classification = "runtime"

    return classification, exit_code


def _summarize_output(tool_response: dict) -> str | None:
    if not isinstance(tool_response, dict):
        return None
    for key in ("output", "stdout", "content", "result", "text"):
        value = tool_response.get(key)
        if isinstance(value, str) and value:
            snippet = value.strip()
            if len(snippet) > 500:
                snippet = snippet[:499] + "…"
            return snippet
        if isinstance(value, list) and value:
            joined = " ".join(
                item.get("text", "") if isinstance(item, dict) else str(item)
                for item in value
            ).strip()
            if joined:
                if len(joined) > 500:
                    joined = joined[:499] + "…"
                return joined
    return None


def main() -> int:
    try:
        raw = sys.stdin.read().strip()
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError as e:
        _log(f"failed to parse stdin: {e}")
        return 0

    tool_name = data.get("tool_name", "")
    tool_use_id = data.get("tool_use_id", "")
    session_id = data.get("session_id", "default")
    tool_response = data.get("tool_response") or data.get("output") or {}

    trace_id = pop_pending(session_id, tool_use_id)
    if not trace_id:
        _log(f"no pending trace for tool_use_id={tool_use_id}")
        return 0

    error_classification, exit_code = _classify_error(tool_response)
    success = error_classification is None

    # Record MCP reliability outcome for health tracking (risk boosting in PreToolUse)
    record_tool_outcome(tool_name, success)

    summary = _summarize_output(tool_response)
    body: dict = {
        "status": "success" if success else "error",
    }
    if summary:
        body["outcome_summary"] = summary
    if error_classification:
        body["error_classification"] = error_classification
    if exit_code is not None:
        body["exit_code"] = exit_code

    try:
        record_outcome(trace_id, body)
        _log(f"recorded outcome for trace {trace_id}: success={success}")
    except SidClawError as e:
        _log(f"failed to record outcome for {trace_id}: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
