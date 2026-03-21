# Stress Test 2: Security & Abuse Testing Report

**Date:** 2026-03-21
**Tester:** Automated security stress test via Claude Code
**Environment:** localhost (API :4000, Dashboard :3000, PostgreSQL :5432)
**Tenant under test:** `tenant-default` (enterprise plan), `tenant-b` (cross-tenant)

---

## Executive Summary

The platform demonstrates **strong fundamentals** in authentication, tenant isolation, and XSS prevention. However, **two critical vulnerabilities** were found:

1. **Separation of duties bypass** via case/whitespace variation in approver name (Critical)
2. **Double-approve race condition** with no optimistic locking on approval decisions (Critical)

Additionally, two medium-severity issues were found in input validation (invalid JSON and oversized bodies return 500 instead of 400).

---

## 1. Vulnerability Matrix

### 1a. No Authentication

| Endpoint | Expected | Actual | Result |
|---|---|---|---|
| `GET /api/v1/agents` | 401 | 401 | PASS |
| `GET /api/v1/policies` | 401 | 401 | PASS |
| `GET /api/v1/approvals` | 401 | 401 | PASS |
| `GET /api/v1/traces` | 401 | 401 | PASS |
| `POST /api/v1/evaluate` | 401 | 401 | PASS |
| `GET /api/v1/users` | 401 | 401 | PASS |
| `GET /api/v1/tenant/settings` | 401 | 401 | PASS |
| `GET /api/v1/api-keys` | 401 | 401 | PASS |
| `GET /api/v1/webhooks` | 401 | 401 | PASS |
| `GET /api/v1/search?q=test` | 401 | 401 | PASS |

**Result: 10/10 PASS** — All protected endpoints require authentication.

### 1b. Invalid API Keys

| Input | Expected | Actual | Result |
|---|---|---|---|
| `totally-invalid-key` | 401 | 401 | PASS |
| `ai_000...000` (valid prefix, zeros) | 401 | 401 | PASS |
| Empty bearer token | 401 | 401 | PASS |
| Basic auth header | 401 | 401 | PASS |
| Key without `Bearer` prefix | 401 | 401 | PASS |

**Result: 5/5 PASS**

### 1d. Session Cookie Manipulation

| Cookie Value | Expected | Actual | Result |
|---|---|---|---|
| `../../etc/passwd` | 401 | 401 | PASS |
| `null` | 401 | 401 | PASS |
| `undefined` | 401 | 401 | PASS |
| `' OR 1=1 --` | 401 | 401 | PASS |
| `<script>alert(1)</script>` | 401 | 401 | PASS |
| `0000-0000-0000-0000` | 401 | 401 | PASS |
| Random UUID | 401 | 401 | PASS |

**Result: 7/7 PASS** — No 500 errors, all invalid sessions rejected cleanly.

---

### 2. CSRF Bypass Attempts

| Test | Expected | Actual | Result |
|---|---|---|---|
| POST without CSRF token | 403 | 403 | PASS |
| POST with wrong CSRF token | 403 | 403 | PASS |
| POST with CSRF from different session | 403 | 403 | PASS |
| API key auth (no CSRF needed) | 200 | 200 | PASS |
| Valid session + valid CSRF | 200 | 400 (validation) | PASS (CSRF passed, body validation failed as expected) |

**Result: 5/5 PASS** — CSRF token is validated by comparing `X-CSRF-Token` header against `csrf_token` cookie. Both must match. API key auth correctly bypasses CSRF.

---

### 3. Tenant Isolation

| Test | Expected | Actual | Result |
|---|---|---|---|
| TenB reads TenA agent (`agent-001`) | 404 | 404 | PASS |
| TenB lists traces | empty | `total: 0` | PASS |
| TenB approves TenA approval | 404 | 404 | PASS |
| TenB evaluates TenA agent | 404 | 404 | PASS |
| TenB exports traces (wide date range) | headers only | 1 line (headers only) | PASS |
| TenB lists webhooks | empty | `[]` | PASS |
| TenB lists users | TenB users only | TenB users only | PASS |

**Result: 7/7 PASS** — Complete tenant isolation. Cross-tenant resources return 404 (not 403), preventing information leakage about resource existence.

---

### 4. RBAC Bypass Attempts

| Test | Expected | Actual | Result |
|---|---|---|---|
| Viewer creates agent | 403 | 403 | PASS |
| Viewer approves request | 403 | 403 | PASS |
| Viewer accesses users | 403 | 403 | PASS |
| Viewer accesses API keys | 403 | 403 | PASS |
| Viewer updates policy | 403 | 403 | PASS |
| Viewer reads tenant settings | 200 | 200 | PASS (by design) |
| Viewer reads agents | 200 | 200 | PASS |
| Viewer reads policies | 200 | 200 | PASS |
| Viewer reads traces | 200 | 200 | PASS |

**Result: 9/9 PASS** — Write operations correctly restricted. Read access for tenant settings is intentional (see code comment: "any authenticated user can read"). Only PATCH requires admin role.

**Note:** No DELETE route exists for agents (returns 404 from Fastify router, not the app).

---

