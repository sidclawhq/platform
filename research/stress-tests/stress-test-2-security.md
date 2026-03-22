# Stress Test 2: Security & Abuse Testing Report

**Date:** 2026-03-22
**Target:** `https://api.sidclaw.com` (production) and `https://app.sidclaw.com` (dashboard)
**Tester:** Automated security probe via Claude Code

---

## 1. Summary Table

| # | Test | Result | Severity |
|---|------|--------|----------|
| 1a | No auth → 401 | PASS | — |
| 1b | Invalid API key → 401 | PASS | — |
| 1c | Malformed auth header → 401 | PASS | — |
| 1d | SQL injection in auth header → 401 | PASS | — |
| 1e | Health endpoint accessible → 200 | PASS | — |
| 2a | Tenant A sees only own data | PASS | — |
| 2b | Tenant B sees only own data | PASS | — |
| 2c | Cross-tenant ID probing → 404 (not 403) | PASS | — |
| 2d | Cross-tenant approval/trace access → 404 | PASS | — |
| 3a | XSS in input → reflected in JSON error | PASS (low concern) | Low |
| 3c | Oversized payload (1MB) accepted | FAIL | Medium |
| 3d | Invalid enum values → 400 | PASS | — |
| 3e | Missing required fields → 400 | PASS | — |
| 4 | CSRF protection | N/A | — |
| 5 | Rate limiting (150 requests) | FAIL | High |
| 6 | API key scope enforcement | PASS | — |
| 7a | No stack traces in errors | PASS | — |
| 7b | No tenant info leakage in 404s | PASS | — |
| 7c | Response headers info leakage | PASS (low concern) | Low |
| 8 | Session security | CANNOT TEST | — |
| 9 | Integrity hash verification | PASS | — |

**Overall: 12 PASS, 2 FAIL, 1 N/A, 1 CANNOT TEST**

---

## 2. Vulnerabilities Found

### V1: No Rate Limiting (HIGH)

**Severity:** High
**Description:** The API has no rate limiting whatsoever. 150 rapid requests to `GET /api/v1/traces` all returned 200 with no `429 Too Many Requests`, no `Retry-After` headers, and no `X-RateLimit-*` headers.

**Reproduction:**
```bash
for i in $(seq 1 150); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer <key>" \
    https://api.sidclaw.com/api/v1/traces)
  echo "Request $i: $STATUS"
done
# All 150 return 200
```

**Impact:** Enables brute-force attacks on API keys, credential stuffing on the signup endpoint, and resource exhaustion. The signup endpoint is also unprotected, allowing unlimited account creation.

---

### V2: No Request Body Size Limit (MEDIUM)

**Severity:** Medium
**Description:** The API accepts and processes a 1MB JSON payload without rejection. The `agent_id` field contained 1,000,000 characters and the server processed it, looked up the agent, and returned a 404 with the full 1MB agent name reflected in the error message. A 10MB payload caused a connection timeout (likely Cloudflare/Railway infrastructure limit, not application-level).

**Reproduction:**
```bash
curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"$(python3 -c "print('A'*1000000)")\",\"operation\":\"read\",\"target_integration\":\"test\",\"resource_scope\":\"test\",\"data_classification\":\"internal\"}"
# Returns 404 with the full 1MB agent_id reflected in error message
```

**Impact:** Memory and bandwidth waste. Combined with no rate limiting, could be used for resource exhaustion. The reflected 1MB response is amplified from the request.

---

### V3: No Signup Rate Limiting (MEDIUM)

**Severity:** Medium
**Description:** The `POST /api/v1/auth/signup` endpoint has no rate limiting or CAPTCHA. An attacker could create unlimited tenants and API keys.

**Reproduction:**
```bash
# Create unlimited accounts rapidly
for i in $(seq 1 100); do
  curl -s -X POST https://api.sidclaw.com/api/v1/auth/signup \
    -H "Content-Type: application/json" \
    --data-raw "{\"email\":\"bot-$i@spam.com\",\"password\":\"Password123\",\"name\":\"Bot $i\"}"
done
```

**Impact:** Database pollution, potential resource exhaustion, abuse of free tier.

---

### V4: Lax Email Validation (LOW)

**Severity:** Low
**Description:** The signup endpoint accepts email addresses containing SQL special characters. `admin'--@test.com` was accepted and an account was successfully created. While Prisma's parameterized queries prevent actual SQL injection, the email validation is overly permissive.

**Reproduction:**
```bash
curl -s -X POST https://api.sidclaw.com/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  --data-raw '{"email":"admin'\''--@test.com","password":"StressTest2026Secure","name":"SQLi Test"}'
# Returns 201 — account created
```

**Impact:** Primarily a data quality issue. Could complicate email delivery if email-based features are added later.

---

### V5: Infrastructure Headers Leaked (LOW)

**Severity:** Low
**Description:** Response headers reveal the hosting platform:
- `x-railway-edge: railway/europe-west4-drams3a` — reveals Railway hosting in Europe (west4)
- `x-railway-request-id` — Railway-specific request ID

The `X-Powered-By` header is correctly stripped (Helmet).

**Impact:** Provides reconnaissance information to attackers (hosting provider, region). Minimal practical impact.

---

### V6: XSS Payload Reflected in JSON Error Responses (LOW)

**Severity:** Low
**Description:** When an agent_id contains `<script>alert(1)</script>`, the error response reflects it verbatim: `"Agent '<script>alert(1)</script>' not found"`. The `Content-Type: application/json` header prevents browser execution, so this is not exploitable as reflected XSS. However, if any consumer renders this error message as HTML without escaping, it becomes exploitable.

