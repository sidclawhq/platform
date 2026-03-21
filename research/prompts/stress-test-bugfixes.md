# Task: Stress Test Bugfixes — Critical & High Priority

## Context

Five parallel stress tests uncovered critical security vulnerabilities, UX blockers, and compliance gaps. Read the reports for full details:
- `research/stress-tests/01-new-user-journey.md`
- `research/stress-tests/02-security-abuse.md`
- `research/stress-tests/03-compliance-reviewer.md`
- `research/stress-tests/05-power-user-dashboard.md`

Fix all issues listed below, then run `turbo test` and verify each fix manually.

---

## CRITICAL: Security Fixes

### Fix 1: Separation of Duties Bypass via Name Normalization

**Location:** `apps/api/src/services/approval-service.ts` — the `approve` method

**Problem:** The comparison `decision.approver_name === approval.agent.owner_name` uses strict equality. An agent owner named "Sarah Chen" can bypass the check by submitting as "sarah chen", "SARAH CHEN", "Sarah  Chen" (double space), or "Sarah\tChen" (tab).

**Fix:** Create a normalize function and apply it to both sides:

```typescript
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

// In the approve method, replace:
if (decision.approver_name === approval.agent.owner_name)
// With:
if (normalizeName(decision.approver_name) === normalizeName(approval.agent.owner_name))
```

**Test:** Add integration tests:
```typescript
it('blocks approval when approver name matches owner (case insensitive)', async () => {
  // agent owner is "Sarah Chen"
  // approve as "sarah chen" → should return 403
});

it('blocks approval when approver name matches owner (extra whitespace)', async () => {
  // approve as "Sarah  Chen" → should return 403
});

it('blocks approval when approver name matches owner (tabs)', async () => {
  // approve as "Sarah\tChen" → should return 403
});

it('blocks approval when approver name matches owner (ALL CAPS)', async () => {
  // approve as "SARAH CHEN" → should return 403
});
```

### Fix 2: Double-Approve Race Condition

**Location:** `apps/api/src/services/approval-service.ts` — the `approve` and `deny` methods

**Problem:** Two simultaneous approve requests both succeed because the code reads status, checks it's "pending", then updates — a classic TOCTOU race. No database-level constraint prevents the double-write.

**Fix:** Use an atomic conditional update that only succeeds if the status is still "pending":

```typescript
// In the approve method, replace the status check + update pattern with:

async approve(approvalRequestId: string, tenantId: string, decision: ApprovalDecision) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Load approval request (for owner name check)
    const approval = await tx.approvalRequest.findFirst({
      where: { id: approvalRequestId, tenant_id: tenantId },
      include: { agent: { select: { owner_name: true, name: true } } },
    });
    if (!approval) throw new NotFoundError('ApprovalRequest', approvalRequestId);

    // 2. Separation of duties check (with normalized names)
    if (normalizeName(decision.approver_name) === normalizeName(approval.agent.owner_name)) {
      await tx.approvalRequest.update({
        where: { id: approval.id },
        data: { separation_of_duties_check: 'fail' },
      });
      throw new ForbiddenError('Agent owner cannot self-approve (separation of duties violation)');
    }

    // 3. Atomic conditional update — only succeeds if still pending
    const updated = await tx.approvalRequest.updateMany({
      where: { id: approval.id, status: 'pending' },  // THIS IS THE KEY
      data: {
        status: 'approved',
        decided_at: new Date(),
        approver_name: decision.approver_name,
        decision_note: decision.decision_note ?? null,
        separation_of_duties_check: 'pass',
      },
    });

    // 4. If no rows updated, someone else already decided
    if (updated.count === 0) {
      // Reload to get current status
      const current = await tx.approvalRequest.findUnique({ where: { id: approval.id } });
      throw new ConflictError(`Approval request is already ${current?.status ?? 'decided'}`);
    }

    // 5. Create audit event
    await tx.auditEvent.create({
      data: {
        tenant_id: tenantId,
        trace_id: approval.trace_id,
        agent_id: approval.agent_id,
        approval_request_id: approval.id,
        event_type: 'approval_granted',
        actor_type: 'human_reviewer',
        actor_name: decision.approver_name,
        description: decision.decision_note
          ? `Approved by ${decision.approver_name}: ${decision.decision_note}`
          : `Approved by ${decision.approver_name}`,
        status: 'approved',
      },
    });

    // 6. Return with context
    return this.getApprovalWithContext(approvalRequestId, tenantId, tx);
  });
}
```

Apply the same `updateMany` + `count === 0` pattern to the `deny` method.

