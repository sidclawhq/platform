"""LangChain callback handler for SidClaw governance logging.

This handler creates audit traces for every tool call without blocking execution.
Use it for monitoring/auditing before you're ready to enforce policies.

For enforcement (block/approve/deny), use govern_tools() instead.
"""
from __future__ import annotations

from typing import Any

from langchain_core.callbacks import BaseCallbackHandler
from sidclaw import SidClaw


class GovernanceCallbackHandler(BaseCallbackHandler):
    """Callback handler that logs all tool calls to SidClaw as audit traces.

    This is a non-blocking, observe-only integration. Every tool call
    is recorded as a trace in SidClaw, but execution is never blocked.

    For policy enforcement (allow/deny/approval_required), use
    govern_tools() or govern_tool() instead.

    Args:
        client: SidClaw client instance.
        data_classification: Default classification for all tools.
    """

    def __init__(
        self,
        client: SidClaw,
        data_classification: str = "internal",
    ) -> None:
        self.client = client
        self.data_classification = data_classification
        self._active_traces: dict[str, str] = {}  # run_id -> trace_id

    def on_tool_start(
        self,
        serialized: dict[str, Any],
        input_str: str,
        *,
        run_id: Any,
        parent_run_id: Any = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when a tool starts. Creates a governance trace."""
        tool_name = serialized.get("name", "unknown_tool")
        try:
            result = self.client.evaluate({
                "operation": tool_name,
                "target_integration": tool_name,
                "resource_scope": "*",
                "data_classification": self.data_classification,
                "context": {
                    "input": input_str[:500],
                    "tags": tags or [],
                    "mode": "observe",
                },
            })
            self._active_traces[str(run_id)] = result.trace_id
        except Exception:
            pass  # Never block on logging failures

    def on_tool_end(
        self,
        output: str,
        *,
        run_id: Any,
        parent_run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        """Called when a tool completes. Records the outcome."""
        trace_id = self._active_traces.pop(str(run_id), None)
        if trace_id:
            try:
                self.client.record_outcome(trace_id, {"status": "success"})
            except Exception:
                pass

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: Any,
        parent_run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        """Called when a tool errors. Records the failure."""
        trace_id = self._active_traces.pop(str(run_id), None)
        if trace_id:
            try:
                self.client.record_outcome(
                    trace_id, {"status": "error", "metadata": {"error": str(error)[:500]}}
                )
            except Exception:
                pass
