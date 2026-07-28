"""The gate must block when it cannot do its job.

PreToolUse treats exit 2 as "deny" and every other exit code as non-blocking.
So anything that makes the hook exit 0 or 1 — a crash, a misconfiguration, an
unreadable payload, or simply never being invoked — is a silent permit. These
tests cover each of those paths.

The matcher test is the important one: the hook's own filters are correct, but
they only run if Claude Code invokes the hook at all, and that is decided by the
regex in settings.json. That regex covered 10 tools while the classifier claimed
to govern 17 — including CronDelete and TeamDelete, whose Create counterparts
were both covered.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

HOOKS_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = HOOKS_DIR.parent
PRETOOL = HOOKS_DIR / "sidclaw_pretool.py"

sys.path.insert(0, str(HOOKS_DIR))
from sidclaw_agent_intel.tool_recognizer import classify_tool  # noqa: E402

_CLEAN_ENV = {k: v for k, v in os.environ.items() if not k.startswith("SIDCLAW_")}

# Every config that ships a matcher to a user. All three must stay in sync.
SHIPPED_CONFIGS = [
    HOOKS_DIR / "settings.json",
    REPO_ROOT / "scripts" / "install-hooks.mjs",
    REPO_ROOT / "apps" / "landing" / "public" / "install-hooks.mjs",
]


def _governed_tool_names() -> list[str]:
    """Every tool the classifier claims to govern, read from its own source."""
    src = (HOOKS_DIR / "sidclaw_agent_intel" / "tool_recognizer.py").read_text()
    names = sorted(set(re.findall(r'"([A-Z][A-Za-z_]+)"\s*:', src)))
    return [n for n in names if classify_tool(n).governed]


def _matchers(path: Path) -> list[str]:
    text = path.read_text()
    return re.findall(r"""matcher["']?\s*:\s*["']([^"']+)["']""", text)


def _run(payload, env, raw_input=None):
    proc = subprocess.run(
        [sys.executable, str(PRETOOL)],
        input=json.dumps(payload) if raw_input is None else raw_input,
        capture_output=True,
        text=True,
        env={**_CLEAN_ENV, **env},
    )
    return proc.returncode, proc.stderr


BASE_ENV = {
    "SIDCLAW_BASE_URL": "http://127.0.0.1:1",  # nothing listening
    "SIDCLAW_API_KEY": "test-key",
    "SIDCLAW_HOOK_MODE": "enforce",
    "SIDCLAW_FAIL_OPEN": "false",
}


class TestMatcherCoversEveryGovernedTool:
    """A tool absent from the matcher never reaches the hook at all."""

    @pytest.mark.parametrize("config", SHIPPED_CONFIGS, ids=lambda p: p.name)
    def test_every_governed_tool_matches(self, config):
        governed = _governed_tool_names()
        assert governed, "classifier reported no governed tools — test is not exercising anything"

        found = _matchers(config)
        assert found, f"no matcher found in {config}"

        for matcher in found:
            pattern = re.compile(f"^({matcher})$")
            missing = [t for t in governed if not pattern.match(t)]
            assert not missing, (
                f"{config.name}: these tools are governed by the classifier but the "
                f"matcher never invokes the hook for them: {missing}"
            )

    def test_all_shipped_configs_agree(self):
        seen = {c.name: set(_matchers(c)) for c in SHIPPED_CONFIGS}
        distinct = {frozenset(v) for v in seen.values()}
        assert len(distinct) == 1, f"shipped matchers have drifted apart: {seen}"

    def test_mcp_tools_still_covered(self):
        for config in SHIPPED_CONFIGS:
            for matcher in _matchers(config):
                assert re.compile(f"^({matcher})$").match("mcp__whatever__tool"), (
                    f"{config.name}: MCP tools no longer match"
                )


class TestHookFailsClosed:
    def test_crash_blocks(self, tmp_path):
        """An uncaught exception must exit 2, not 1.

        Exit 1 is non-blocking, so a crashed gate used to be an open gate.
        """
        shim = tmp_path / "crash.py"
        shim.write_text(
            "import sys\n"
            f"sys.path.insert(0, {str(HOOKS_DIR)!r})\n"
            "import sidclaw_pretool as m\n"
            "def boom():\n"
            "    raise RuntimeError('simulated bug')\n"
            "m.main = boom\n"
            "sys.exit(m._run())\n"
        )
        proc = subprocess.run(
            [sys.executable, str(shim)],
            input="{}",
            capture_output=True,
            text=True,
            env={**_CLEAN_ENV, **BASE_ENV},
        )
        assert proc.returncode == 2, f"crash exited {proc.returncode} (non-blocking), stderr={proc.stderr}"
        assert "crashed" in proc.stderr.lower()

    def test_crash_in_observe_mode_does_not_block(self, tmp_path):
        """Observe mode's contract is 'never block' — that must still hold."""
        shim = tmp_path / "crash_observe.py"
        shim.write_text(
            "import sys\n"
            f"sys.path.insert(0, {str(HOOKS_DIR)!r})\n"
            "import sidclaw_pretool as m\n"
            "def boom():\n"
            "    raise RuntimeError('simulated bug')\n"
            "m.main = boom\n"
            "sys.exit(m._run())\n"
        )
        proc = subprocess.run(
            [sys.executable, str(shim)],
            input="{}",
            capture_output=True,
            text=True,
            env={**_CLEAN_ENV, **BASE_ENV, "SIDCLAW_HOOK_MODE": "observe"},
        )
        assert proc.returncode == 0

    @pytest.mark.parametrize("value", ["", "   ", ",,,", "bogus_category", "execution,not_a_category"])
    def test_bad_governed_categories_blocks(self, value):
        code, stderr = _run(
            {"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}},
            env={**BASE_ENV, "SIDCLAW_GOVERNED_CATEGORIES": value},
        )
        assert code == 2, f"value {value!r} exited {code}, stderr={stderr}"
        assert "misconfigured" in stderr.lower()

    @pytest.mark.parametrize("raw", ["not json at all", '{"unterminated": ', "[1,2,3]", '"a string"'])
    def test_unusable_stdin_blocks(self, raw):
        code, stderr = _run(None, env=BASE_ENV, raw_input=raw)
        assert code == 2, f"payload {raw!r} exited {code}, stderr={stderr}"

    def test_valid_categories_still_work(self):
        """Guard against over-correction — the happy paths must survive."""
        for value in ["all", "execution", "execution,file_io", " execution , mcp "]:
            code, stderr = _run(
                {"tool_name": "Read", "tool_input": {"file_path": "x"}},
                env={**BASE_ENV, "SIDCLAW_GOVERNED_CATEGORIES": value},
            )
            assert code == 0, f"value {value!r} unexpectedly exited {code}: {stderr}"

    def test_unset_categories_uses_default(self):
        code, _ = _run({"tool_name": "Read", "tool_input": {"file_path": "x"}}, env=BASE_ENV)
        assert code == 0

    def test_empty_stdin_is_not_an_error(self):
        """No payload at all is distinct from an unreadable one."""
        code, _ = _run(None, env=BASE_ENV, raw_input="")
        assert code == 0
