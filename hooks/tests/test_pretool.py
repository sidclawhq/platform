"""Tests for the PreToolUse hook — the core governance gate."""

import io
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest


HOOKS_DIR = Path(__file__).resolve().parent.parent
PRETOOL = HOOKS_DIR / "sidclaw_pretool.py"


def _run_hook(payload: dict, env: dict, script: Path = PRETOOL):
    proc = subprocess.run(
        [sys.executable, str(script)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env={**os.environ, **env},
    )
    return proc.returncode, proc.stdout, proc.stderr


def test_ungoverned_tool_passes_through():
    # Read is not governed — the hook must exit 0 without calling SidClaw.
    code, stdout, stderr = _run_hook(
        {"tool_name": "Read", "tool_input": {"file_path": "README.md"}},
        env={
            "SIDCLAW_BASE_URL": "",
            "SIDCLAW_API_KEY": "",
            "SIDCLAW_FAIL_OPEN": "false",
        },
    )
    assert code == 0


def test_sidclaw_missing_env_fails_closed_for_governed_tool():
    code, _, stderr = _run_hook(
        {"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}},
        env={
            "SIDCLAW_BASE_URL": "",
            "SIDCLAW_API_KEY": "",
            "SIDCLAW_FAIL_OPEN": "false",
        },
    )
    assert code == 2
    assert "SidClaw" in stderr


def test_sidclaw_missing_env_fails_open_when_opted_in():
    code, _, _ = _run_hook(
        {"tool_name": "Bash", "tool_input": {"command": "ls"}},
        env={
            "SIDCLAW_BASE_URL": "",
            "SIDCLAW_API_KEY": "",
            "SIDCLAW_FAIL_OPEN": "true",
        },
    )
    assert code == 0


def test_observe_mode_never_blocks():
    code, _, _ = _run_hook(
        {"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}},
        env={
            "SIDCLAW_BASE_URL": "",
            "SIDCLAW_API_KEY": "",
            "SIDCLAW_HOOK_MODE": "observe",
        },
    )
    assert code == 0


def test_empty_stdin_is_noop():
    proc = subprocess.run(
        [sys.executable, str(PRETOOL)],
        input="",
        capture_output=True,
        text=True,
        env={**os.environ, "SIDCLAW_BASE_URL": "", "SIDCLAW_API_KEY": ""},
    )
    assert proc.returncode == 0