### 5. Input Validation & Injection

#### 5a. SQL Injection

| Test | Expected | Actual | Result |
|---|---|---|---|
| SQL in `target_integration` | 400/200 | 200 (denied by policy, safe) | PASS |
| SQL in search query | 400/200 | 200 (empty results) | PASS |
| SQL in agent ID path param | 404 | 404 | PASS |
| `DROP TABLE` in trace ID | 404 | 404 | PASS |

**Result: 4/4 PASS** — Prisma ORM parameterizes all queries. SQL injection payloads are treated as literal strings. No data leakage.

**Note:** Error messages echo the user-provided ID back (e.g., `"Agent '1' OR '1'='1' not found"`). This is low-risk since it only confirms what the attacker already sent, but could be tightened.

#### 5b. XSS in Dashboard

| Test | Rendered as HTML? | Console Errors? | Result |
|---|---|---|---|
| Agent name: `<img src=x onerror=alert(1)>` | No (escaped: `&lt;img...&gt;`) | None | PASS |
| Agent description: `<script>document.cookie</script>` | No (escaped) | None | PASS |
| Agent owner: `<svg onload=alert(document.domain)>` | No (escaped) | None | PASS |
| Search input with XSS payload | No (escaped) | None | PASS |

**Result: 4/4 PASS** — React's JSX escaping prevents all XSS. HTML tags rendered as visible text. Screenshots in `research/stress-tests/screenshots/02/`.

#### 5c. Oversized Inputs

| Test | Expected | Actual | Result | Severity |
|---|---|---|---|---|
| 10MB request body | 413/400 | **500** | **FAIL** | Medium |
| 10K char agent ID in evaluate | 400 | 404 (safe) | PASS | — |
| Invalid JSON body | 400 | **500** | **FAIL** | Medium |
| Empty body | 400 | 400 | PASS | — |

**Findings:**
- **F-5c1:** 10MB body returns `500 Internal Error`. No `bodyLimit` configured on Fastify. The 500 response is sanitized (no stack trace), but should be a 413 or 400.
- **F-5c3:** Invalid JSON (e.g., `not json at all`) returns `500 Internal Error`. The JSON parse error is not caught by a content-type parser error handler. Should return 400.

#### 5d. Invalid Enum Values

| Test | Expected | Actual | Result |
|---|---|---|---|
| Invalid `authority_model` | 400 | 400 | PASS |
| Invalid `data_classification` | 400 | 400 | PASS |
| Invalid `operation` | 400 | 200 (denied by default) | PASS (by design — operation is a free-form string) |

**Result: 3/3 PASS**

---

### 6. API Key Scope Abuse

Dev key scopes: `["evaluate", "traces:read", "traces:write", "approvals:read"]`

| Endpoint | Expected | Actual | Result |
|---|---|---|---|
| `GET /agents` | 403 | 403 | PASS |
| `GET /policies` | 403 | 403 | PASS |
| `GET /users` | 403 | 403 | PASS |
| `GET /api-keys` | 403 | 403 | PASS |
| `POST /evaluate` | 200 | 200 | PASS |
| `GET /traces` | 200 | 200 | PASS |
| `GET /approvals` | 200 | 200 | PASS |
| `GET /webhooks` | 403 | 403 | PASS |
| `GET /search` | 403 | 403 | PASS |
| `GET /tenant/settings` | 403 | 403 | PASS |

**Result: 10/10 PASS** — Scope enforcement works correctly. Wildcard (`*`) and `admin` scopes bypass checks. Non-mapped routes default to requiring `admin` scope.

---

### 7. Rate Limiting

| Test | Result |
|---|---|
| Rate limit headers present | YES (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) |
| 200 rapid GET requests | No 429 (limit is 30,000/min for enterprise plan) |
| Per-tenant isolation | Confirmed (key is `{tenantId}:{category}`) |

**Configuration by plan:**

| Plan | Evaluate/min | Read/min | Write/min |
|---|---|---|---|
| Free | 100 | 300 | 60 |
| Team | 1,000 | 3,000 | 600 |
| Enterprise | 10,000 | 30,000 | 6,000 |

**Note:** The dev tenant is on the `enterprise` plan (30,000 read/min), which is why 200 rapid requests didn't trigger rate limiting. Rate limiting is functional and per-tenant. Implementation is in-memory sliding window — adequate for single-instance but would need Redis for multi-instance.

---

### 8. Separation of Duties Bypass

| Test | Expected | Actual | Result | Severity |
|---|---|---|---|---|
| Approve as `"Sarah Chen"` (exact match) | 403 | 403 | PASS | — |
| Approve as `"sarah chen"` (lowercase) | 403 | **200** | **FAIL** | **Critical** |
| Approve as `"Sarah  Chen"` (extra space) | 403 | **200** | **FAIL** | **Critical** |
| Approve as `"SARAH CHEN"` (all caps) | 403 | **200** | **FAIL** | **Critical** |
| Approve as `"Sarah\tChen"` (tab char) | 403 | **200** | **FAIL** | **Critical** |
| Approve as `"Security Tester"` (different person) | 200 | 200 | PASS | — |