**Test:** Add integration test:
```typescript
it('rejects concurrent double-approve with 409', async () => {
  // Create an approval request
  // Send two approve requests concurrently using Promise.all
  // Verify: exactly one succeeds (200), exactly one fails (409)
  // Verify: only one approval_granted event exists in the trace
});
```

---

## CRITICAL: UX Fixes

### Fix 3: Show API Key After Signup (BUG-13 — Persistent)

**Location:** Multiple files in `apps/dashboard/src/`

**Problem:** After signup, the API key is created but never displayed. The onboarding dialog doesn't render.

**Root cause investigation:** Check these locations in order:

1. **Signup page** (`apps/dashboard/src/app/signup/page.tsx` or similar): After successful signup API call, does the response include the raw API key? Does the code store it in `sessionStorage` before redirecting?

2. **Signup API** (`apps/api/src/routes/auth.ts`): Does the `POST /api/v1/auth/signup` response include the raw API key? Check the response shape. If it only returns user/tenant data but not the key, the key is lost.

3. **OnboardingKeyDialog** (`apps/dashboard/src/components/onboarding/OnboardingKeyDialog.tsx`): Does this component exist? Is it imported and rendered in the dashboard layout?

4. **Dashboard layout** (`apps/dashboard/src/app/dashboard/layout.tsx`): Is `<OnboardingKeyDialog />` actually rendered in the JSX?

**Fix approach:**

**Step A:** Ensure the signup API returns the raw API key in its response:
```typescript
// In the signup endpoint response:
return reply.status(201).send({
  data: {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name },
    api_key: rawKey,  // MUST be included
  }
});
```

**Step B:** In the signup page, store the key and redirect:
```typescript
// After successful signup:
const result = await response.json();
if (result.data.api_key) {
  sessionStorage.setItem('sidclaw_onboarding_api_key', result.data.api_key);
}
window.location.href = '/dashboard?onboarding=true';
```

**Step C:** Ensure OnboardingKeyDialog exists and is rendered. If the component exists but isn't in the layout, add it. If it doesn't exist, create it per the `final-bugfixes.md` prompt specification.

**Step D:** Ensure OnboardingChecklist exists and is rendered similarly.

**Verify:** Sign up with a new email → API key dialog appears → copy key → dismiss → checklist bar visible.

### Fix 4: Add "Create Agent" Button to Dashboard

**Location:** `apps/dashboard/src/app/dashboard/agents/page.tsx`

**Problem:** The Agents page has no way to create an agent from the UI. New users are stuck.

**Fix:** Add a "Register Agent" button to the agents page header that opens a creation modal.

**Create `apps/dashboard/src/components/agents/AgentCreateModal.tsx`:**

Modal with form fields:
- Name (text, required)
- Description (textarea, required)
- Owner Name (text, required)
- Owner Role (text, required)
- Team (text, required)
- Environment (dropdown: dev/test/prod, default: dev)
- Authority Model (dropdown: self/delegated/hybrid, default: self)
- Identity Mode (dropdown: service_identity/delegated_identity/hybrid_identity, default: service_identity)
- Delegation Model (dropdown: self/on_behalf_of_user/on_behalf_of_owner/mixed, default: self)
- Autonomy Tier (dropdown: low/medium/high, default: low)

**Do NOT include** authorized_integrations, credential_config, metadata, or next_review_date in the create form — these are advanced fields. Set reasonable defaults:
- `authorized_integrations: []`
- `credential_config: null`
- `metadata: null`
- `next_review_date: null`
- `created_by: <current_user_name>`

On submit: `POST /api/v1/agents` → toast success → navigate to the new agent's detail page.

**Add the button to the agents page:**
```tsx
// In the agents page header area (next to filters or above the table):
<button onClick={() => setShowCreateModal(true)}
  className="rounded bg-[hsl(var(--accent-blue))] px-4 py-2 text-sm font-medium text-white">
  Register Agent
</button>
```

Only show the button if `usePermissions().canManageAgents` is true (admin only).

### Fix 5: Handle Single-User Approval Workflow

**Location:** `apps/api/src/services/approval-service.ts` and dashboard

**Problem:** A solo developer on a free-tier workspace creates an agent, creates a policy, evaluates an action that requires approval — then can't approve it because they ARE the agent owner (separation of duties blocks them).

**Fix:** Two-part approach:

**Part A — API:** When checking separation of duties, if the tenant has only 1 user, skip the check and set `separation_of_duties_check` to `'not_applicable'` with a log warning:

