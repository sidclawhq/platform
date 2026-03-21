# Phase 3 Verification — Comprehensive QA Test

You are a QA tester. Your job is to verify that the Agent Identity & Approval Layer platform works end-to-end after Phase 3 completion. Do NOT write any code or modify any files. Only test and report.

## Context

Read these files first:
1. `research/2026-03-20-product-development-plan.md` — Overview, Phase 3 sections
2. `research/2026-03-21-phase2-verification-report.md` — previous test report (Phase 2 baseline)
3. `research/2026-03-21-phase1-verification-report.md` — Phase 1 report (for regression tracking)

Phase 3 introduced:
- P3.1: MCP governance middleware (in SDK)
- P3.2: Framework wrappers (LangChain, OpenAI, Vercel AI, CrewAI, generic)
- P3.3: Webhook delivery system (API + background job + SDK verification)
- P3.4: OIDC authentication (replaces dev bypass with session cookies + CSRF + dev-login fallback)
- P3.5: SDK package (publish-ready, dual CJS/ESM, subpath exports)
- P3.6: Approval email notifications

## Prerequisites — Start Services

1. Start the database: `docker compose up db -d`
2. Run migrations: `cd apps/api && npx prisma migrate deploy`
3. Seed the database: `cd apps/api && npx prisma db seed`
4. Start the API: `cd apps/api && npm run dev` (port 4000)
5. Start the dashboard: `cd apps/dashboard && npm run dev` (port 3000)

Wait for each service to be ready.

**IMPORTANT — Authentication change:** Phase 3 replaced the `X-Dev-Bypass` header with session-based auth. If OIDC is not configured, the API should have a development fallback (`/api/v1/auth/dev-login`). Verify this works before testing the dashboard.

## Test 1: Authentication — Dev Login Fallback

Since we don't have an OIDC provider configured:

1. Open `http://localhost:3000/dashboard` in Playwright
2. The dashboard should redirect to a login page (or auto-login via dev fallback)
3. Verify the login flow completes and you reach the dashboard
4. Verify `GET http://localhost:4000/api/v1/auth/me` returns user info (use the session cookie from the browser)
5. Verify the dashboard header shows a user name and avatar
6. Take a screenshot of the login page (if visible) and the authenticated dashboard

**If dev-login is automatic:** Verify the console shows a warning like "Using development auth bypass"

**If dev-login requires a click:** Document the flow

## Test 2: Authentication — Session Behavior

1. Verify the dashboard works with the session cookie (pages load, data displays)
2. Test logout: click the logout button → verify redirect to login page → verify session cookie is cleared
3. Log back in
4. Verify API key auth still works independently: `curl -H "Authorization: Bearer <api_key>" http://localhost:4000/api/v1/agents` (use key from `deployment/.env.development`)
5. Take a screenshot showing the user avatar/name in the header

## Test 3: CSRF Protection

1. From the browser console (or via Playwright), attempt a POST request to the API without the CSRF token header:
   ```javascript
   fetch('http://localhost:4000/api/v1/agents', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'include',
     body: JSON.stringify({ name: 'test' })
   }).then(r => console.log(r.status))
   ```
2. This should return 403 (CSRF validation failed)
3. Verify that normal dashboard operations (approve, create policy, etc.) work correctly — they should include the CSRF token automatically

## Test 4: Demo Script (Regression)

Run: `AGENT_IDENTITY_API_KEY=<key> npx tsx scripts/demo.ts`

Verify all 3 scenarios still produce correct decisions:
- Scenario 1 (auto-allow): `decision: allow`
- Scenario 2 (auto-block): `decision: deny` with policy reason
- Scenario 3 (approval flow): `decision: approval_required`, auto-approved, trace complete

**Note:** The demo script uses API key auth (not session auth), so it should work unchanged.

## Test 5: Phase 2 Dashboard Regression

Run through the critical Phase 2 functionality to verify nothing broke:

