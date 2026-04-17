"""Lightweight health snapshot for MCP server tool calls."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

from .session_tracker import _atomic_write, _locked  # reuse locking helpers


@dataclass
class McpHealth:
    server: str
    healthy: bool
    risk_boost: int
    reason: str = ""

    def to_metadata(self) -> dict:
        return {
            "server": self.server,
            "healthy": self.healthy,
            "reason": self.reason,
        }


def _health_file() -> Path:
    base = Path(os.environ.get("SIDCLAW_STATE_DIR", str(Path.home() / ".sidclaw")))
    base.mkdir(parents=True, exist_ok=True)
    return base / "mcp_health.json"


def _load_state() -> dict:
    try:
        path = _health_file()
        if not path.exists():
            return {}
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def record_tool_outcome(tool_name: str, success: bool) -> None:
    """Call from PostToolUse to track MCP tool reliability.

    Stores a rolling last-outcome + failure streak per server name.
    Uses file locking + atomic replace so concurrent tool calls don't
    corrupt the JSON or lose counter updates.
    """
    if not tool_name.startswith("mcp__"):
        return

    server = tool_name.split("__")[1] if "__" in tool_name[5:] else tool_name
    path = _health_file()

    with _locked(path):
        state = _load_state()
        entry = state.get(server, {"failures": 0, "last_outcome": None})
        if success:
            entry["failures"] = 0
        else:
            entry["failures"] = entry.get("failures", 0) + 1
        entry["last_outcome"] = "success" if success else "failure"
        entry["last_update"] = time.time()
        state[server] = entry
        try:
            _atomic_write(path, json.dumps(state))
        except OSError:
            pass  # State recording is best-effort


def check_mcp_health(tool_name: str) -> McpHealth:
    """Return the rolling health for the MCP server hosting `tool_name`."""
    if not tool_name.startswith("mcp__"):
        return McpHealth(server="", healthy=True, risk_boost=0)

    # mcp tool names are `mcp__<server>__<method>` — server is segment 1
    parts = tool_name.split("__")
    server = parts[1] if len(parts) > 1 else tool_name

    state = _load_state()
    entry = state.get(server)
    if not entry:
        return McpHealth(server=server, healthy=True, risk_boost=0, reason="no_prior_data")

    failures = int(entry.get("failures", 0))
    if failures >= 3:
        return McpHealth(
            server=server,
            healthy=False,
            risk_boost=15,
            reason=f"{failures}_recent_failures",
        )
    if failures >= 1:
        return McpHealth(
            server=server,
            healthy=True,
            risk_boost=5,
            reason=f"{failures}_recent_failure",
        )
    return McpHealth(server=server, healthy=True, risk_boost=0)
