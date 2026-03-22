# Task: Critical Bugfixes from Production Stress Tests

## Context

Five stress tests against the live production environment (`sidclaw.com`) revealed 7 critical blockers. Fix all of them, run `turbo test`, and verify locally before redeploying.

Read the full stress test reports in `research/stress-tests/` for detailed reproduction steps.

---

## BUG 1: NEXT_PUBLIC_API_URL Hardcoded to localhost in Production (Critical)

**Impact:** Entire dashboard is non-functional in production. All API calls go to `localhost:4000` instead of `api.sidclaw.com`.

**Root cause:** `NEXT_PUBLIC_API_URL` is a build-time environment variable in Next.js. The `NEXT_PUBLIC_` prefix means it's embedded in the JavaScript bundle at build time. Setting it as a Railway runtime environment variable has no effect — it needed to be present during `next build`.

**Fix:**

Update `apps/dashboard/Dockerfile` to accept the API URL as a build argument:

```dockerfile
# In the build stage, add:
ARG NEXT_PUBLIC_API_URL=https://api.sidclaw.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
```

Alternatively, switch to a runtime configuration approach so the URL doesn't need to be baked in at build time:

**Option A (simpler — build arg):** Add the ARG/ENV to the Dockerfile build stage. In `docker-compose.production.yml`, add build args:

```yaml
dashboard:
  build:
    context: .
    dockerfile: apps/dashboard/Dockerfile
    args:
      NEXT_PUBLIC_API_URL: https://api.sidclaw.com
```

**Option B (more flexible — runtime config):** Replace `NEXT_PUBLIC_API_URL` with a runtime-resolved approach:

1. Create `apps/dashboard/src/lib/config.ts`:
```typescript
export function getApiUrl(): string {
  // In browser: read from a script tag or meta tag injected at runtime
  if (typeof window !== 'undefined') {
    return (window as any).__SIDCLAW_API_URL__ ?? 'https://api.sidclaw.com';
  }
  // On server: read from env
  return process.env.API_URL ?? 'https://api.sidclaw.com';
}
```

2. Update `apps/dashboard/src/app/layout.tsx` to inject the config:
```tsx
<script dangerouslySetInnerHTML={{
  __html: `window.__SIDCLAW_API_URL__ = "${process.env.API_URL ?? 'https://api.sidclaw.com'}";`
}} />
```

3. Update `apps/dashboard/src/lib/api-client.ts` to use `getApiUrl()` instead of `process.env.NEXT_PUBLIC_API_URL`.

**Choose Option A for simplicity.** Option B is better long-term but more changes.

**Verify:** After fixing, build the dashboard and check the output:
```bash
cd apps/dashboard
NEXT_PUBLIC_API_URL=https://api.sidclaw.com npm run build
grep -r "localhost:4000" .next/ | head -5
# Should return zero results
grep -r "api.sidclaw.com" .next/ | head -5
# Should find references
```

---

## BUG 2: @sidclaw/shared Not Published to npm (Critical)

**Impact:** External developers cannot `npm install @sidclaw/sdk` because it depends on `@sidclaw/shared` which is not on npm.

**Root cause:** The SDK's `package.json` likely lists `@sidclaw/shared` as a dependency (not just a devDependency or workspace reference). When installed from npm, npm tries to fetch `@sidclaw/shared` from the registry and fails.

**Fix:** The SDK should NOT depend on `@sidclaw/shared` as an npm package. Instead, the shared types should be bundled INTO the SDK at build time.

