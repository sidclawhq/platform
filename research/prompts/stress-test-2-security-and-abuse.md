# Stress Test 2: Security & Abuse Testing

You are a security engineer performing a penetration test of the SidClaw platform. Your goal is to find vulnerabilities, bypass controls, and break things. Use both Playwright (for dashboard attacks) and curl/API calls (for API attacks).

**Do NOT modify any code.** Only test and report.

## Prerequisites

1. Start all services:
   ```bash
   docker compose up db -d
   cd apps/api && npx prisma migrate deploy && npx prisma db seed && npm run dev &
   cd apps/dashboard && npm run dev &
   ```
2. Get the dev API key from `deployment/.env.development`
3. Note the session cookie after logging in via the dashboard

## Test Categories

### 1. Authentication Bypass Attempts

#### 1a: No Authentication
```bash
# Try every endpoint without auth
curl http://localhost:4000/api/v1/agents
curl http://localhost:4000/api/v1/policies
curl http://localhost:4000/api/v1/approvals
curl http://localhost:4000/api/v1/traces
curl -X POST http://localhost:4000/api/v1/evaluate -H "Content-Type: application/json" -d '{}'
curl http://localhost:4000/api/v1/users
curl http://localhost:4000/api/v1/tenant/settings
```
Expected: ALL should return 401. Report any that don't.

#### 1b: Invalid API Keys
```bash
curl -H "Authorization: Bearer totally-invalid-key" http://localhost:4000/api/v1/agents
curl -H "Authorization: Bearer ai_00000000000000000000000000000000000000000000000000000000000000000" http://localhost:4000/api/v1/agents
curl -H "Authorization: Bearer " http://localhost:4000/api/v1/agents
curl -H "Authorization: Basic dXNlcjpwYXNz" http://localhost:4000/api/v1/agents
curl -H "Authorization: ai_dev_key_without_bearer" http://localhost:4000/api/v1/agents
```
Expected: ALL should return 401.

#### 1c: Expired/Deleted Session
```bash
# Login, get session cookie, then logout
# Try using the old session cookie after logout
curl -H "Cookie: session=<old_session_id>" http://localhost:4000/api/v1/agents
```
Expected: 401.

#### 1d: Session Cookie Manipulation
```bash
curl -H "Cookie: session=../../etc/passwd" http://localhost:4000/api/v1/agents
curl -H "Cookie: session=null" http://localhost:4000/api/v1/agents
curl -H "Cookie: session=undefined" http://localhost:4000/api/v1/agents
curl -H "Cookie: session=' OR 1=1 --" http://localhost:4000/api/v1/agents
curl -H "Cookie: session=<script>alert(1)</script>" http://localhost:4000/api/v1/agents
```
Expected: ALL should return 401, never 500 or an unhandled error.

### 2. CSRF Bypass Attempts

```bash
SESSION_COOKIE="<valid_session_cookie>"

# POST without CSRF token
curl -X POST http://localhost:4000/api/v1/agents \
  -H "Cookie: session=$SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"name":"csrf-test"}'
# Expected: 403

# POST with wrong CSRF token
curl -X POST http://localhost:4000/api/v1/agents \
  -H "Cookie: session=$SESSION_COOKIE" \
  -H "X-CSRF-Token: wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"name":"csrf-test"}'
# Expected: 403

# POST with CSRF token from different session
curl -X POST http://localhost:4000/api/v1/agents \
  -H "Cookie: session=$SESSION_COOKIE" \
  -H "X-CSRF-Token: token-from-another-user" \
  -H "Content-Type: application/json" \
  -d '{"name":"csrf-test"}'
# Expected: 403

# Verify that API key auth does NOT require CSRF
curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"agent-001","operation":"read","target_integration":"document_store","resource_scope":"internal_docs","data_classification":"internal"}'
# Expected: 200 (API key auth bypasses CSRF)
```

### 3. Tenant Isolation Attacks

Create a second tenant (via signup or direct DB). Get its API key.

