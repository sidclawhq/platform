"""Tests for GovernanceCallbackHandler."""
from unittest.mock import MagicMock, patch
from uuid import uuid4

from langchain_sidclaw import GovernanceCallbackHandler


class TestGovernanceCallbackHandler:
    def _make_handler(self):
        client = MagicMock()
        client.evaluate.return_value = MagicMock(trace_id="trace-123")
        return GovernanceCallbackHandler(client=client), client

    def test_on_tool_start_creates_trace(self):
        handler, client = self._make_handler()
        handler.on_tool_start(
            {"name": "search"},
            "query text",
            run_id=uuid4(),
        )
        client.evaluate.assert_called_once()
        call_args = client.evaluate.call_args[0][0]
        assert call_args["operation"] == "search"
        assert call_args["context"]["mode"] == "observe"

    def test_on_tool_end_records_success(self):
        handler, client = self._make_handler()
        run_id = uuid4()
        handler.on_tool_start({"name": "search"}, "query", run_id=run_id)
        handler.on_tool_end("result", run_id=run_id)
        client.record_outcome.assert_called_once_with("trace-123", {"status": "success"})

    def test_on_tool_error_records_failure(self):
        handler, client = self._make_handler()
        run_id = uuid4()
        handler.on_tool_start({"name": "search"}, "query", run_id=run_id)
        handler.on_tool_error(ValueError("boom"), run_id=run_id)
        client.record_outcome.assert_called_once()
        args = client.record_outcome.call_args[0]
        assert args[0] == "trace-123"
        assert args[1]["status"] == "error"
        assert "boom" in args[1]["metadata"]["error"]

    def test_never_blocks_on_evaluate_failure(self):
        handler, client = self._make_handler()
        client.evaluate.side_effect = Exception("API down")
        # Should not raise
        handler.on_tool_start({"name": "search"}, "query", run_id=uuid4())

    def test_never_blocks_on_record_failure(self):
        handler, client = self._make_handler()
        client.record_outcome.side_effect = Exception("API down")
        run_id = uuid4()
        handler.on_tool_start({"name": "search"}, "query", run_id=run_id)
        # Should not raise
        handler.on_tool_end("result", run_id=run_id)

    def test_truncates_long_input(self):
        handler, client = self._make_handler()
        long_input = "x" * 1000
        handler.on_tool_start({"name": "search"}, long_input, run_id=uuid4())
        call_args = client.evaluate.call_args[0][0]
        assert len(call_args["context"]["input"]) == 500
