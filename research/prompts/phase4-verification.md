# Phase 4 Verification — Enterprise Readiness QA Test

You are a QA tester. Your job is to verify that the Agent Identity & Approval Layer platform's enterprise features work correctly after Phase 4 completion. Do NOT write any code or modify any files. Only test and report.

## Context

Read these files first:
1. `research/2026-03-20-product-development-plan.md` — Overview, Phase 4 sections
2. `research/2026-03-21-phase3-verification-report.md` — previous test report

Phase 4 introduced:
- P4.1: RBAC (viewer/reviewer/admin roles with permission enforcement)
- P4.2: Tenant isolation (automatic tenant_id scoping on all queries)
- P4.3: API key management (CRUD, scope enforcement, rotation)
- P4.4: Rate limiting (per-tenant, per-endpoint-category, plan-based tiers)
- P4.5: Integrity hashes (hash chains on audit events, verify endpoint, audit export)
- P4.6: Settings dashboard (general, users, API keys, webhooks, audit export pages)

## Prerequisites

1. Start the database: `docker compose up db -d`
2. Run migrations: `cd apps/api && npx prisma migrate deploy`
3. Seed the database: `cd apps/api && npx prisma db seed`
4. Start the API: `cd apps/api && npm run dev` (port 4000)
5. Start the dashboard: `cd apps/dashboard && npm run dev` (port 3000)

Wait for each service to be ready.

## Test 1: Demo Script Regression

Run: `AGENT_IDENTITY_API_KEY=<key from deployment/.env.development> npx tsx scripts/demo.ts`

Verify all 3 scenarios produce correct decisions. This validates that RBAC, tenant isolation, API key scopes, and rate limiting don't break the core flow.

## Test 2: RBAC — Role Enforcement

### 2a: API-Level Enforcement

Using curl or the API directly, test with different auth contexts:

**Create test users with different roles** (if not already seeded):

```bash
# As admin, via API — create a reviewer user and a viewer user
# Or check if the seed data already includes multiple roles
```

**Viewer restrictions (test via API):**
```bash
# These should return 403:
POST /api/v1/agents (create agent)
PATCH /api/v1/agents/:id (update agent)
POST /api/v1/agents/:id/suspend
POST /api/v1/policies (create policy)
POST /api/v1/approvals/:id/approve
GET /api/v1/users
POST /api/v1/webhooks

# These should return 200:
GET /api/v1/agents
GET /api/v1/policies
GET /api/v1/approvals
GET /api/v1/traces
```

**Reviewer permissions:**
```bash
# Should work:
POST /api/v1/approvals/:id/approve
POST /api/v1/approvals/:id/deny
GET /api/v1/traces/export (if the endpoint exists)

# Should return 403:
POST /api/v1/agents
POST /api/v1/policies
GET /api/v1/users
```

### 2b: Dashboard UI Hiding

Open the dashboard as each role (if possible via dev-login with different users):
- **Viewer**: Approve/Deny buttons hidden on approval detail, no Create Policy button, no lifecycle controls on agent detail, Settings nav hidden or shows "Admin Access Required"
- **Admin**: everything visible

Take screenshots showing hidden/visible elements for different roles.

## Test 3: Tenant Isolation

### 3a: API-Level Isolation

If possible, create a second tenant (via direct DB insert or seed) and verify:
- Tenant A's API key cannot see Tenant B's agents (returns empty list, not 403)
- Tenant A cannot access Tenant B's agent by ID (returns 404, not 403)
- Creating a resource automatically sets the correct tenant_id

If creating a second tenant is not feasible with the current setup, verify by examining the Prisma queries in the API logs — every query should include a tenant_id filter.

### 3b: Cross-Tenant Security

```bash
# Using Tenant A's API key, try to access a Tenant B resource ID:
curl -H "Authorization: Bearer <tenant_a_key>" \
  http://localhost:4000/api/v1/agents/<tenant_b_agent_id>
# Expected: 404 (not 403)
```

## Test 4: API Key Management

### 4a: Dashboard UI

1. Navigate to `/dashboard/settings/api-keys`
2. Verify the seed API key is listed (showing prefix, scopes, last used)
3. Click "Create Key" — fill in name, select scopes (e.g., evaluate + traces:read)
4. Verify the raw key is shown in a copyable dialog with "won't be shown again" warning
5. Take a screenshot of the key creation dialog
6. Close the dialog — verify the key appears in the list with only the prefix visible
7. Test the new key:
   ```bash
   curl -H "Authorization: Bearer <new_key>" http://localhost:4000/api/v1/agents
   # If scopes don't include agents:read, should return 403
   curl -H "Authorization: Bearer <new_key>" -X POST http://localhost:4000/api/v1/evaluate \
     -H "Content-Type: application/json" -d '{"agent_id":"agent-001","operation":"read","target_integration":"document_store","resource_scope":"internal_docs","data_classification":"internal"}'
   # If scopes include evaluate, should return 200
   ```

### 4b: Key Rotation

