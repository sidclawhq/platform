# Stress Test 2: Security & Abuse Testing

You are a security tester probing the live SidClaw platform at `https://api.sidclaw.com` for common vulnerabilities. Use Playwright MCP tools (mcp__playwright__*) for browser interactions and direct API calls via curl/Bash for API testing.

**Do NOT attempt destructive attacks (DoS, data deletion). Only test access controls, input validation, and information leakage. Do NOT modify any code.**

## Tests

### Test 1: Authentication Bypass

```bash
# 1a: Access API without auth
curl -s https://api.sidclaw.com/api/v1/agents
# Expected: 401

# 1b: Access with invalid API key
curl -s -H "Authorization: Bearer ai_fake_invalid_key_00000000000000" https://api.sidclaw.com/api/v1/agents
# Expected: 401

# 1c: Access with malformed auth header
curl -s -H "Authorization: InvalidFormat" https://api.sidclaw.com/api/v1/agents
# Expected: 401

# 1d: SQL injection in auth header
curl -s -H "Authorization: Bearer ' OR '1'='1" https://api.sidclaw.com/api/v1/agents
# Expected: 401 (not 500)

# 1e: Health endpoint without auth (should work)
curl -s https://api.sidclaw.com/health
# Expected: 200
```

### Test 2: Tenant Isolation

If you can create two accounts (two different emails), verify isolation:

```bash
# Sign up as User A and User B (via browser or API)
# Get API keys for both

# 2a: User A lists agents — should see only their own
curl -s -H "Authorization: Bearer <key_a>" https://api.sidclaw.com/api/v1/agents

# 2b: User B lists agents — should see only their own (different set or empty)
curl -s -H "Authorization: Bearer <key_b>" https://api.sidclaw.com/api/v1/agents

# 2c: User A tries to access User B's agent by ID
# First get User B's agent ID from their list, then:
curl -s -H "Authorization: Bearer <key_a>" https://api.sidclaw.com/api/v1/agents/<user_b_agent_id>
# Expected: 404 (NOT 403, NOT the actual agent data)

# 2d: Same for traces, policies, approvals
```

### Test 3: Input Validation

```bash
# 3a: XSS in agent name
curl -s -X POST https://api.sidclaw.com/api/v1/agents \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","description":"test","owner_name":"test","owner_role":"test","team":"test","authority_model":"self","identity_mode":"service_identity","delegation_model":"self","created_by":"test"}'
# Expected: 201 (stores escaped) or 400 (rejected). NOT executed.

# 3b: If the above succeeds, check the dashboard — does the XSS render in the agent list?

# 3c: Oversized payload
curl -s -X POST https://api.sidclaw.com/api/v1/agents \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"'$(python3 -c "print('A'*1000000)")'","description":"test","owner_name":"test","owner_role":"test","team":"test","authority_model":"self","identity_mode":"service_identity","delegation_model":"self","created_by":"test"}'
# Expected: 400 or 413 (NOT 500)

# 3d: Invalid enum values
curl -s -X POST https://api.sidclaw.com/api/v1/agents \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","description":"test","owner_name":"test","owner_role":"test","team":"test","authority_model":"INVALID_VALUE","identity_mode":"service_identity","delegation_model":"self","created_by":"test"}'
# Expected: 400 (validation error)

# 3e: Missing required fields
curl -s -X POST https://api.sidclaw.com/api/v1/agents \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
# Expected: 400 with specific field errors
```

### Test 4: CSRF Protection

1. Open `https://app.sidclaw.com` in the browser via Playwright, log in
2. From the browser console, attempt a state-changing request WITHOUT the CSRF token:

```javascript
fetch('https://api.sidclaw.com/api/v1/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ name: 'csrf-test' })
}).then(r => r.json()).then(console.log)
```

Expected: 403 (CSRF validation failed)

### Test 5: Rate Limiting

```bash
# Send 150 rapid requests to a read endpoint
for i in $(seq 1 150); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer <key>" \
    https://api.sidclaw.com/api/v1/agents)
  echo "Request $i: $STATUS"
  if [ "$STATUS" = "429" ]; then
    echo "Rate limited at request $i"
    # Check response headers
    curl -s -I -H "Authorization: Bearer <key>" https://api.sidclaw.com/api/v1/agents 2>/dev/null | grep -i "ratelimit\|retry-after"
    break
  fi
done
```

Note the plan tier and whether the limit matches expectations.

### Test 6: API Key Scope Enforcement

```bash
# Create a key with limited scopes (evaluate only)
# Then try to access endpoints outside the scope:
curl -s -H "Authorization: Bearer <limited_key>" https://api.sidclaw.com/api/v1/agents
# Expected: 403 (insufficient scope)
```

### Test 7: Information Leakage

```bash
# 7a: Error responses should not leak stack traces
curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
# Check: does the error response contain stack traces, file paths, or internal details?

# 7b: 404 responses for nonexistent resources
curl -s -H "Authorization: Bearer <key>" https://api.sidclaw.com/api/v1/agents/nonexistent-uuid
# Should say "Agent 'nonexistent-uuid' not found" — NOT reveal whether the ID exists in another tenant

# 7c: Check response headers for server info leakage
curl -s -I https://api.sidclaw.com/health
# Should NOT reveal: X-Powered-By, Server version details
```

### Test 8: Session Security

1. Open `https://app.sidclaw.com` in the browser via Playwright, log in
2. Check the session cookie:
   - Is it HttpOnly? (should be)
   - Is it Secure? (should be, since HTTPS)
   - Is it SameSite=Lax? (should be)
3. Log out — verify the session cookie is cleared
4. Try using the old session cookie (via curl with the cookie value) — should return 401

### Test 9: Integrity Hash Tampering

```bash
# Create an evaluation to generate a trace with integrity hashes
curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<agent_id>","operation":"read","target_integration":"test","resource_scope":"test","data_classification":"internal"}'

# Verify the trace
TRACE_ID=<from response>
curl -s -H "Authorization: Bearer <key>" https://api.sidclaw.com/api/v1/traces/$TRACE_ID/verify
# Expected: verified: true

# Note: we can't tamper with the database directly from outside, but verify the verify endpoint works
```

## Deliverable

Write a report to `research/stress-tests/stress-test-2-security.md` with:

1. **Summary table**: Pass/fail for each of the 9 security tests
2. **Vulnerabilities found**: severity (critical/high/medium/low), description, reproduction steps
3. **Security posture assessment**:
   - Authentication: solid/weak?
   - Authorization (RBAC + tenants): solid/weak?
   - Input validation: solid/weak?
   - Information leakage: any concerns?
   - Session management: solid/weak?
4. **Recommendations**: top 3 security improvements needed before enterprise deployment
