"""Minimal HTTP client for the SidClaw API used by the hooks.

Uses `urllib` to avoid adding dependencies — hooks must run on any Python 3.10+
install without needing `pip install`. Keeps the dependency surface tiny.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass


class SidClawError(Exception):
    """Raised when the SidClaw API returns an error or is unreachable.

    `kind` distinguishes auth/client errors (cannot recover by retry) from
    transport errors (retryable, and fail-open eligible if configured).
    """

    def __init__(self, message: str, kind: str = "transport", status: int | None = None):
        super().__init__(message)
        self.kind = kind  # "auth" | "client" | "rate_limit" | "server" | "transport"
        self.status = status


class SidClawAuthError(SidClawError):
    """401/403 — never fail-open even if SIDCLAW_FAIL_OPEN is set."""

    def __init__(self, message: str, status: int):
        super().__init__(message, kind="auth", status=status)


@dataclass
class EvaluateResult:
    decision: str            # allow | log | deny | flag | unknown
    trace_id: str | None
    approval_id: str | None
    reason: str | None


def _base_url() -> str:
    url = os.environ.get("SIDCLAW_BASE_URL", "").rstrip("/")
    if not url:
        raise SidClawError("SIDCLAW_BASE_URL is not set")
    return url


def _api_key() -> str:
    key = os.environ.get("SIDCLAW_API_KEY", "")
    if not key:
        raise SidClawError("SIDCLAW_API_KEY is not set")
    return key


def _timeout() -> float:
    try:
        return float(os.environ.get("SIDCLAW_GUARD_TIMEOUT", "2.5"))
    except ValueError:
        return 2.5


_MAX_RETRIES = 3


def _request(path: str, method: str, body: dict | None = None, timeout: float | None = None) -> dict:
    """Send a request with retry + Retry-After handling for 429/503.

    Error taxonomy:
      - 401/403 → SidClawAuthError (kind='auth', never retried, never fail-open)
      - 429 → retries up to _MAX_RETRIES with Retry-After honored; raises
              SidClawError(kind='rate_limit') if still exhausted.
      - 5xx → retries with exponential backoff; kind='server'.
      - Connection/timeout → retries; kind='transport'.
      - 4xx (other) → no retry; kind='client'.
    """
    url = f"{_base_url()}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {_api_key()}")
    req.add_header("User-Agent", "sidclaw-hooks/0.1")

    last_exc: SidClawError | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout or _timeout()) as resp:
                raw = resp.read()
                if not raw:
                    return {}
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                error_body = json.loads(e.read().decode("utf-8"))
            except Exception:  # noqa: BLE001
                error_body = {"message": str(e)}
            message = f"HTTP {e.code} from {path}: {error_body.get('message') or error_body}"

            if e.code in (401, 403):
                raise SidClawAuthError(message, status=e.code)
            if e.code == 429:
                retry_after = _parse_retry_after(e.headers.get("Retry-After"))
                last_exc = SidClawError(message, kind="rate_limit", status=429)
                if attempt < _MAX_RETRIES:
                    time.sleep(min(retry_after, 30.0))
                    continue
                raise last_exc
            if 500 <= e.code < 600:
                last_exc = SidClawError(message, kind="server", status=e.code)
                if attempt < _MAX_RETRIES:
                    time.sleep(_backoff_delay(attempt))
                    continue
                raise last_exc
            # Other 4xx — client error, do not retry
            raise SidClawError(message, kind="client", status=e.code)
        except urllib.error.URLError as e:
            last_exc = SidClawError(f"Cannot reach SidClaw at {url}: {e.reason}", kind="transport")
            if attempt < _MAX_RETRIES:
                time.sleep(_backoff_delay(attempt))
                continue
            raise last_exc
        except TimeoutError as e:
            last_exc = SidClawError(f"SidClaw request to {path} timed out: {e}", kind="transport")
            if attempt < _MAX_RETRIES:
                time.sleep(_backoff_delay(attempt))
                continue
            raise last_exc

    # Unreachable in practice — the loop always returns or raises — but
    # satisfies type checkers.
    if last_exc is not None:
        raise last_exc
    raise SidClawError(f"Unexpected failure contacting {url}", kind="transport")


def _parse_retry_after(header: str | None) -> float:
    if not header:
        return 1.0
    try:
        return max(0.1, float(header))
    except ValueError:
        return 1.0  # HTTP-date parsing omitted — servers almost always send seconds


def _backoff_delay(attempt: int) -> float:
    return min(10.0, 0.5 * (2 ** attempt))


def evaluate(payload: dict) -> EvaluateResult:
    """POST /api/v1/evaluate — returns the governance decision."""
    data = _request("/api/v1/evaluate", "POST", payload)
    # SidClaw evaluate response uses `decision` or `policy_effect` depending on API version
    decision = data.get("decision") or data.get("policy_effect") or "unknown"
    # Normalize platform decision names to hook vocabulary
    if decision == "allow":
        normalized = "allow"
    elif decision in ("deny", "blocked"):
        normalized = "deny"
    elif decision in ("approval_required", "flag", "flagged"):
        normalized = "flag"
    elif decision == "log":
        normalized = "log"
    else:
        normalized = decision
    return EvaluateResult(
        decision=normalized,
        trace_id=data.get("trace_id"),
        approval_id=data.get("approval_request_id") or data.get("approval_id"),
        reason=data.get("reason") or data.get("rationale"),
    )


def record_outcome(trace_id: str, body: dict) -> None:
    """POST /api/v1/traces/:id/outcome — record PostToolUse outcome + telemetry."""
    _request(f"/api/v1/traces/{trace_id}/outcome", "POST", body)


def record_telemetry(trace_id: str, body: dict) -> None:
    """PATCH /api/v1/traces/:id/telemetry — append token usage / cost data."""
    _request(f"/api/v1/traces/{trace_id}/telemetry", "PATCH", body)


def poll_approval(approval_id: str, timeout_seconds: int, poll_interval: float = 3.0) -> str:
    """Poll an approval until it resolves or timeout expires.

    Returns the final status string (approved, denied, expired, timeout).
    """
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            data = _request(f"/api/v1/approvals/{approval_id}/status", "GET")
        except SidClawError:
            data = {}
        status = data.get("status")
        if status in ("approved", "denied", "expired", "cancelled"):
            return status
        time.sleep(poll_interval)
    return "timeout"
