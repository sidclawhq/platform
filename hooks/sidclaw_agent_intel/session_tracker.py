"""Track hook session state: pending trace IDs + token high-water marks.

Concurrency: Claude Code runs tool calls in parallel. Two PreToolUse hooks
can race on the same session file — naive read/modify/write loses data. We
use fcntl advisory locking (POSIX) + os.replace() for atomic writes so
parallel invocations serialize cleanly.

Fields:
    pending: tool_use_id -> trace_id  (live, drained as PostToolUse fires)
    submitted_tokens: {tokens_in, tokens_out, tokens_cache_read}
                     — high-water mark submitted to SidClaw. The Stop hook
                     computes the delta (current transcript total - this
                     high-water mark) before PATCH, then bumps the mark.
                     Fixes the cumulative-drift bug where multi-turn
                     sessions re-attributed historical tokens.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from contextlib import contextmanager
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterator

try:
    import fcntl  # POSIX advisory locking
    _HAS_FCNTL = True
except ImportError:  # pragma: no cover — Windows fallback to msvcrt
    _HAS_FCNTL = False

try:
    import msvcrt  # Windows locking API
    _HAS_MSVCRT = True
except ImportError:
    _HAS_MSVCRT = False


@dataclass
class SessionState:
    session_id: str
    started_at: float = field(default_factory=time.time)
    pending: dict[str, str] = field(default_factory=dict)  # tool_use_id -> trace_id
    # Running total of tokens already attributed to SidClaw for this session.
    # Stop hook computes `transcript_total - submitted_tokens` as the delta.
    submitted_tokens: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return asdict(self)


def _state_dir() -> Path:
    base = Path(os.environ.get("SIDCLAW_STATE_DIR", str(Path.home() / ".sidclaw")))
    base.mkdir(parents=True, exist_ok=True)
    return base


def _session_file(session_id: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id)
    return _state_dir() / f"session_{safe}.json"


@contextmanager
def _locked(path: Path) -> Iterator[None]:
    """Hold an exclusive advisory lock on `path.lock` for the duration of
    the context. Multiple hook processes racing on the same session file
    serialize through this lock.

    POSIX: uses `fcntl.flock(LOCK_EX)` — classic advisory lock keyed on
    the inode, robust against orphaned lock files.

    Windows: uses `msvcrt.locking(LK_LOCK)` which takes a mandatory byte-
    range lock on the file. `LK_LOCK` blocks up to ~10s then raises; we
    retry until we acquire (Claude Code's hook timeout is the outer bound).

    Environments without either (shouldn't happen on any mainstream
    Python) fall back to no mutual exclusion with a stderr warning.
    """
    lock_path = path.with_suffix(path.suffix + ".lock")
    fd = None
    try:
        fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o600)
        if _HAS_FCNTL:
            fcntl.flock(fd, fcntl.LOCK_EX)
        elif _HAS_MSVCRT:
            # Write one byte so we have something to lock, then loop until
            # LK_LOCK succeeds. msvcrt.locking raises on contention so we
            # sleep briefly between attempts.
            import time as _time
            if os.fstat(fd).st_size == 0:
                os.write(fd, b"\0")
            os.lseek(fd, 0, os.SEEK_SET)
            while True:
                try:
                    msvcrt.locking(fd, msvcrt.LK_LOCK, 1)
                    break
                except OSError:
                    _time.sleep(0.05)
        else:
            import sys as _sys
            print(
                "[sidclaw] warning: no fcntl or msvcrt available — "
                "concurrent hook invocations may corrupt state",
                file=_sys.stderr,
            )
        yield
    finally:
        if fd is not None:
            try:
                if _HAS_FCNTL:
                    fcntl.flock(fd, fcntl.LOCK_UN)
                elif _HAS_MSVCRT:
                    try:
                        os.lseek(fd, 0, os.SEEK_SET)
                        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
                    except OSError:
                        pass  # best effort
            finally:
                os.close(fd)


def _atomic_write(path: Path, text: str) -> None:
    """Write text to path atomically via tmp-file + os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        prefix=path.name + ".",
        suffix=".tmp",
        dir=str(path.parent),
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            try:
                os.fsync(f.fileno())
            except OSError:
                pass  # fsync not supported on some filesystems — best effort
        os.replace(tmp_path, path)
    except Exception:
        # Clean up orphaned tmp file on any failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def load_session(session_id: str) -> SessionState:
    """Read session state from disk. Does NOT hold the lock — callers that
    read-modify-write should use `_update_session` instead."""
    path = _session_file(session_id)
    if not path.exists():
        return SessionState(session_id=session_id)
    try:
        data = json.loads(path.read_text())
        return SessionState(
            session_id=data.get("session_id", session_id),
            started_at=data.get("started_at", time.time()),
            pending=data.get("pending", {}),
            submitted_tokens=data.get("submitted_tokens", {}),
        )
    except (OSError, json.JSONDecodeError):
        return SessionState(session_id=session_id)


def save_session(state: SessionState) -> None:
    """Write session state atomically. Safe to call without a lock — but
    for read-modify-write sequences, use `_update_session`."""
    try:
        path = _session_file(state.session_id)
        _atomic_write(path, json.dumps(state.as_dict()))
    except OSError as e:
        print(f"[sidclaw] failed to save session {state.session_id}: {e}", file=sys.stderr)


def _update_session(session_id: str, mutator) -> SessionState:
    """Read, mutate, write — all under an exclusive lock."""
    path = _session_file(session_id)
    with _locked(path):
        state = load_session(session_id)
        mutator(state)
        save_session(state)
        return state


# Public alias for callers (e.g. the Stop hook's crash-recovery drain) that
# need the same lock + atomic-write guarantees around a custom mutator.
update_session = _update_session


def remember_pending(session_id: str, tool_use_id: str, trace_id: str) -> None:
    def _mutate(state: SessionState) -> None:
        state.pending[tool_use_id] = trace_id
    _update_session(session_id, _mutate)


def pop_pending(session_id: str, tool_use_id: str) -> str | None:
    popped: list[str | None] = [None]

    def _mutate(state: SessionState) -> None:
        popped[0] = state.pending.pop(tool_use_id, None)
    _update_session(session_id, _mutate)
    return popped[0]


def all_pending(session_id: str) -> list[str]:
    # Read-only — no lock needed beyond filesystem atomicity guaranteed by
    # os.replace in save_session.
    state = load_session(session_id)
    return list(state.pending.values())


def clear_session(session_id: str) -> None:
    path = _session_file(session_id)
    lock_path = path.with_suffix(path.suffix + ".lock")
    with _locked(path):
        for p in (path, lock_path):
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass


def compute_token_delta(
    session_id: str,
    current_in: int,
    current_out: int,
    current_cache_read: int,
) -> tuple[int, int, int]:
    """Compare the current transcript totals against the high-water mark
    submitted to SidClaw, return the delta, and bump the high-water mark.

    Returns (delta_in, delta_out, delta_cache_read). Behavior:
    - current >= prev: return delta = current - prev; update mark to current.
    - current <  prev: transcript was compacted/truncated (Claude Code's
      /compact command, or a fresh transcript file). Reset the mark to
      `current` and return that as the delta (new history starts here).
      Without this reset, subsequent deltas would clamp to 0 until the
      running total caught back up past the old high-water mark —
      silently under-counting tokens on long sessions that compact.
    """
    deltas: list[tuple[int, int, int]] = []

    def _mutate(state: SessionState) -> None:
        prev_in = int(state.submitted_tokens.get("tokens_in", 0))
        prev_out = int(state.submitted_tokens.get("tokens_out", 0))
        prev_cache = int(state.submitted_tokens.get("tokens_cache_read", 0))

        # Detect transcript shrink — reset mark instead of clamping.
        shrunk = (
            current_in < prev_in
            or current_out < prev_out
            or current_cache_read < prev_cache
        )
        if shrunk:
            d_in = current_in
            d_out = current_out
            d_cache = current_cache_read
            state.submitted_tokens["tokens_in"] = current_in
            state.submitted_tokens["tokens_out"] = current_out
            state.submitted_tokens["tokens_cache_read"] = current_cache_read
        else:
            d_in = current_in - prev_in
            d_out = current_out - prev_out
            d_cache = current_cache_read - prev_cache
            state.submitted_tokens["tokens_in"] = current_in
            state.submitted_tokens["tokens_out"] = current_out
            state.submitted_tokens["tokens_cache_read"] = current_cache_read

        deltas.append((d_in, d_out, d_cache))
    _update_session(session_id, _mutate)
    return deltas[0]
