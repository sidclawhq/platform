# Stress Test 3: Compliance Reviewer Workflow

You are a compliance officer at a financial services firm evaluating SidClaw for FINRA 2026 compliance. Use Playwright for dashboard testing. Your job is to verify that every audit trail is complete, every approval has accountability, and every trace can be exported for regulators.

**Do NOT modify any code.** Only test and report.

## Prerequisites

1. Start all services (db, API, dashboard).
2. Seed the database.
3. Run the demo script to create some traces: `SIDCLAW_API_KEY=<key> npx tsx scripts/demo.ts`
4. Log into the dashboard.

## Scenario A: Audit Trail Completeness

### A1: Every Action Must Have a Trace

For each of these operations, perform the action and then verify a trace exists:

1. **Evaluate (allow)**: Evaluate an allowed action via API. Go to Audit page. Find the trace. Verify ALL events present:
   - trace_initiated (agent actor)
   - identity_resolved (system actor)
   - policy_evaluated (policy_engine actor)
   - operation_allowed (policy_engine actor)

   Open each event — verify description is meaningful (not generic). Verify timestamps are sequential. Verify actor names are correct.

2. **Evaluate (approval_required)**: Evaluate an action requiring approval. Find the trace. Verify events:
   - trace_initiated
   - identity_resolved
   - policy_evaluated
   - sensitive_operation_detected
   - approval_requested

   Verify the trace status is "In Progress" (not "Executed" — the agent hasn't acted yet).

3. **Approve the request**: Go to Approvals, approve the pending request with a detailed note. Return to Audit. Find the trace. Verify new events:
   - approval_granted (human_reviewer actor)

   Verify the approver name matches who approved. Verify the decision note is stored.

4. **Record outcome**: Via API, call `POST /traces/:id/outcome` with success. Return to Audit. Verify final events:
   - operation_executed
   - trace_closed

   Verify the trace status is now "Completed With Approval". Verify `completed_at` is set.

5. **Evaluate (deny)**: Evaluate a denied action. Find the trace. Verify:
   - trace_initiated
   - identity_resolved
   - policy_evaluated
   - sensitive_operation_detected
   - operation_denied
   - trace_closed

   Verify the trace status is "Blocked". Verify it was closed immediately (no lingering).

### A2: Event Ordering

For each trace you examine:
- Are events in strict chronological order?
- Do any events have the same timestamp? (Potential ordering issue)
- Is the time between events reasonable? (Not negative, not hours apart for automated steps)

### A3: No Gaps in the Chain

For a trace with approval:
- Count the events. There should be exactly 8 for a full approve flow:
  trace_initiated → identity_resolved → policy_evaluated → sensitive_operation_detected → approval_requested → approval_granted → operation_executed → trace_closed
- Are any events missing? Any extra events?

## Scenario B: Approval Accountability

### B1: Every Approval Has an Approver

Go to the Approvals page, filter by "Approved" status.
For each approved request:
- Is `approver_name` set? (Must not be null)
- Is `decided_at` set? (Must not be null)
- Is there a corresponding `approval_granted` event in the trace?
- Does the event's `actor_name` match the approval's `approver_name`?

### B2: Denied Requests Have Accountability Too

Filter by "Denied" status.
For each denied request:
- Is `approver_name` set?
- Is there a `approval_denied` event?
- Is the trace finalized as "Denied"?

### B3: Separation of Duties Evidence

Try to approve a request where you know the agent owner:
- Agent-001 owner: Sarah Chen
- Approve with approver_name "Sarah Chen"
- Verify: 403 returned, `separation_of_duties_check` set to 'fail'
- Verify: the trace does NOT show an approval_granted event (the denial was caught)

Then approve with a different name:
- Verify: `separation_of_duties_check` set to 'pass'

### B4: Expired Approvals

If any approvals have expired (check the queue):
- Is the status "Expired"?
- Is there an `approval_expired` event in the trace?
- Is the trace finalized as "Expired"?
- Was `decided_at` set when the expiry happened?

If no expired approvals exist, create one:
```bash
# Create an approval with a very short TTL policy (if possible)
# Or wait for the background job to expire one
```

## Scenario C: Trace Export for Regulators

### C1: JSON Export

1. Go to Audit page (or Settings > Audit Export)
2. Export traces as JSON for a date range that includes all traces
3. Open the downloaded file
4. Verify it contains:
   - All traces in the date range
   - All events for each trace
   - Integrity hashes on events (if implemented)
   - Timestamps in ISO 8601 format
   - Agent names, operations, outcomes

### C2: CSV Export

1. Export as CSV
2. Open in a text editor (or spreadsheet)
3. Verify columns:
   - trace_id, agent_id, agent_name, operation, target_integration, resource_scope, data_classification, final_outcome, started_at, completed_at, duration_ms, approval_required, approver_name, approval_decision, approval_decided_at, policy_rule_id, policy_version
4. Verify:
   - No missing columns
   - No extra columns
   - Dates are properly formatted
   - Commas in data are properly escaped
   - The CSV is valid (can be parsed by a CSV parser)
5. Count the rows — do they match the number of traces in the UI?

### C3: Integrity Verification

For each trace with integrity hashes:
1. Call `GET /api/v1/traces/:id/verify`
2. Verify `verified: true`
3. Check that `verified_events` count matches the actual event count

In the dashboard:
- Is there an integrity badge on traces?
- Does it show "Verified" in green?

### C4: Export Completeness

Compare the export against the dashboard:
- Does every trace in the UI appear in the export?
- Does every approval in the export have the correct approver_name?
- Do the outcomes match between UI and export?

## Scenario D: Policy Audit

### D1: Policy Rationale

Go to the Policies page. For each policy:
- Is the rationale meaningful? (Not just "required" but actually explains WHY)
- Is the rationale at least 10 characters? (API requirement)
- Does the policy specify what data classification it protects?

### D2: Policy Version History

Find a policy that has been updated (or update one yourself):
1. Click "History" on the policy card
2. Verify:
   - Previous version is shown
   - Change summary is human-readable (e.g., "effect: 'allow' → 'approval_required'")
   - Modified by and modified at are recorded
3. Can you trace exactly when and by whom a policy was changed?

### D3: Policy Test

Use the "Test Policy" feature:
1. Input an action that should be denied
2. Verify the result shows the correct deny decision with rationale
3. Input an action that should require approval
4. Verify the result shows approval_required
5. Confirm: no trace was created (this is a dry-run)

Check the trace count before and after — it should be the same.

## Scenario E: Agent Governance

### E1: Agent Lifecycle Audit

1. Suspend an agent from the detail page
2. Go to Audit — is there a `lifecycle_changed` event?
3. Try to evaluate an action for the suspended agent — does it return deny?
4. Reactivate the agent
5. Is there another `lifecycle_changed` event?
6. Evaluate again — does it work now?

### E2: Revocation Permanence

1. Create a test agent
2. Revoke it
3. Try to reactivate — does the API return 400 (invalid transition)?
4. Try to evaluate — does it return deny?
5. Is the revocation logged in the audit trail?
6. In the UI, are the lifecycle controls removed for revoked agents?

## Scenario F: FINRA Mapping Verification

Open the docs at `http://localhost:3001`.
Navigate to the FINRA 2026 compliance page.

For each FINRA requirement listed:
1. Can you demonstrate the requirement is met using the dashboard?
2. Does the feature actually work as described in the compliance page?
3. Are there any claims in the compliance docs that the product doesn't actually deliver?

Specifically verify:
- "Pre-approval of AI use cases" → can you show the agent registry with defined scope?
- "Human-in-the-loop validation" → can you show the approval flow working?
- "Audit trails" → can you show the trace export?

## Deliverable

Write a report to `research/stress-tests/03-compliance-reviewer.md` with:

1. **FINRA readiness assessment**: Would this pass a FINRA examination? What's missing?
2. **Audit trail gaps**: Any actions that don't create traces? Any traces with missing events?
3. **Accountability gaps**: Any approvals without clear approver attribution?
4. **Export quality**: Are the exports complete and accurate for regulatory submission?
5. **Integrity verification**: Do the hash chains work? Any broken chains?
6. **Policy governance**: Is there a clear record of who changed what policy and when?
7. **Separation of duties**: Is the enforcement robust or bypassable?
8. **Screenshots**: Save to `research/stress-tests/screenshots/03/` — especially the full audit trails and export samples
9. **Recommendations**: What must be added before showing this to a compliance team?
