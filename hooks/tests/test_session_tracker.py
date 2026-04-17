import os
import tempfile

import pytest

from sidclaw_agent_intel import session_tracker


@pytest.fixture(autouse=True)
def _isolated_state_dir(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        monkeypatch.setenv("SIDCLAW_STATE_DIR", tmp)
        yield tmp


def test_remember_and_pop_roundtrip():
    session_tracker.remember_pending("sess-1", "tool-1", "trace-abc")
    assert session_tracker.pop_pending("sess-1", "tool-1") == "trace-abc"
    assert session_tracker.pop_pending("sess-1", "tool-1") is None


def test_all_pending_returns_tracked_trace_ids():
    session_tracker.remember_pending("sess-2", "t1", "tr-1")
    session_tracker.remember_pending("sess-2", "t2", "tr-2")
    ids = session_tracker.all_pending("sess-2")
    assert sorted(ids) == ["tr-1", "tr-2"]


def test_unknown_session_returns_empty_state():
    state = session_tracker.load_session("never-existed")
    assert state.pending == {}


def test_clear_session_removes_state():
    session_tracker.remember_pending("sess-3", "t1", "tr-3")
    session_tracker.clear_session("sess-3")
    assert session_tracker.all_pending("sess-3") == []