1. In `packages/sdk/package.json`, move `@sidclaw/shared` from `dependencies` to `devDependencies` (it's only needed at build time):

```json
{
  "devDependencies": {
    "@sidclaw/shared": "workspace:*"
  }
}
```

2. In `packages/sdk/tsup.config.ts`, make sure `@sidclaw/shared` is NOT in the `external` array — tsup should bundle it:

```typescript
export default defineConfig({
  // ...
  external: [
    '@langchain/core',
    'ai',
    'openai',
    '@modelcontextprotocol/sdk',
    // DO NOT include @sidclaw/shared here — it should be bundled
  ],
  noExternal: ['@sidclaw/shared'],  // explicitly bundle it
});
```

3. Rebuild and verify:

```bash
cd packages/sdk
npm run build

# Check that shared types are bundled in dist
grep -r "DataClassification" dist/index.js | head -3
# Should find the type definitions bundled in

# Verify npm pack doesn't reference @sidclaw/shared as a dependency
npm pack --dry-run 2>&1 | head -20
node -e "const pkg = require('./package.json'); console.log('deps:', JSON.stringify(pkg.dependencies ?? {}));"
# @sidclaw/shared should NOT appear in dependencies
```

4. Test external installation:

```bash
cd /tmp && mkdir test-install && cd test-install
npm init -y
npm pack /Users/vlpetrov/Documents/Programming/agent-identity/packages/sdk
npm install sidclaw-sdk-0.1.0.tgz
node -e "const { AgentIdentityClient } = require('@sidclaw/sdk'); console.log(typeof AgentIdentityClient);"
# Should print 'function' without errors about missing @sidclaw/shared
rm -rf /tmp/test-install
```

---

## BUG 3: Separation of Duties Bypass via Name Normalization (Critical Security)

**Impact:** An agent owner can bypass the self-approval check by varying the case or whitespace of their name. `"sarah chen"` bypasses the check against `"Sarah Chen"`.

**Location:** `apps/api/src/services/approval-service.ts`, the `approve` method.

**Current code (broken):**
```typescript
if (decision.approver_name === approval.agent.owner_name) {
  // separation of duties violation
}
```

**Fix:** Normalize both names before comparison:

```typescript
function normalizeForComparison(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

// In the approve method:
if (normalizeForComparison(decision.approver_name) === normalizeForComparison(approval.agent.owner_name)) {
  await tx.approvalRequest.update({
    where: { id: approval.id },
    data: { separation_of_duties_check: 'fail' },
  });
  throw new ForbiddenError('Agent owner cannot self-approve (separation of duties violation)');
}
```

**Add tests:**

```typescript
// In apps/api/src/__tests__/integration/approvals.test.ts or a new test file:
describe('Separation of duties - name normalization', () => {
  it('rejects exact match: "Sarah Chen" vs "Sarah Chen"');
  it('rejects case variation: "sarah chen" vs "Sarah Chen"');
  it('rejects case variation: "SARAH CHEN" vs "Sarah Chen"');
  it('rejects whitespace variation: "Sarah  Chen" vs "Sarah Chen"');
  it('rejects tab variation: "Sarah\\tChen" vs "Sarah Chen"');
  it('rejects leading/trailing whitespace: " Sarah Chen " vs "Sarah Chen"');
  it('allows different names: "Jane Doe" vs "Sarah Chen"');
});
```

---

## BUG 4: Double-Approve Race Condition (Critical Security)

**Impact:** Two simultaneous approval requests for the same pending approval both succeed. The approval is processed twice, potentially allowing double execution.

**Location:** `apps/api/src/services/approval-service.ts`, the `approve` and `deny` methods.

**Root cause:** The check `if (approval.status !== 'pending')` and the `update` are not atomic. Between the check and the update, another request can also pass the check.

**Fix:** Use Prisma's `update` with a `where` clause that includes the status check, making it atomic:

```typescript
async approve(approvalRequestId: string, tenantId: string, decision: ApprovalDecision) {
  return this.prisma.$transaction(async (tx) => {
    // Lock the row and verify it's still pending in one atomic operation
    // Use updateMany with a status condition — returns count of updated rows
    const result = await tx.approvalRequest.updateMany({
      where: {
        id: approvalRequestId,
        tenant_id: tenantId,
        status: 'pending',  // Only update if STILL pending
      },
      data: {
        status: 'approved',
        decided_at: new Date(),
        approver_name: decision.approver_name,
        decision_note: decision.decision_note ?? null,
        separation_of_duties_check: 'pass',
      },
    });

    // If no rows were updated, the approval was already decided
    if (result.count === 0) {
      // Check if it exists at all
      const existing = await tx.approvalRequest.findFirst({
        where: { id: approvalRequestId, tenant_id: tenantId },
      });
      if (!existing) throw new NotFoundError('ApprovalRequest', approvalRequestId);
      throw new ConflictError(`Approval request is already ${existing.status}`);
    }

    // Load the full approval for separation of duties check and response
    const approval = await tx.approvalRequest.findFirst({
      where: { id: approvalRequestId },
      include: { agent: { select: { owner_name: true, name: true } } },
    });

    // Separation of duties check (AFTER the atomic update to prevent race)
    // If the check fails, roll back by setting status back to pending
    if (normalizeForComparison(decision.approver_name) === normalizeForComparison(approval!.agent.owner_name)) {
      await tx.approvalRequest.update({
        where: { id: approvalRequestId },
        data: { status: 'pending', decided_at: null, approver_name: null, decision_note: null, separation_of_duties_check: 'fail' },
      });
      throw new ForbiddenError('Agent owner cannot self-approve (separation of duties violation)');
    }

    // Create audit event, etc. (rest of the existing logic)
    // ...
  });
}
```

**Alternative approach** (simpler, using SELECT FOR UPDATE):

```typescript
// At the start of the transaction, lock the row:
const [locked] = await tx.$queryRaw<Array<{ id: string; status: string }>>`
  SELECT id, status FROM "ApprovalRequest"
  WHERE id = ${approvalRequestId} AND tenant_id = ${tenantId}
  FOR UPDATE
`;

if (!locked) throw new NotFoundError('ApprovalRequest', approvalRequestId);
if (locked.status !== 'pending') throw new ConflictError(`Approval request is already ${locked.status}`);

// Now safe to proceed — the row is locked until transaction commits
```

Use whichever approach fits better with the existing code structure. The key requirement is that two concurrent approve requests for the same approval CANNOT both succeed.

**Add a test:**

```typescript
it('rejects concurrent double-approval (race condition)', async () => {
  // Create an approval request
  const evaluation = await evaluateForApproval();

  // Send two approvals simultaneously
  const [result1, result2] = await Promise.all([
    app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evaluation.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Reviewer A' },
    }),
    app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evaluation.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Reviewer B' },
    }),
  ]);

  // Exactly one should succeed (200), the other should fail (409)
  const statuses = [result1.statusCode, result2.statusCode].sort();
  expect(statuses).toEqual([200, 409]);
});
```

---

## BUG 5: No "Create Agent" Button in Dashboard (Critical UX)

**Impact:** Users cannot register agents from the dashboard. The entire agent setup must be done via API.

**Location:** `apps/dashboard/src/app/dashboard/agents/page.tsx`

**Fix:** Add a "Register Agent" button to the agents page that opens a creation modal.

1. Create `apps/dashboard/src/components/agents/AgentCreateModal.tsx`:

A modal form with fields matching `POST /api/v1/agents`:
- Name (required)
- Description (required)
- Owner Name (required)
- Owner Role (required)
- Team (required)
- Environment (dropdown: dev/test/prod, default: dev)
- Authority Model (dropdown: self/delegated/hybrid, default: self)
- Identity Mode (dropdown, default: service_identity)
- Delegation Model (dropdown, default: self)
- Autonomy Tier (dropdown: low/medium/high, default: low)

Use the same modal/form styling as `PolicyEditorModal.tsx`.

On submit: `POST /api/v1/agents` → toast "Agent registered" → navigate to agent detail page.

2. Add the button to `apps/dashboard/src/app/dashboard/agents/page.tsx`:

```tsx
// In the page header area (next to the title "Agents"):
import { usePermissions } from '@/lib/permissions';

const { canManageAgents } = usePermissions();

// In JSX:
{canManageAgents && (
  <button onClick={() => setShowCreateModal(true)} className="bg-accent-blue text-white px-4 py-2 rounded text-sm font-medium">
    Register Agent
  </button>
)}
```

The button should only be visible to admins (per RBAC).

---

## BUG 6: API Key Never Shown After Signup (Critical UX)

**Impact:** After signup, the API key is created and hashed but never displayed to the user. They have no way to get their SDK credential.

**Location:** The signup flow — either `apps/api/src/routes/auth.ts` (signup endpoint) or `apps/dashboard/src/app/signup/page.tsx` (client-side handler).

**Fix:** There are two parts:

**Part A — API must return the raw key in the signup response:**

In the signup endpoint (`POST /api/v1/auth/signup` or the OAuth callback that provisions a new user), verify the response includes the raw API key:

```typescript
// In the provisioning function:
const rawKey = 'ai_' + randomBytes(32).toString('hex');
// ... create API key with hash ...

// Return in response:
return { user, tenant, api_key: rawKey };
```

Check the actual signup response shape — does it include `api_key`? If not, add it.

**Part B — Dashboard must store and display the key:**

In the signup page handler (after successful signup):

```typescript
// After successful signup response:
const result = await response.json();
if (result.api_key) {
  sessionStorage.setItem('sidclaw_onboarding_api_key', result.api_key);
}
// Redirect to /dashboard?onboarding=true
window.location.href = '/dashboard?onboarding=true';
```

Then the `OnboardingKeyDialog` component (from the final-bugfixes prompt) reads it from sessionStorage and displays it.

**Verify the OnboardingKeyDialog component exists and works.** If it was created in the previous bugfix round, verify it reads from `sessionStorage` correctly. If it doesn't exist, create it (see the previous `final-bugfixes.md` prompt for the full component code).

---

## BUG 7: No Rate Limiting in Production (Critical Security)

**Impact:** Production API has no rate limiting. Enables brute-force attacks, credential stuffing, and resource exhaustion.

**Root cause:** The rate limiting middleware may be disabled in production, or the in-memory rate limiter state is not being initialized.

**Investigate:**

1. Check `apps/api/src/middleware/rate-limit.ts` — does the middleware exist?
2. Check `apps/api/src/server-plugins.ts` — is the rate limit plugin registered?
3. Check the config — is `RATE_LIMIT_ENABLED` set to `true` in the Railway environment variables?
4. Check the middleware code — is there a `if (process.env.RATE_LIMIT_ENABLED === 'false') return;` guard that's matching incorrectly?

**Common cause:** The env var check might be `process.env.RATE_LIMIT_ENABLED === 'false'` but Railway might not set the variable at all, making it `undefined`. In that case, the check passes (undefined !== 'false') and rate limiting should work. OR the middleware might not be registered at all.

**Fix:** Ensure the rate limit middleware:
1. Is imported and registered in `server-plugins.ts`
2. Defaults to ENABLED when the env var is not set
3. Uses the correct condition: `if (config.rateLimitEnabled === false) return;` (not string comparison)

```typescript
// The check should be:
if (process.env.NODE_ENV === 'test') return; // Skip in tests
// Rate limiting is ON by default — only skip if explicitly disabled
if (process.env.RATE_LIMIT_ENABLED === 'false') return;
```

**Verify locally:**
```bash
# Start API with rate limiting enabled
RATE_LIMIT_ENABLED=true npm run dev

# Hit an endpoint rapidly
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer <key>" \
    http://localhost:4000/api/v1/agents
done
# Should see 429 after ~60 requests (free plan write limit) or ~300 (read limit)
```

After deploying, verify in production:
```bash
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer <key>" \
    https://api.sidclaw.com/api/v1/agents
done
```

---

## Verification After All Fixes

```bash
# 1. Run all tests
turbo test
# Expected: all pass, zero failures

# 2. Build dashboard with production API URL
cd apps/dashboard
NEXT_PUBLIC_API_URL=https://api.sidclaw.com npm run build
grep -r "localhost:4000" .next/ | head -5
# Should return zero results

# 3. Test SDK installation from local pack
cd packages/sdk && npm run build && npm pack
cd /tmp && mkdir verify && cd verify
npm init -y
npm install /Users/vlpetrov/Documents/Programming/agent-identity/packages/sdk/sidclaw-sdk-*.tgz
node -e "const { AgentIdentityClient } = require('@sidclaw/sdk'); console.log('OK:', typeof AgentIdentityClient);"
rm -rf /tmp/verify

# 4. Test separation of duties normalization
# (covered by new integration tests)

# 5. Test double-approve race condition
# (covered by new integration test)

# 6. Verify Create Agent button exists in dashboard
cd apps/dashboard && npm run dev
# Open http://localhost:3000/dashboard/agents — "Register Agent" button should be visible

# 7. Verify rate limiting works
RATE_LIMIT_ENABLED=true cd apps/api && npm run dev
# Run rapid requests as shown above
```

## Acceptance Criteria

- [ ] Dashboard in production uses `api.sidclaw.com` (not `localhost:4000`)
- [ ] `npm install @sidclaw/sdk` works from a clean directory (no `@sidclaw/shared` dependency error)
- [ ] Separation of duties rejects: `"sarah chen"`, `"SARAH CHEN"`, `"Sarah  Chen"`, `" Sarah Chen "` against `"Sarah Chen"`
- [ ] Two concurrent approve requests: exactly one succeeds (200), the other fails (409)
- [ ] "Register Agent" button visible on agents page (admin only)
- [ ] Agent creation modal works: fill form → submit → agent created → navigate to detail
- [ ] API key shown to user after signup (via onboarding dialog)
- [ ] Rate limiting active in production: 429 returned after exceeding plan limits
- [ ] All existing tests still pass
- [ ] New tests added for separation of duties normalization and race condition

## After Fixing — Redeploy

After all fixes pass locally:

1. Commit and push to `github.com/sidclawhq/platform`
2. Railway will auto-deploy from the push (if configured), or trigger manual deploy
3. For the dashboard: ensure the build uses `NEXT_PUBLIC_API_URL=https://api.sidclaw.com` as a build arg
4. Republish the SDK: `cd packages/sdk && npm version 0.1.1 && npm publish --access public`
5. Run the stress tests again to verify production fixes