```typescript
// In the approve method, before the SoD check:
const userCount = await tx.user.count({ where: { tenant_id: tenantId } });

if (userCount <= 1) {
  // Single-user workspace — separation of duties cannot be enforced
  // Allow the approval but mark as not_applicable
  // (This is acceptable for development and free-tier testing)
  separationOfDutiesCheck = 'not_applicable';
} else {
  // Multi-user workspace — enforce SoD
  if (normalizeName(decision.approver_name) === normalizeName(approval.agent.owner_name)) {
    throw new ForbiddenError('Agent owner cannot self-approve');
  }
  separationOfDutiesCheck = 'pass';
}
```

**Part B — Dashboard:** When the SoD check blocks an approval in a multi-user workspace, show a helpful message:

```
"You cannot approve this request because you are the agent's owner (separation of duties).
Ask another team member with the 'reviewer' or 'admin' role to approve it."
```

Don't just show the raw 403 error.

**Test:**
```typescript
it('allows self-approval in single-user workspace with not_applicable SoD', async () => {
  // Create tenant with 1 user who is also the agent owner
  // Evaluate → approval_required
  // Approve as the owner → should succeed
  // Verify separation_of_duties_check = 'not_applicable'
});

it('still blocks self-approval in multi-user workspace', async () => {
  // Create tenant with 2+ users
  // Agent owner tries to approve → 403
});
```

---

## CRITICAL: Compliance Fix

### Fix 6: Auto-Close Allow Traces

**Location:** `apps/api/src/routes/evaluate.ts` — the `allow` decision branch

**Problem:** When the policy engine returns `allow`, the trace is left in `in_progress` forever. The SDK is supposed to call `recordOutcome()` afterward, but if it doesn't (SDK bug, agent crash, developer forgets), the trace stays open. 61+ open traces were found in testing.

**Fix:** For `allow` decisions, auto-finalize the trace immediately:

```typescript
// In the allow branch, AFTER creating the operation_allowed event:

// Auto-close the trace for allow decisions
// The SDK can still call recordOutcome() later to record execution status,
// but the trace is considered "executed" from the governance perspective
await tx.auditTrace.update({
  where: { id: trace.id },
  data: {
    final_outcome: 'executed',
    completed_at: new Date(),
  },
});

await tx.auditEvent.create({
  data: {
    tenant_id: tenantId,
    trace_id: trace.id,
    agent_id: agent.id,
    event_type: 'trace_closed',
    actor_type: 'system',
    actor_name: 'Trace Service',
    description: 'Trace auto-closed: policy allowed action without approval',
    status: 'closed',
  },
});
```

**Update `recordOutcome()`:** The outcome endpoint should still work for allow traces — but instead of changing `in_progress` to `executed`, it should update an already-executed trace with the SDK's outcome metadata without changing the final_outcome. Modify the finalization guard:

```typescript
// In routes/traces.ts, handleRecordOutcome:
// Allow recording outcome on 'executed' traces (for allow-path metadata),
// but don't allow on 'blocked', 'denied', or 'expired'
const terminalOutcomes = ['blocked', 'denied', 'expired'];
if (terminalOutcomes.includes(trace.final_outcome)) {
  throw new ConflictError(`Trace is finalized with outcome '${trace.final_outcome}'`);
}

// For 'executed' traces, update metadata but don't change outcome
// For 'in_progress' traces (approval path), finalize normally
```

**Test:**
```typescript
it('auto-closes trace when policy allows action', async () => {
  // Evaluate an allowed action
  // Verify trace.final_outcome = 'executed' immediately
  // Verify trace_closed event exists
});

it('recordOutcome still works on auto-closed allow trace', async () => {
  // Evaluate allowed → trace auto-closed
  // Call recordOutcome with success metadata
  // Should not throw (adds metadata, doesn't re-close)
});
```

---

## HIGH: Server Hardening

### Fix 7: Add Request Body Size Limit

**Location:** `apps/api/src/server.ts` or `server-plugins.ts`

**Problem:** No body size limit — 10MB+ payloads are accepted and can cause memory exhaustion.

**Fix:** Add `bodyLimit` to Fastify server options:

```typescript
const app = Fastify({
  bodyLimit: 1_048_576,  // 1MB
  // ... other options
});
```

### Fix 8: Handle Invalid JSON Gracefully

**Location:** `apps/api/src/middleware/error-handler.ts`

**Problem:** Malformed JSON request bodies cause a 500 error instead of 400.

**Fix:** In the error handler, catch Fastify's content-type parsing errors:

