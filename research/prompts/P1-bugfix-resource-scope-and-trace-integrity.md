# Task: Phase 1 Bugfixes — Resource Scope Mismatch & Trace Integrity

## Context

Phase 1 verification found 2 real bugs. Fix both, then re-run the demo script to verify.

Read `research/2026-03-21-phase1-verification-report.md` for the full bug descriptions.

## Bug 1: resource_scope mismatch between demo script and seed data (Critical)

**Problem:** The demo script (`scripts/demo.ts`) sends snake_case `resource_scope` values but the seeded policy rules (`apps/api/prisma/seed.ts`) use human-readable display names. The policy engine requires exact matching, so no policies match during the demo.

| Scenario | Demo sends | Seed policy has |
|----------|-----------|-----------------|
| Auto-allow | `internal_docs` | `Internal knowledge base` |
| Auto-block | `customer_pii_records` | `Customer PII records` |
| Approval flow | `customer_emails` | `Outbound customer communications` |

**Fix:** Update the seed data policy rules to use machine-readable snake_case identifiers. The SDK evaluate request should use machine-readable values, not display names. Update the `resource_scope` values in:

1. `apps/api/prisma/seed.ts` — all policy rules AND all scenario traces/events that reference resource_scope
2. Verify consistency: the `resource_scope` in policy rules must exactly match what the demo script and E2E tests send

**Updated resource_scope values for seed policies:**

| Policy | Old resource_scope | New resource_scope |
|--------|-------------------|-------------------|
| pol-001 (send, communications_service) | `Outbound customer communications` | `customer_emails` |
| pol-002 (render, template_engine) | `Approved communication templates` | `approved_templates` |
| pol-003 (read, crm_platform) | `Customer records (read-only)` | `customer_records` |
| pol-004 (export, crm_platform) | `Customer PII records` | `customer_pii_records` |
| pol-005 (read, document_store) | `Internal knowledge base` | `internal_docs` |
| pol-006 (summarize, document_store) | `Internal knowledge base` | `internal_docs` |
| pol-007 (read, policy_repository) | `Published policy documents` | `policy_documents` |
| pol-008 (read, document_store) | `Board and executive materials` | `board_materials` |
| pol-009 (update, case_management_system) | `Active case records` | `active_cases` |
| pol-010 (close, case_management_system) | `Cases with financial impact above threshold` | `high_impact_cases` |
| pol-011 (read, case_management_system) | `Legal hold case records` | `legal_hold_cases` |
| pol-012 (send, notification_service) | `Internal team notifications` | `internal_notifications` |

Also update the `resource_scope` values in:
- Seed scenario traces (trace-001 through trace-004)
- Seed scenario approval requests (approval-001, approval-002)
- Seed scenario audit event descriptions that mention the resource scope

Also update the `authorized_integrations` JSON on the seed agents — their `resource_scope` fields should match the new snake_case values.

After updating the seed data, **re-run the seed**: `cd apps/api && npx prisma db seed`

Also check `tests/e2e/helpers.ts` — the E2E test setup creates its own policy rules. Verify those use the same snake_case values the demo and SDK send. They likely already do (since they were written alongside P1.1), but confirm.

## Bug 2: recordOutcome succeeds after deny decision (Medium)

**Problem:** After a policy evaluation returns `deny` and the trace is closed with `final_outcome = 'blocked'`, calling `POST /api/v1/traces/:traceId/outcome` with `{ status: 'success' }` still succeeds and overwrites the trace to `executed`. A blocked/denied trace should not accept outcome recording.

**Location:** `apps/api/src/routes/traces.ts` — the `handleRecordOutcome` function.

**Fix:** After loading the trace, check its `final_outcome`. If it's already a terminal state (`blocked`, `denied`, `expired`), reject the request:

```typescript
// Add after loading the trace:
const terminalOutcomes = ['blocked', 'denied', 'expired'];
if (terminalOutcomes.includes(trace.final_outcome)) {
  throw new ConflictError(
    `Trace is already finalized with outcome '${trace.final_outcome}' — cannot record new outcome`
  );
}
```

This returns 409 Conflict with the standard error shape.

Also add a check for already-completed traces (`executed`, `completed_with_approval`) — recording outcome twice should also be rejected:

```typescript
const finalizedOutcomes = ['blocked', 'denied', 'expired', 'executed', 'completed_with_approval'];
if (finalizedOutcomes.includes(trace.final_outcome)) {
  throw new ConflictError(
    `Trace is already finalized with outcome '${trace.final_outcome}' — cannot record new outcome`
  );
}
```

## Verification

After both fixes:

1. Re-seed the database: `cd apps/api && npx prisma db seed`
2. Restart the API: `cd apps/api && npm run dev`
3. Run the demo script: `AGENT_IDENTITY_API_KEY=<key from deployment/.env.development> npx tsx scripts/demo.ts`
4. Verify:
   - Scenario 1 (auto-allow): `decision: allow` ✓
   - Scenario 2 (auto-block): `decision: deny` with reason referencing the explicit deny policy ✓
   - Scenario 3 (approval flow): `decision: approval_required` with `approval_request_id` ✓
   - All trace timelines print correctly
5. Run E2E tests: `npx vitest run --config tests/e2e/vitest.config.ts` — all 6 scenarios pass
6. Run API integration tests: `cd apps/api && npm test` — all pass
7. Open the dashboard and verify the approval queue still works with the seed data

## Acceptance Criteria

- [ ] Demo script produces correct decisions for all 3 scenarios
- [ ] Seed data uses snake_case resource_scope values consistently
- [ ] `POST /traces/:id/outcome` returns 409 for already-finalized traces
- [ ] E2E tests pass
- [ ] API integration tests pass
- [ ] Dashboard approval queue works with updated seed data