```bash
TENANT_A_KEY="<seed_tenant_key>"
TENANT_B_KEY="<new_tenant_key>"
AGENT_A_ID="agent-001"  # belongs to tenant A

# Tenant B tries to access Tenant A's agent
curl -H "Authorization: Bearer $TENANT_B_KEY" http://localhost:4000/api/v1/agents/$AGENT_A_ID
# Expected: 404 (NOT 403 — no information leakage)

# Tenant B tries to list Tenant A's traces
curl -H "Authorization: Bearer $TENANT_B_KEY" http://localhost:4000/api/v1/traces
# Expected: empty array (only Tenant B's traces)

# Tenant B tries to approve Tenant A's approval request
curl -X POST -H "Authorization: Bearer $TENANT_B_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/approvals/<tenant_a_approval_id>/approve \
  -d '{"approver_name":"Hacker"}'
# Expected: 404

# Tenant B tries to evaluate against Tenant A's agent
curl -X POST -H "Authorization: Bearer $TENANT_B_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/evaluate \
  -d '{"agent_id":"agent-001","operation":"read","target_integration":"doc","resource_scope":"*","data_classification":"public"}'
# Expected: 404 (agent not found in Tenant B)

# Tenant B tries to export Tenant A's traces
curl -H "Authorization: Bearer $TENANT_B_KEY" \
  "http://localhost:4000/api/v1/traces/export?from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z&format=csv"
# Expected: empty CSV (only headers, no Tenant A data)

# Tenant B tries to access Tenant A's webhook
curl -H "Authorization: Bearer $TENANT_B_KEY" http://localhost:4000/api/v1/webhooks
# Expected: empty array

# Tenant B tries to see Tenant A's users
curl -H "Authorization: Bearer $TENANT_B_KEY" http://localhost:4000/api/v1/users
# Expected: only Tenant B's users (or 403 if not admin)
```

### 4. RBAC Bypass Attempts

```bash
# Get a viewer session (create viewer user or change role)
VIEWER_COOKIE="<viewer_session>"
CSRF="<viewer_csrf>"

# Viewer tries to create an agent
curl -X POST http://localhost:4000/api/v1/agents \
  -H "Cookie: session=$VIEWER_COOKIE" -H "X-CSRF-Token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"name":"hacked-agent","description":"test","owner_name":"test","owner_role":"test","team":"test","authority_model":"self","identity_mode":"service_identity","delegation_model":"self","created_by":"viewer"}'
# Expected: 403

# Viewer tries to approve
curl -X POST http://localhost:4000/api/v1/approvals/<id>/approve \
  -H "Cookie: session=$VIEWER_COOKIE" -H "X-CSRF-Token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"approver_name":"Viewer Hack"}'
# Expected: 403

# Viewer tries to access settings
curl http://localhost:4000/api/v1/users \
  -H "Cookie: session=$VIEWER_COOKIE"
# Expected: 403

# Viewer tries to access API key management
curl http://localhost:4000/api/v1/api-keys \
  -H "Cookie: session=$VIEWER_COOKIE"
# Expected: 403
```

### 5. Input Validation & Injection

#### 5a: SQL Injection
```bash
API_KEY="<valid_key>"

# Agent name with SQL injection
curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"agent_id":"agent-001","operation":"read","target_integration":"x'\'' OR 1=1 --","resource_scope":"*","data_classification":"public"}'

# Search with SQL injection
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:4000/api/v1/search?q=x'%20OR%201%3D1%20--"

# Agent ID with SQL injection
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:4000/api/v1/agents/1'%20OR%20'1'%3D'1"
```
Expected: 400 or 404 — NEVER 500 or data leakage.

#### 5b: XSS in Dashboard
Open dashboard in Playwright and try:
- Create an agent with name: `<img src=x onerror=alert(1)>`
- Create a policy with rationale: `<script>document.cookie</script>`
- Approve with note: `<svg onload=alert(document.domain)>`
- Search for: `<img src=x onerror=alert(1)>`

For each: navigate to the page that displays this data and check:
- Is the HTML escaped (shows as text, not executed)?
- Does the browser console show any XSS-related errors?
- Take a screenshot of each rendered result.

#### 5c: Oversized Inputs
```bash
# 10MB body
python3 -c "print('{\"name\":\"' + 'A'*10000000 + '\"}')" | \
  curl -X POST http://localhost:4000/api/v1/agents \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d @-
# Expected: 413 or 400 (body size limit)

# Very long agent name
curl -X POST http://localhost:4000/api/v1/agents \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"$(python3 -c "print('A'*10000)")\",\"description\":\"test\",\"owner_name\":\"test\",\"owner_role\":\"test\",\"team\":\"test\",\"authority_model\":\"self\",\"identity_mode\":\"service_identity\",\"delegation_model\":\"self\",\"created_by\":\"test\"}"
# Expected: 400 (validation error)

# Invalid JSON
curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d 'not json at all'
# Expected: 400

# Empty body
curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json"
# Expected: 400
```