1. Click "Rotate" on a key
2. Confirm in dialog
3. Verify new key shown once
4. Verify old key no longer works (401)
5. Verify new key works

### 4c: Key Deletion

1. Click delete on a key
2. Confirm
3. Verify key removed from list
4. Verify deleted key returns 401

## Test 5: Rate Limiting

```bash
# Send requests rapidly to trigger rate limit
# Free plan: 100 evaluate/min, 300 read/min, 60 write/min
# Use a loop to send >60 write requests:
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:4000/api/v1/agents \
    -H "Authorization: Bearer <api_key>" \
    -H "Content-Type: application/json" \
    -d '{"name":"test","description":"test","owner_name":"test","owner_role":"test","team":"test","authority_model":"self","identity_mode":"service_identity","delegation_model":"self","created_by":"test"}'
done
# After ~60 requests, should start getting 429
```

Verify:
- 429 response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` headers
- Health and auth endpoints are NOT rate limited
- Rate limit resets after the window expires

## Test 6: Integrity Hashes

### 6a: New Events Have Hashes

1. Run the demo script to create fresh traces
2. Fetch a trace detail: `GET /api/v1/traces/<trace_id>`
3. Verify events have `integrity_hash` field populated (non-null)

### 6b: Verify Endpoint

```bash
curl -H "Authorization: Bearer <api_key>" \
  http://localhost:4000/api/v1/traces/<trace_id>/verify
```

Expected: `{ "verified": true, "total_events": N, "verified_events": N, "broken_at": null }`

### 6c: Dashboard Integrity Badge

1. Navigate to `/dashboard/audit`
2. Select a trace created after Phase 4 deployment
3. Verify an integrity badge appears (green checkmark "Verified")
4. Take a screenshot

### 6d: Audit Export

```bash
# JSON export
curl -H "Authorization: Bearer <api_key>" \
  "http://localhost:4000/api/v1/audit/export?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z&format=json" \
  -o audit-export.json
# Verify it's valid JSON with events

# CSV export
curl -H "Authorization: Bearer <api_key>" \
  "http://localhost:4000/api/v1/audit/export?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z&format=csv" \
  -o audit-export.csv
# Verify CSV has correct columns
```

## Test 7: Settings Dashboard

### 7a: Settings Navigation

1. Navigate to `/dashboard/settings`
2. Verify settings overview page shows: workspace name, plan, stat cards
3. Verify sub-navigation: General, Users, API Keys, Webhooks, Audit Export
4. Click each sub-page — verify it loads
5. Take a screenshot of the settings overview

### 7b: General Settings

1. Navigate to `/dashboard/settings/general`
2. Verify form shows: workspace name, default approval TTL, default classification, notification email, notifications toggle
3. Change the workspace name
4. Click Save — verify toast "Settings saved"
5. Refresh page — verify the name persisted
6. Take a screenshot

### 7c: Webhook Management

1. Navigate to `/dashboard/settings/webhooks`
2. Create a webhook: URL=https://httpbin.org/post, events=approval.requested
3. Verify secret shown in copyable dialog
4. Verify webhook appears in list
5. Click "Test" — verify result shown
6. Click webhook row — verify delivery history slide-over opens
7. Take a screenshot

### 7d: Users Page

1. Navigate to `/dashboard/settings/users`
2. Verify user table shows at least the admin user
3. If possible, verify role dropdown works (change a user's role)
4. Take a screenshot

### 7e: Audit Export Page

1. Navigate to `/dashboard/settings/audit-export`
2. Verify date range picker and format selector
3. Click Download — verify file downloads
4. Take a screenshot

## Test 8: Phase 1-3 Regression

Quick pass/fail for critical functionality:

1. Agent Registry: loads, filters, search ✓/✗
2. Agent Detail: 6 sections, lifecycle controls ✓/✗
3. Policy Management: list, create, edit, test, versions ✓/✗
4. Approval Queue: pending cards, risk badges, sort, stale indicators ✓/✗
5. Approval Flow: approve from dashboard, toast, queue refreshes ✓/✗
6. Trace Viewer: list, timeline, event expansion, export ✓/✗
7. Overview Dashboard: stats, pending list, recent traces, health ✓/✗
8. Global Search: returns grouped results ✓/✗
9. Architecture Page: diagram renders ✓/✗
10. SDK auth (API key): evaluate still works ✓/✗

## Test 9: All Tests Pass

```bash
turbo test
```

Report total pass/fail counts per package.

## Deliverable

Write a test report to `research/2026-03-21-phase4-verification-report.md` with:

1. **Summary table**: Pass/fail for each of the 9 tests
2. **Screenshots** saved to `research/screenshots/phase4/`:
   - API key creation (raw key dialog)
   - Rate limit 429 response
   - Integrity badge on trace
   - Settings overview
   - General settings form
   - Webhook management
   - Users page
   - Audit export page
   - Role-based UI hiding (viewer vs admin)
3. **Bugs found**: severity, location, description, impact
4. **Regression check**: did any Phase 1-3 functionality break?
5. **Enterprise readiness assessment**: Is this platform sellable to a design partner? What's missing?