1. **Agent Registry** (`/dashboard/agents`): loads, filters work, 3 agents visible
2. **Agent Detail** (`/dashboard/agents/agent-001`): all 6 sections render, lifecycle controls work (suspend/reactivate)
3. **Policy List** (`/dashboard/policies`): policies grouped by agent, effect badges correct
4. **Approval Queue** (`/dashboard/approvals`): pending approvals visible, risk badges shown, stale indicators, sort dropdown
5. **Trace Viewer** (`/dashboard/audit`): traces load, event timeline renders, export buttons present
6. **Overview** (`/dashboard`): stat cards, pending list, system health green
7. **Architecture** (`/dashboard/architecture`): diagram renders
8. **Global Search**: type "customer" → results appear

Take screenshots of any failures. Brief pass/fail for each.

## Test 6: Approval Flow with Real User Name

1. Navigate to `/dashboard/approvals`
2. Click a pending approval
3. In the detail panel, type a note and click Approve
4. Verify the approval's `approver_name` is the authenticated user's name (not "Dashboard User")
5. Navigate to the trace viewer and find the approved trace
6. Verify the `approval_granted` event shows the real user name as the actor
7. Take a screenshot of the approval event showing the real user name

## Test 7: Webhook System

### 7a: Webhook CRUD via API

```bash
# Create a webhook endpoint (use a test URL — httpbin or similar)
curl -X POST http://localhost:4000/api/v1/webhooks \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://httpbin.org/post","events":["approval.requested","approval.approved"],"description":"Test webhook"}'

# Verify response includes secret (shown only once)
# Save the webhook ID and secret

# List webhooks — verify secret is NOT included
curl http://localhost:4000/api/v1/webhooks -H "Authorization: Bearer <api_key>"

# Test the webhook
curl -X POST http://localhost:4000/api/v1/webhooks/<id>/test -H "Authorization: Bearer <api_key>"
```

### 7b: Webhook Dispatch

1. Create a webhook endpoint subscribed to `approval.requested`
2. Trigger an evaluation that requires approval (via demo script or curl)
3. Check webhook delivery history: `GET /api/v1/webhooks/<id>/deliveries`
4. Verify a delivery was created with status `pending` or `delivered`
5. If using httpbin: verify the payload was received with correct signature header

### 7c: SDK Webhook Verification

Run a quick Node script to test signature verification:

```bash
node -e "
const { verifyWebhookSignature } = require('./packages/sdk/dist/webhooks/index.cjs');
const crypto = require('crypto');
const secret = 'test-secret';
const payload = JSON.stringify({ event: 'test' });
const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('Valid:', verifyWebhookSignature(payload, signature, secret));
console.log('Invalid:', verifyWebhookSignature(payload, 'sha256=wrong', secret));
"
```

Expected: `Valid: true`, `Invalid: false`

## Test 8: SDK Package

### 8a: Build Verification

```bash
cd packages/sdk
npm run build

# Verify output files exist
ls dist/index.js dist/index.cjs dist/index.d.ts
ls dist/mcp/index.js dist/mcp/index.cjs
ls dist/middleware/langchain.js dist/middleware/vercel-ai.js dist/middleware/openai-agents.js
ls dist/webhooks/index.js dist/webhooks/index.cjs

# Check bundle size
du -sh dist/

# Verify npm pack contents
npm pack --dry-run 2>&1 | head -30
```

### 8b: Import Verification

```bash
# Test CJS imports
node -e "const { AgentIdentityClient } = require('./packages/sdk/dist/index.cjs'); console.log('CJS main:', typeof AgentIdentityClient);"
node -e "const { verifyWebhookSignature } = require('./packages/sdk/dist/webhooks/index.cjs'); console.log('CJS webhooks:', typeof verifyWebhookSignature);"

# Test ESM imports (if Node supports it in this project)
node --input-type=module -e "import { AgentIdentityClient } from './packages/sdk/dist/index.js'; console.log('ESM main:', typeof AgentIdentityClient);"
```

