#!/usr/bin/env python3
"""SidClaw PreToolUse hook — governance gate for Claude Code tool calls.

Reads the tool call JSON from stdin, classifies it, calls SidClaw's policy
engine, and either allows, denies (exit 2), or waits for human approval.

Environment:
    SIDCLAW_BASE_URL          — SidClaw instance URL (required)
    SIDCLAW_API_KEY           — API key (required)
    SIDCLAW_AGENT_ID          — Agent identity (default: "claude-code")
    SIDCLAW_HOOK_MODE         — "enforce" (default) or "observe"
    SIDCLAW_GUARD_TIMEOUT     — HTTP timeout in seconds (default: 2.5)
    SIDCLAW_APPROVAL_TIMEOUT  — Max wait for approval in seconds (default: 300)
    SIDCLAW_GOVERNED_CATEGORIES — Comma-separated list or "all"
                                  (default: "execution,file_io,orchestration,mcp")
    SIDCLAW_FAIL_OPEN         — "true" to allow on SidClaw errors (default: "false")

Exit codes:
    0 — allow (tool call proceeds)
    2 — deny (tool call is blocked; stderr shown to user)

License: MIT
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Make the sibling intel package importable when running as a script
sys.path.insert(0, str(Path(__file__).parent))

from sidclaw_agent_intel.bash_classifier import classify_bash
from sidclaw_agent_intel.file_scanner import scan_file_operation
from sidclaw_agent_intel.mcp_monitor import check_mcp_health
from sidclaw_agent_intel.session_tracker import remember_pending
from sidclaw_agent_intel.sidclaw_client import (
    SidClawAuthError,
    SidClawError,
    evaluate,
    poll_approval,
)
from sidclaw_agent_intel.tool_recognizer import classify_tool


# Maps tool category → data classification baseline
_CATEGORY_TO_CLASSIFICATION = {
    "execution": "confidential",
    "file_io": "internal",
    "orchestration": "confidential",
    "mcp": "internal",
    "interactive": "internal",
    "unknown": "internal",
}


def _log(msg: str) -> None:
    """Write diagnostics to stderr — Claude Code captures it for user display."""
    if os.environ.get("SIDCLAW_HOOK_DEBUG"):
        print(f"[sidclaw] {msg}", file=sys.stderr)


def _governed_categories() -> set[str]:
    raw = os.environ.get("SIDCLAW_GOVERNED_CATEGORIES", "execution,file_io,orchestration,mcp")
    if raw.strip().lower() == "all":
        return {"execution", "file_io", "orchestration", "mcp", "interactive", "unknown", "search", "system"}
    return {c.strip() for c in raw.split(",") if c.strip()}


def _observe_mode() -> bool:
    return os.environ.get("SIDCLAW_HOOK_MODE", "enforce").lower() == "observe"


def _fail_open() -> bool:
    return os.environ.get("SIDCLAW_FAIL_OPEN", "false").lower() == "true"


def _fail_open_on_rate_limit() -> bool:
    """Separate opt-in for 429 fail-open. Disabled by default because 429
    usually means the tenant is legitimately over-quota — silently skipping
    governance would hide real problems. Operators with spiky workloads can
    opt in."""
    return os.environ.get("SIDCLAW_FAIL_OPEN_ON_RATE_LIMIT", "false").lower() == "true"


def _agent_id() -> str:
    return os.environ.get("SIDCLAW_AGENT_ID", "claude-code")


def _approval_timeout() -> int:
    try:
        return int(os.environ.get("SIDCLAW_APPROVAL_TIMEOUT", "300"))
    except ValueError:
        return 300


def _build_payload(tool_name: str, tool_input: dict) -> tuple[dict, int]:
    """Return (evaluate_payload, risk_score) for a classified tool call."""
    classification = classify_tool(tool_name)
    risk = classification.base_risk
    metadata: dict = {
        "tool_name": tool_name,
        "category": classification.category,
        "permission_level": classification.permission_level,
    }

    operation = f"{classification.category}.{tool_name.lower()}"
    target_integration = "claude_code"
    resource_scope = tool_name.lower()
    data_classification = _CATEGORY_TO_CLASSIFICATION.get(classification.category, "internal")

    if tool_name == "Bash":
        command = str(tool_input.get("command", ""))
        bash = classify_bash(command)
        risk += bash.risk_boost
        metadata["bash"] = bash.to_metadata()
        operation = f"bash.{bash.intent}"
        resource_scope = _truncate(command, 180)
        if bash.sensitive_paths or "credential" in bash.intent or not bash.reversible:
            data_classification = "restricted"
        elif bash.intent in ("destructive", "deployment"):
            data_classification = "confidential"

    elif classification.category == "file_io":
        path = (
            tool_input.get("file_path")
            or tool_input.get("path")
            or tool_input.get("notebook_path")
            or ""
        )
        workspace = os.environ.get("SIDCLAW_WORKSPACE") or os.getcwd()
        scan = scan_file_operation(str(path), workspace=workspace)
        risk += scan.risk_boost
        metadata["file"] = scan.to_metadata()
        resource_scope = _truncate(str(path) or tool_name.lower(), 180)
        if scan.sensitive_file:
            data_classification = "restricted"
        elif scan.outside_workspace or scan.traversal:
            data_classification = "confidential"

    elif classification.category == "mcp":
        health = check_mcp_health(tool_name)
        risk += health.risk_boost
        metadata["mcp"] = health.to_metadata()
        resource_scope = tool_name

    elif classification.category == "orchestration":
        # Surface the dispatched command / subagent so approvers know what's running
        summary = (
            tool_input.get("description")
            or tool_input.get("subject")
            or tool_input.get("prompt")
            or tool_input.get("task")
            or ""
        )
        resource_scope = _truncate(str(summary) or tool_name.lower(), 180)

    risk = max(0, min(100, risk))
    metadata["risk_score"] = risk

    payload = {
        "agent_id": _agent_id(),
        "operation": operation,
        "target_integration": target_integration,
        "resource_scope": resource_scope,
        "data_classification": data_classification,
        "context": {
            "tool_name": tool_name,
            "tool_input_summary": _summarize_input(tool_name, tool_input),
            "classification": metadata,
        },
    }
    return payload, risk


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def _summarize_input(tool_name: str, tool_input: dict) -> dict:
    """Safe-to-ship summary of the tool input (truncates long values)."""
    safe: dict = {}
    for key, value in tool_input.items():
        if isinstance(value, str):
            safe[key] = _truncate(value, 800)
        elif isinstance(value, (int, float, bool)):
            safe[key] = value
        elif value is None:
            safe[key] = None
        else:
            try:
                serialized = json.dumps(value)
            except (TypeError, ValueError):
                serialized = str(value)
            safe[key] = _truncate(serialized, 800)
    return safe


def _parse_stdin() -> dict:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        _log(f"failed to parse stdin JSON: {e}")
        return {}


def main() -> int:
    payload_in = _parse_stdin()
    tool_name = payload_in.get("tool_name", "")
    tool_input = payload_in.get("tool_input") or {}
    tool_use_id = payload_in.get("tool_use_id", "")
    session_id = payload_in.get("session_id", "default")

    if not tool_name:
        # Nothing to govern
        return 0

    classification = classify_tool(tool_name)
    if not classification.governed:
        _log(f"skip ungoverned tool {tool_name}")
        return 0

    governed_categories = _governed_categories()
    if classification.category not in governed_categories:
        _log(f"skip tool {tool_name} (category {classification.category} not governed)")
        return 0

    eval_payload, risk = _build_payload(tool_name, tool_input)
    _log(f"evaluating {tool_name} risk={risk}")

    try:
        result = evaluate(eval_payload)
    except SidClawAuthError as e:
        # Auth failures are NEVER fail-open — a revoked key should not
        # silently bypass governance. This is the fix for the footgun where
        # SIDCLAW_FAIL_OPEN could mask a 401/403.
        _log(f"auth error: {e}")
        print(f"SidClaw auth failed ({e}). Check SIDCLAW_API_KEY.", file=sys.stderr)
        return 2
    except SidClawError as e:
        _log(f"evaluate error ({e.kind}): {e}")
        if _observe_mode():
            return 0
        # Transport / server errors are fail-open-eligible; rate_limit is
        # a separate opt-in (see SIDCLAW_FAIL_OPEN_ON_RATE_LIMIT); client
        # errors are deterministic and surface.
        if _fail_open() and e.kind in ("transport", "server"):
            return 0
        if e.kind == "rate_limit" and _fail_open_on_rate_limit():
            return 0
        print(f"SidClaw governance unavailable: {e}", file=sys.stderr)
        return 2

    if result.trace_id and tool_use_id:
        remember_pending(session_id, tool_use_id, result.trace_id)

    decision = result.decision
    reason = result.reason or "no reason provided"

    if _observe_mode():
        _log(f"observe mode — decision {decision} not enforced")
        return 0

    if decision == "allow" or decision == "log":
        return 0

    if decision == "deny":
        print(f"SidClaw denied this action: {reason}", file=sys.stderr)
        return 2

    if decision == "flag" and result.approval_id:
        approval_url = _build_approval_url(result.approval_id)
        print(
            f"SidClaw flagged this action for human approval: {reason}",
            file=sys.stderr,
        )
        print(f"Approve or deny at: {approval_url}", file=sys.stderr)
        status = poll_approval(result.approval_id, _approval_timeout())
        if status == "approved":
            _log(f"approval {result.approval_id} approved")
            return 0
        if status == "denied":
            print("SidClaw: approval was denied.", file=sys.stderr)
            return 2
        print(f"SidClaw: approval {status} — blocking action.", file=sys.stderr)
        return 2

    # Unknown decision — fail closed unless fail_open set
    _log(f"unknown decision: {decision}")
    if _fail_open():
        return 0
    print(f"SidClaw returned unexpected decision '{decision}' — blocking.", file=sys.stderr)
    return 2


def _build_approval_url(approval_id: str) -> str:
    dashboard = os.environ.get("SIDCLAW_DASHBOARD_URL", "").rstrip("/")
    if not dashboard:
        base = os.environ.get("SIDCLAW_BASE_URL", "").rstrip("/")
        if base.startswith("https://api."):
            dashboard = base.replace("https://api.", "https://app.", 1)
        elif base.startswith("http://api."):
            dashboard = base.replace("http://api.", "http://app.", 1)
        else:
            dashboard = base
    return f"{dashboard}/dashboard/approvals/{approval_id}"


if __name__ == "__main__":
    sys.exit(main())