**Root cause:** `approval-service.ts:86` performs strict string equality:
```typescript
if (decision.approver_name === approval.agent.owner_name)
```
No case normalization (`toLowerCase()`), no whitespace collapsing (`.trim().replace(/\s+/g, ' ')`).

**Fix:** Normalize both sides before comparison:
```typescript
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
if (normalize(decision.approver_name) === normalize(approval.agent.owner_name))
```

---

### 9. Concurrent Operations (Race Conditions)

| Test | Expected | Actual | Result | Severity |
|---|---|---|---|---|
| Double-approve (simultaneous) | One 200, one 409 | **Both 200** | **FAIL** | **Critical** |
| Repeated race tests (5 runs) | Mixed | **All double-200** | **FAIL** | **Critical** |

**Evidence:**
- Both Admin A and Admin B successfully approved the same request
- Two `approval_granted` audit events were created for the same trace
- The `decided_at` timestamps differ by ~16ms, confirming a race window
- The final approval record shows the second approver's name (last-write-wins)

**Root cause:** No optimistic locking (`WHERE status = 'pending'` in the UPDATE), no database-level constraint, no transaction isolation. The approval service reads status, checks it, then updates — a classic TOCTOU race.

**Fix:** Use an atomic conditional update:
```sql
UPDATE "ApprovalRequest"
SET status = 'approved', approver_name = $1, decided_at = NOW()
WHERE id = $2 AND status = 'pending'
RETURNING *;
```
If 0 rows affected, the approval was already decided — return 409.

---

### 10. Error Response Sanitization

| Check | Result |
|---|---|
| Stack traces in 500 responses | Not found (PASS) |
| Internal file paths | Not found (PASS) |
| Database connection strings | Not found (PASS) |
| Standard error shape (`{error, message, status, request_id}`) | Consistent (PASS) |

**Result: 4/4 PASS** — All 500 errors return a generic `{"error":"internal_error","message":"An unexpected error occurred","status":500,"request_id":"..."}` shape with no internal details.

---

## Critical Findings Summary

### F-1: Separation of Duties Bypass via Name Normalization (Critical)

- **Location:** `apps/api/src/services/approval-service.ts:86`
- **Impact:** An agent owner can approve their own agent's requests by varying the case or spacing of their name. This completely defeats the separation-of-duties control.
- **Exploitability:** Trivial — no tools needed beyond changing the case of the approver name field.
- **CVSS estimate:** 8.1 (High)

### F-2: Double-Approve Race Condition (Critical)

- **Location:** `apps/api/src/services/approval-service.ts` (approve method)
- **Impact:** Two simultaneous approval requests both succeed, creating duplicate audit events and inconsistent state. In a deny+approve race, the outcome is non-deterministic.
- **Exploitability:** Requires concurrent requests within a ~16ms window. Reliably reproducible in testing.
- **CVSS estimate:** 7.5 (High)

### F-3: Invalid JSON Returns 500 (Medium)

- **Location:** Fastify content-type parser
- **Impact:** Malformed JSON bodies cause unhandled errors. No data leakage (response is sanitized), but 500s are noisy in monitoring.
- **Fix:** Add `setErrorHandler` or content-type parser error handling to return 400.

### F-4: No Body Size Limit (Medium)

- **Location:** Fastify server configuration
- **Impact:** 10MB+ request bodies are accepted and processed, returning 500. Could be used for memory exhaustion.
- **Fix:** Set `bodyLimit` in Fastify server options (e.g., `bodyLimit: 1_048_576` for 1MB).

---

## Information Leakage Assessment

| Vector | Leaks? | Details |
|---|---|---|
| Error messages echo user input | Yes (low risk) | Agent ID in "not found" messages. Only echoes what attacker sent. |
| Cross-tenant resource existence | No | Returns 404 (not 403) for other tenants' resources. |
| Stack traces in errors | No | All 500s return generic message. |
| Rate limit headers | Yes (by design) | Reveal plan tier indirectly via limit values. Acceptable. |

---

## Screenshots

All screenshots saved to `research/stress-tests/screenshots/02/`:

| File | Description |
|---|---|
| `dashboard-home-*.png` | Login page |
| `after-dev-login-*.png` | Dashboard after dev-login |
| `agents-page-*.png` | Agent registry (normal) |
| `xss-agents-rendered-*.png` | XSS payloads rendered as text in agent list |
| `xss-search-*.png` | XSS payload in search field |

---

## Recommendations (Priority Order)

1. **[Critical] Fix separation of duties comparison** — Normalize approver name (trim, collapse whitespace, lowercase) before comparing to agent owner name.
2. **[Critical] Add optimistic locking to approval decisions** — Use `WHERE status = 'pending'` in the UPDATE query, or use Prisma's `version` field for optimistic concurrency.
3. **[Medium] Set Fastify `bodyLimit`** — Add `bodyLimit: 1_048_576` (1MB) to server options.
4. **[Medium] Handle JSON parse errors gracefully** — Return 400 instead of 500 for malformed request bodies.
5. **[Low] Consider sanitizing user input in error messages** — Replace echoed IDs with a generic "not found" or truncate to a max length.
