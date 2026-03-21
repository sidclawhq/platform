# Task: Phase 4 Bugfixes

## Context

Read `research/2026-03-21-phase4-verification-report.md` for full bug descriptions. Fix all 3 bugs, then run `turbo test` to verify.

## BUG-8: API Key Rotation Returns 500 (High)

**Location:** `apps/api/src/services/api-key-service.ts`, `rotate` method

**Problem:** `POST /api/v1/api-keys/:id/rotate` returns 500. The `rotate` method calls `prisma.apiKey.update()` which likely fails because the tenant-scoped Prisma extension (from P4.2) adds `tenant_id` to the `where` clause of `update`, and the `update` operation uses `{ id: keyId }` as the unique identifier — the tenant extension may be interfering with Prisma's unique constraint lookup.

**Fix approach:** Check the actual error in the server logs. The fix is likely one of:

1. Use the unscoped prisma client for the update (since the `findFirst` already verified tenant ownership):
   ```typescript
   // Already verified tenant ownership with findFirst above
   const updated = await this.prisma.apiKey.update({
     where: { id: keyId },
     data: { key_prefix: keyPrefix, key_hash: keyHash, last_used_at: null },
   });
   ```
   If the tenant extension is breaking this, the service needs to receive the base (unscoped) prisma client for update operations, or use `updateMany` which works differently with the extension.

2. Use `updateMany` instead:
   ```typescript
   await this.prisma.apiKey.updateMany({
     where: { id: keyId, tenant_id: tenantId },
     data: { key_prefix: keyPrefix, key_hash: keyHash, last_used_at: null },
   });
   // Then fetch the updated record
   const updated = await this.prisma.apiKey.findFirst({ where: { id: keyId } });
   ```

3. Check if the `key_hash` unique constraint causes issues when the extension adds `tenant_id` to the where clause — the compound where may not match the unique index.

**Verify:** After fixing, test:
```bash
# Create a key
curl -X POST http://localhost:4000/api/v1/api-keys \
  -H "Authorization: Bearer <admin_session_cookie_or_dev_bypass>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","scopes":["evaluate"]}'

# Rotate it
curl -X POST http://localhost:4000/api/v1/api-keys/<id>/rotate \
  -H "Authorization: Bearer <same_auth>"

# Should return 200 with new key
```

## BUG-9: Trace Detail API Missing integrity_hash (Medium)

**Location:** `apps/api/src/routes/traces.ts`, the `GET /api/v1/traces/:traceId` handler

**Problem:** The `select` clause for `audit_events` in the trace detail query does not include `integrity_hash`.

**Fix:** Find the `select` object for audit events in the trace detail endpoint and add `integrity_hash: true`:

```typescript
// In the trace detail query, find the audit_events select and add:
audit_events: {
  select: {
    id: true,
    event_type: true,
    actor_type: true,
    actor_name: true,
    description: true,
    status: true,
    timestamp: true,
    policy_version: true,
    approval_request_id: true,
    metadata: true,
    integrity_hash: true,    // ADD THIS
  },
  orderBy: { timestamp: 'asc' },
}
```

**Verify:** After fixing:
```bash
curl -H "Authorization: Bearer <key>" http://localhost:4000/api/v1/traces/<trace_id>
# Events should now include integrity_hash field
```

## BUG-11: SDK 429 Retry Test Timeout (Low)

**Location:** `packages/sdk/src/client/__tests__/agent-identity-client.test.ts`, the "retries on 429 rate limit" test

**Problem:** The mock 429 response doesn't include a `Retry-After` header. The SDK defaults to `parseInt(response.headers.get('Retry-After') ?? '60')` which is 60 seconds, causing the test to timeout at 5 seconds.

**Fix:** Add a `Retry-After: 0` header to the mock response in the test:

```typescript
// Find the test "retries on 429 rate limit" and update the mock:
vi.spyOn(global, 'fetch').mockResolvedValueOnce(
  new Response(JSON.stringify({ error: 'rate_limit_exceeded', message: 'Too many requests', status: 429, request_id: 'test' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '0',    // ADD THIS — immediate retry in test
    },
  })
);
```

If the SDK reads `Retry-After` differently (e.g., from response body instead of headers), check the actual implementation and adjust the mock accordingly.

## Verification

After all 3 fixes:

```bash
# Run all tests
turbo test
# Expected: 571/571 pass (or current total, all passing)

# Verify key rotation manually
# 1. Start API: cd apps/api && npm run dev
# 2. Create and rotate a key via curl
# 3. Verify old key returns 401, new key returns 200

# Verify trace detail includes integrity_hash
# 1. Run demo script to create fresh traces
# 2. GET /api/v1/traces/<id> → verify events have integrity_hash
```

## Acceptance Criteria

- [ ] API key rotation returns 200 with new key
- [ ] Old rotated key returns 401
- [ ] Trace detail API includes `integrity_hash` in event objects
- [ ] SDK 429 retry test passes within timeout
- [ ] `turbo test` — all tests pass (zero failures)