```typescript
// In the error handler, add a check for JSON parse errors:
if (error.statusCode === 400 && error.message?.includes('JSON')) {
  return reply.status(400).send({
    error: 'validation_error',
    message: 'Invalid JSON in request body',
    status: 400,
    request_id: requestId,
  });
}

// Also catch SyntaxError from JSON parsing:
if (error instanceof SyntaxError && 'body' in error) {
  return reply.status(400).send({
    error: 'validation_error',
    message: 'Invalid JSON in request body',
    status: 400,
    request_id: requestId,
  });
}
```

### Fix 9: Fix "Agent Identity" Branding Remnants

**Location:** Multiple dashboard files

**Problem:** "Agent Identity" still appears in browser titles, sidebar brand text, and signup page.

**Fix:** Search and replace across the dashboard:

```bash
grep -r "Agent Identity" apps/dashboard/src/ --include="*.tsx" --include="*.ts" -l
```

Replace all occurrences with "SidClaw" (or remove if it's in a context where the brand should be implicit):
- Browser `<title>`: "SidClaw" or "SidClaw Dashboard"
- Sidebar brand text: "SidClaw"
- Signup subtitle: "Get started with SidClaw"
- Any `<meta>` tags with the old name

**Do NOT** change the product concept name "Agent Identity & Approval Layer" in places like the API swagger docs title or architecture page descriptions — that's the product description, not the brand.

### Fix 10: Fix General Settings Save

**Location:** `apps/dashboard/src/app/dashboard/settings/general/page.tsx` and/or `apps/api/src/routes/tenant.ts`

**Problem:** Saving general settings always fails. The power user test found this blocks workspace configuration entirely.

**Debug approach:**
1. Open dashboard, go to Settings > General
2. Open browser DevTools Network tab
3. Click Save Changes
4. Check: What URL is the PATCH request going to? What's the request body? What's the response status and body?

Likely causes:
- CSRF token not sent on the PATCH request
- API route not registered or wrong path
- Request body shape doesn't match what the API expects
- Tenant-scoped Prisma extension interfering with the update

Fix based on what you find.

---

## Verification

After all fixes:

```bash
# 1. Run all tests (including new ones you added)
turbo test
# Expected: all pass, including new SoD normalization + race condition tests

# 2. Security verification
# Attempt separation of duties bypass with lowercase name → should get 403
curl -X POST http://localhost:4000/api/v1/approvals/<id>/approve \
  -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \
  -d '{"approver_name":"sarah chen"}'
# Expected: 403

# 3. Race condition verification
# Send two concurrent approves → one should succeed, one should get 409
# Verify only one approval_granted event in the trace

# 4. New user journey
# Sign up with new email at /signup
# Verify: API key dialog appears
# Navigate to Agents → "Register Agent" button visible
# Create an agent via the UI
# Create a policy for the agent
# Evaluate an action → get approval_required
# Approve it (single-user workspace → should succeed)
# Check trace → should show complete event chain

# 5. Allow trace auto-close
# Evaluate an allowed action
# Check trace immediately → should be 'executed' with trace_closed event

# 6. Body limit
curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \
  -d "$(python3 -c "print('{\"x\":\"' + 'A'*2000000 + '\"}')")"
# Expected: 413 (body too large) — NOT 500

# 7. Invalid JSON
curl -X POST http://localhost:4000/api/v1/evaluate \
  -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \
  -d 'not json'
# Expected: 400 — NOT 500

# 8. Branding
grep -r "Agent Identity" apps/dashboard/src/ --include="*.tsx" --include="*.ts"
# Expected: zero results (except possibly in comments referencing the product concept)

# 9. Settings save
# Go to Settings > General, change workspace name, click Save → should succeed
```

## Acceptance Criteria

- [ ] Separation of duties: "sarah chen", "SARAH CHEN", "Sarah  Chen" all blocked when owner is "Sarah Chen"
- [ ] Race condition: concurrent double-approve → one succeeds, one gets 409, only one audit event
- [ ] API key shown after signup in a copyable dialog
- [ ] Onboarding checklist visible after signup
- [ ] "Register Agent" button on agents page (admin only)
- [ ] Agent creation modal works with reasonable defaults
- [ ] Single-user workspace can self-approve with `separation_of_duties_check: 'not_applicable'`
- [ ] Multi-user workspace still enforces separation of duties
- [ ] Allow traces auto-closed with `executed` outcome and `trace_closed` event
- [ ] `recordOutcome()` still works on auto-closed allow traces
- [ ] Request body limit: >1MB returns 413
- [ ] Invalid JSON returns 400 (not 500)
- [ ] "Agent Identity" branding replaced with "SidClaw" in all dashboard UI
- [ ] General settings save works
- [ ] All new tests pass
- [ ] `turbo test` — all existing tests still pass
