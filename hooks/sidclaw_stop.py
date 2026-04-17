#!/usr/bin/env python3
"""SidClaw Stop hook — attribute token usage to governance traces.

Runs when a Claude Code turn completes. Parses the session transcript to
recover token usage and distributes it across any pending trace records.

Idempotent — safe to run multiple times. Always exits 0.

License: MIT
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sidclaw_agent_intel.session_tracker import (
    all_pending,
    compute_token_delta,
    update_session,
)
from sidclaw_agent_intel.sidclaw_client import SidClawError, record_telemetry, record_outcome


# Model pricing per 1M tokens (kept minimal; users can override via env)
_DEFAULT_PRICING = {
    "claude-opus-4-7": {"input": 15.0, "output": 75.0, "cache_read": 1.5},
    "claude-opus-4-6": {"input": 15.0, "output": 75.0, "cache_read": 1.5},
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0, "cache_read": 0.3},
    "claude-sonnet-4-5": {"input": 3.0, "output": 15.0, "cache_read": 0.3},
    "claude-haiku-4-5": {"input": 0.8, "output": 4.0, "cache_read": 0.08},
    "gpt-4o": {"input": 2.5, "output": 10.0, "cache_read": 1.25},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6, "cache_read": 0.075},
}


def _log(msg: str) -> None:
    if os.environ.get("SIDCLAW_HOOK_DEBUG"):
        print(f"[sidclaw] {msg}", file=sys.stderr)


def _load_pricing() -> dict:
    override = os.environ.get("SIDCLAW_MODEL_PRICING")
    if override:
        try:
            return {**_DEFAULT_PRICING, **json.loads(override)}
        except json.JSONDecodeError:
            _log("failed to parse SIDCLAW_MODEL_PRICING override")
    return _DEFAULT_PRICING


def _estimate_cost(model: str, tokens_in: int, tokens_out: int, tokens_cache_read: int) -> float:
    pricing = _load_pricing()
    prices = pricing.get(model) or pricing.get(model.replace("-", "").lower())
    if not prices:
        return 0.0
    return (
        tokens_in * prices.get("input", 0.0)
        + tokens_out * prices.get("output", 0.0)
        + tokens_cache_read * prices.get("cache_read", 0.0)
    ) / 1_000_000.0


def _parse_transcript(transcript_path: str) -> dict:
    """Sum token usage across all assistant messages in the transcript."""
    totals = {"tokens_in": 0, "tokens_out": 0, "tokens_cache_read": 0, "model": ""}
    path = Path(transcript_path).expanduser()
    if not path.exists():
        return totals

    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            message = event.get("message") if isinstance(event, dict) else None
            if not isinstance(message, dict):
                message = event
            usage = message.get("usage") if isinstance(message, dict) else None
            if not isinstance(usage, dict):
                continue
            totals["tokens_in"] += int(usage.get("input_tokens", 0) or 0)
            totals["tokens_out"] += int(usage.get("output_tokens", 0) or 0)
            totals["tokens_cache_read"] += int(usage.get("cache_read_input_tokens", 0) or 0)
            model = message.get("model") or event.get("model")
            if isinstance(model, str) and model:
                totals["model"] = model
    except OSError as e:
        _log(f"failed to read transcript: {e}")

    return totals


def main() -> int:
    try:
        raw = sys.stdin.read().strip()
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}

    session_id = data.get("session_id", "default")
    transcript_path = data.get("transcript_path", "")
    stop_hook_active = bool(data.get("stop_hook_active"))
    if stop_hook_active:
        # Hook chained from another Stop hook — avoid re-attribution loops
        return 0

    pending = all_pending(session_id)
    if not pending:
        _log("no pending traces — nothing to attribute")
        return 0

    totals = _parse_transcript(transcript_path) if transcript_path else {}
    total_in = int(totals.get("tokens_in", 0) or 0)
    total_out = int(totals.get("tokens_out", 0) or 0)
    total_cache = int(totals.get("tokens_cache_read", 0) or 0)
    model = totals.get("model") or ""

    # Compute delta since the last submitted mark — fixes the Stop-hook
    # cumulative drift bug where turn-N traces would be credited with tokens
    # from turns 1..N-1. The session_tracker stores the high-water mark and
    # returns only the new tokens since last call.
    delta_in, delta_out, delta_cache = compute_token_delta(
        session_id, total_in, total_out, total_cache
    )

    count = len(pending)
    if count == 0:
        return 0

    # Distribute the DELTA across traces in this turn. Server-side PATCH is
    # additive, so values accumulate across turns naturally.
    per_in = delta_in // count
    per_out = delta_out // count
    per_cache = delta_cache // count
    cost = _estimate_cost(model, per_in, per_out, per_cache) if model else 0.0

    telemetry: dict = {}
    if per_in:
        telemetry["tokens_in"] = per_in
    if per_out:
        telemetry["tokens_out"] = per_out
    if per_cache:
        telemetry["tokens_cache_read"] = per_cache
    if model:
        telemetry["model"] = model
    if cost > 0:
        telemetry["cost_estimate"] = round(cost, 8)

    # First: close any traces that PostToolUse never recorded (crash recovery).
    # For the crash-recovery case we SEND the per-trace share on the outcome
    # (it's a first write, not an increment — server's POST path SETs fields).
    #
    # This MUST run under the session-file lock to avoid racing with a
    # PostToolUse that's concurrently draining the same entry. Before the
    # fix, the Stop hook's lock-free read-then-write could revive a tool_use
    # entry that PostToolUse had just popped.
    def _drain(state) -> None:
        for tool_use_id, trace_id in list(state.pending.items()):
            body = {"status": "success"}
            body.update(telemetry)
            try:
                record_outcome(trace_id, body)
                state.pending.pop(tool_use_id, None)
            except SidClawError as e:
                _log(f"failed to finalize trace {trace_id}: {e}")

    update_session(session_id, _drain)

    # Second: attribute the delta to every trace from this turn via the
    # additive PATCH /telemetry endpoint.
    if telemetry:
        for trace_id in pending:
            try:
                record_telemetry(trace_id, telemetry)
            except SidClawError as e:
                _log(f"failed to record telemetry for {trace_id}: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