### 8c: README

Verify `packages/sdk/README.md` exists and contains: Quick Start, MCP section, LangChain section, Vercel AI section, Webhook verification section.

## Test 9: MCP Middleware (Unit-Level Verification)

The MCP middleware can't easily be tested end-to-end without an MCP client, but verify the build and exports:

```bash
node -e "const { GovernanceMCPServer } = require('./packages/sdk/dist/mcp/index.cjs'); console.log('MCP export:', typeof GovernanceMCPServer);"
```

Verify the class exists and can be instantiated (it will fail to connect without an upstream server, but the constructor should work):

```bash
node -e "
const { GovernanceMCPServer, AgentIdentityClient } = require('./packages/sdk/dist/index.cjs');
const client = new AgentIdentityClient({ apiKey: 'test', apiUrl: 'http://localhost:4000', agentId: 'test' });
console.log('Client created:', typeof client.evaluate);
// Don't start the server — just verify the class exists
console.log('GovernanceMCPServer:', typeof GovernanceMCPServer);
"
```

## Test 10: Framework Wrappers (Export Verification)

Verify all framework wrappers are exported correctly:

```bash
node -e "
const sdk = require('./packages/sdk/dist/index.cjs');
console.log('withGovernance:', typeof sdk.withGovernance);
console.log('governTool:', typeof sdk.governTool);
console.log('governTools:', typeof sdk.governTools);
console.log('governVercelTool:', typeof sdk.governVercelTool);
console.log('governOpenAITool:', typeof sdk.governOpenAITool);
console.log('governCrewAITool:', typeof sdk.governCrewAITool);
console.log('governObject:', typeof sdk.governObject);
console.log('ActionDeniedError:', typeof sdk.ActionDeniedError);
console.log('ApprovalTimeoutError:', typeof sdk.ApprovalTimeoutError);
console.log('verifyWebhookSignature:', typeof sdk.verifyWebhookSignature);
"
```

All should print `function` (or `[Function: ...]`).

## Test 11: Email Notifications

Since we likely don't have Resend configured:

1. Check the API server console output during an approval request creation
2. It should log something like: `[Email] Would send to admin@example.com: [Approval Required] Customer Communications Agent: send → communications_service`
3. If EMAIL_API_KEY is not set, the email service should gracefully degrade to console logging
4. Verify the evaluate endpoint still returns correct results regardless of email status

## Test 12: Background Jobs

1. Check the API console for job runner output — it should show:
   - `Job runner started: expire_approvals, trace_cleanup, webhook_delivery, session_cleanup`
   - Periodic job execution logs
2. Verify the health endpoint includes background job health:
   ```bash
   curl http://localhost:4000/health
   ```
   The `system_health.background_jobs` should be `healthy` (not `stale`)

## Test 13: All Tests Pass

Run the full test suite:

```bash
# Unit + integration tests
turbo test

# E2E tests (if API is running)
npx vitest run --config tests/e2e/vitest.config.ts
```

Report pass/fail counts for each package.

## Deliverable

Write a test report to `research/2026-03-21-phase3-verification-report.md` with:

1. **Summary table**: Pass/fail for each of the 13 tests
2. **Screenshots** saved to `research/screenshots/phase3/` directory:
   - Login page (if visible)
   - Authenticated dashboard with user name in header
   - Approval with real user name
   - Webhook creation response
   - SDK build output
3. **Bugs found**: severity (critical/medium/low), location, description, impact
4. **Regression check**: did any Phase 1 or Phase 2 functionality break?
5. **Authentication assessment**: does the dev-login fallback work smoothly? Any friction?
6. **Design assessment**: is the "Institutional Calm" aesthetic maintained on the login page and any new UI elements?
7. **SDK assessment**: are all exports correct? Bundle size reasonable? README complete?
