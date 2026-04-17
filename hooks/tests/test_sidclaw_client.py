"""Tests for the minimal SidClaw HTTP client."""

import json
import os
from unittest.mock import patch, MagicMock

import pytest

from sidclaw_agent_intel import sidclaw_client
from sidclaw_agent_intel.sidclaw_client import SidClawError, evaluate


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("SIDCLAW_BASE_URL", "https://api.example.com")
    monkeypatch.setenv("SIDCLAW_API_KEY", "ai_test_key")
    monkeypatch.setenv("SIDCLAW_GUARD_TIMEOUT", "1.0")


def test_missing_base_url_raises(monkeypatch):
    monkeypatch.delenv("SIDCLAW_BASE_URL", raising=False)
    with pytest.raises(SidClawError, match="BASE_URL"):
        evaluate({"agent_id": "x"})


def test_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("SIDCLAW_API_KEY", raising=False)
    with pytest.raises(SidClawError, match="API_KEY"):
        evaluate({"agent_id": "x"})


def _mock_response(payload: dict):
    resp = MagicMock()
    resp.read.return_value = json.dumps(payload).encode()
    resp.__enter__.return_value = resp
    resp.__exit__.return_value = False
    return resp


def test_evaluate_parses_allow_decision():
    resp = _mock_response({
        "decision": "allow",
        "trace_id": "trace-1",
        "approval_request_id": None,
        "reason": "policy allows",
    })
    with patch("urllib.request.urlopen", return_value=resp):
        result = evaluate({"agent_id": "x"})
    assert result.decision == "allow"
    assert result.trace_id == "trace-1"
    assert result.approval_id is None


def test_evaluate_normalizes_approval_required_to_flag():
    resp = _mock_response({
        "decision": "approval_required",
        "trace_id": "t",
        "approval_request_id": "a",
        "reason": "needs review",
    })
    with patch("urllib.request.urlopen", return_value=resp):
        result = evaluate({"agent_id": "x"})
    assert result.decision == "flag"
    assert result.approval_id == "a"


def test_evaluate_normalizes_blocked_to_deny():
    resp = _mock_response({
        "decision": "deny",
        "trace_id": "t",
        "approval_request_id": None,
        "reason": "forbidden",
    })
    with patch("urllib.request.urlopen", return_value=resp):
        result = evaluate({"agent_id": "x"})
    assert result.decision == "deny"