**Reproduction:**
```bash
curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  --data-raw '{"agent_id":"<script>alert(1)</script>","operation":"read","target_integration":"test","resource_scope":"test","data_classification":"internal"}'
# Response: {"error":"not_found","message":"Agent '<script>alert(1)</script>' not found",...}
```

**Impact:** Low risk due to JSON content type, but defense-in-depth suggests sanitizing user input in error messages.

---

### V7: Verify Endpoint Returns True for Non-existent Traces (LOW)

**Severity:** Low
**Description:** `GET /api/v1/traces/{id}/verify` returns `{"verified":true,"total_events":0,"verified_events":0}` for non-existent trace UUIDs instead of 404.

**Reproduction:**
```bash
curl -s -H "Authorization: Bearer <key>" \
  https://api.sidclaw.com/api/v1/traces/00000000-0000-0000-0000-000000000000/verify
# Returns: {"verified":true,...} instead of 404
```

**Impact:** Misleading. A consumer checking integrity could believe a trace exists and is verified when it doesn't exist at all.

---

### V8: Dashboard Login Non-functional (MEDIUM — Functionality)

**Severity:** Medium (functionality, not direct security)
**Description:** The dashboard at `app.sidclaw.com` shows a login page with email/password fields, GitHub OAuth, Google OAuth, and SSO buttons. However:
- The email/password form submits to GitHub OAuth redirect (`/api/v1/auth/github`) which returns 404
- `GET /api/v1/auth/login` returns `"OIDC provider not configured"`
- `POST /api/v1/auth/login` returns 404

No functional login path exists for the dashboard.

**Impact:** Dashboard is inaccessible to users. API key management (creating admin-scoped keys) is only possible through the dashboard, so users are limited to the default `evaluate`-scoped key from signup. This blocks Tests 4 (CSRF) and 8 (Session Security) from being fully evaluated.

---

## 3. Security Posture Assessment

### Authentication: SOLID

- All protected endpoints correctly return 401 without valid credentials
- Invalid keys, malformed headers, and SQL injection attempts all handled properly (401, no 500s)
- Health endpoint is the only unauthenticated route (correct)
- Dev bypass (`X-Dev-Bypass: true`) is properly disabled in production
- API keys use strong format: `ai_` prefix + 64-char hex (32 bytes of entropy)
- Password validation enforces minimum 8 characters
- Duplicate email signup correctly returns 409

### Authorization (RBAC + Tenants): SOLID

- Cross-tenant isolation is properly enforced — foreign IDs return 404 (not 403), preventing tenant enumeration
- API key scopes are enforced correctly: `agents`, `policies`, and `api-keys` endpoints return 403 for evaluate-scoped keys
- Default signup keys have least-privilege scopes (`evaluate`, `traces:read`, `traces:write`, `approvals:read`)
- CORS properly configured: evil origins get no `Access-Control-Allow-Origin`, while `app.sidclaw.com` is allowed

### Input Validation: ADEQUATE (with gaps)

- Zod validation catches missing/invalid fields with specific error messages (400)
- Enum validation works correctly with descriptive errors
- `.strict()` mode on signup schema prevents unknown field injection
- **Gap:** No request body size limits at the application level (1MB accepted)
- **Gap:** User input reflected in error messages without sanitization

### Information Leakage: SOLID (minor concerns)

- No stack traces, file paths, or internal details in error responses
- Standard `ApiError` shape used consistently across all error types
- `X-Powered-By` header stripped (Helmet)
- Full security headers present: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **Minor:** Railway hosting infrastructure headers leaked (low impact)

### Session Management: CANNOT ASSESS

- OIDC-based session auth is not yet functional in production
- No session cookies are issued (no login path works)
- Cookie security attributes (HttpOnly, Secure, SameSite) cannot be tested

---

## 4. Top 3 Security Improvements Before Enterprise Deployment

### 1. Implement Rate Limiting (Critical)

Add rate limiting at both application and infrastructure levels:
- **API endpoints:** 100 req/min for read, 20 req/min for write (per API key)
- **Authentication:** 5 failed attempts/min per IP, then exponential backoff
- **Signup:** 3 accounts/hour per IP, require email verification
- **Evaluate:** Tier-based limits (free: 100/hour, pro: 10,000/hour)
- Return `429 Too Many Requests` with `Retry-After` and `X-RateLimit-*` headers
- Consider Cloudflare rate limiting rules as a first line of defense

### 2. Add Request Body Size Limits and Input Sanitization (High)

- Configure Fastify `bodyLimit` to 1MB maximum (default is already 1MB in Fastify, but may not be configured)
- Add string length validation on all input fields (e.g., `agent_id.max(200)`, `name.max(200)`)
- Sanitize user input before including in error messages (strip HTML tags or escape)
- Add field-level size validation in Zod schemas

### 3. Fix Dashboard Authentication (High)

- Complete OIDC provider configuration for production (Google OAuth, GitHub OAuth)
- OR implement email/password login endpoint (`POST /api/v1/auth/login`)
- Ensure session cookies use: `HttpOnly`, `Secure`, `SameSite=Lax`, appropriate `Max-Age`
- Implement CSRF token validation for session-authenticated state-changing requests
- Add session revocation on logout

---

## Appendix: Test Accounts Created

The following test accounts were created during this test and should be cleaned up:

| Email | Tenant | Purpose |
|-------|--------|---------|
| `stress-test-a@sidclaw.com` | Stress Test Tenant A | Primary test account |
| `stress-test-b@sidclaw.com` | Stress Test Tenant B | Cross-tenant isolation testing |
| `admin'--@test.com` | SQLi Test | SQL injection email validation test |