#### 5d: Invalid Enum Values
```bash
curl -X POST http://localhost:4000/api/v1/agents \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"test","description":"test","owner_name":"test","owner_role":"test","team":"test","authority_model":"INVALID_MODEL","identity_mode":"service_identity","delegation_model":"self","created_by":"test"}'
# Expected: 400 (validation error mentioning authority_model)

curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"agent_id":"agent-001","operation":"read","target_integration":"doc","resource_scope":"*","data_classification":"SUPER_SECRET"}'
# Expected: 400 (invalid data_classification)
```

### 6. API Key Scope Abuse

```bash
# Create a key with only 'evaluate' scope
# Then try to access other endpoints with it

NARROW_KEY="<evaluate_only_key>"

curl -H "Authorization: Bearer $NARROW_KEY" http://localhost:4000/api/v1/agents
# Expected: 403

curl -H "Authorization: Bearer $NARROW_KEY" http://localhost:4000/api/v1/policies
# Expected: 403

curl -H "Authorization: Bearer $NARROW_KEY" http://localhost:4000/api/v1/users
# Expected: 403

curl -H "Authorization: Bearer $NARROW_KEY" http://localhost:4000/api/v1/api-keys
# Expected: 403

# Evaluate should work
curl -X POST -H "Authorization: Bearer $NARROW_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/evaluate \
  -d '{"agent_id":"agent-001","operation":"read","target_integration":"document_store","resource_scope":"internal_docs","data_classification":"internal"}'
# Expected: 200
```

### 7. Rate Limit Abuse

```bash
# Rapid-fire requests to trigger rate limit
for i in $(seq 1 120); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $API_KEY" \
    http://localhost:4000/api/v1/agents)
  echo "Request $i: $CODE"
  if [ "$CODE" = "429" ]; then
    echo "Rate limited at request $i"
    # Capture the headers
    curl -s -I -H "Authorization: Bearer $API_KEY" http://localhost:4000/api/v1/agents | grep -i ratelimit
    break
  fi
done

# After hitting 429, verify that a DIFFERENT tenant is NOT affected
curl -H "Authorization: Bearer $TENANT_B_KEY" http://localhost:4000/api/v1/agents
# Expected: 200 (Tenant B's rate limit is independent)
```

### 8. Separation of Duties Bypass

```bash
# Agent owner tries to approve their own agent's request
# agent-001 owner is "Sarah Chen"

# Create an approval request
curl -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/evaluate \
  -d '{"agent_id":"agent-001","operation":"send","target_integration":"communications_service","resource_scope":"customer_emails","data_classification":"confidential"}'

APPROVAL_ID="<from_response>"

# Try to approve as Sarah Chen
curl -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/approvals/$APPROVAL_ID/approve \
  -d '{"approver_name":"Sarah Chen"}'
# Expected: 403 (separation of duties)

# Try variations of the name
curl -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/approvals/$APPROVAL_ID/approve \
  -d '{"approver_name":"sarah chen"}'
# Check: is the comparison case-sensitive? Document either way.

curl -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/approvals/$APPROVAL_ID/approve \
  -d '{"approver_name":"Sarah  Chen"}'
# Check: extra space bypass?
```

### 9. Concurrent Operations

```bash
# Double-approve: send two approve requests simultaneously
APPROVAL_ID="<pending_approval>"

curl -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/approvals/$APPROVAL_ID/approve \
  -d '{"approver_name":"Admin A"}' &

curl -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:4000/api/v1/approvals/$APPROVAL_ID/approve \
  -d '{"approver_name":"Admin B"}' &

wait
# Expected: one succeeds (200), one fails (409 conflict)
# Check: are there duplicate audit events? Is the trace state consistent?
```

### 10. Error Response Sanitization

For every 500 error you encounter during testing:
- Does the response include a stack trace? (It should NOT)
- Does the response include internal file paths? (It should NOT)
- Does the response include database connection strings? (It should NOT)
- Does the response follow the standard `{ error, message, status, request_id }` shape?

## Deliverable

Write a report to `research/stress-tests/02-security-abuse.md` with:

1. **Vulnerability matrix**: Each test with pass/fail and actual vs expected behavior
2. **Critical findings**: Anything that allows unauthorized access or data leakage
3. **Input validation gaps**: Inputs that cause 500 instead of 400
4. **XSS results**: Screenshots of each XSS attempt rendered in the dashboard
5. **Information leakage**: Any error that reveals internal details
6. **Rate limiting effectiveness**: At what point does it kick in? Is it per-tenant?
7. **Separation of duties bypass attempts**: Did any variation work?
8. **Concurrent operation results**: Any race conditions found?
9. **Screenshots**: Save to `research/stress-tests/screenshots/02/`
10. **Severity ratings**: Critical / High / Medium / Low for each finding
