# Stress Test 3: Compliance Reviewer Report

**Reviewer Role:** Compliance Officer, Financial Services Firm
**Evaluation Scope:** FINRA 2026 readiness assessment
**Date:** 2026-03-21
**Platform Version:** SidClaw (pre-release)

---

## 1. FINRA Readiness Assessment

### Would this pass a FINRA examination?

**Verdict: Conditionally ready.** The core governance primitives (Identity, Policy, Approval, Trace) are present and functional. The platform demonstrates the three capabilities FINRA 2026 requires: pre-approval of AI use cases, human-in-the-loop validation, and audit trails. However, several gaps must be addressed before a formal examination.

**What works well:**
- Complete audit event chains with 8 distinct event types covering the full lifecycle
- Separation of duties enforcement that blocks agent owners from self-approving
- Integrity hash chains (SHA-256) on all programmatically-created audit events
- Policy dry-run testing that does not create traces (confirmed: trace count unchanged)
- Immediate denial of suspended/revoked agent actions with audit trail
- Irrevocable agent revocation (400 error on reactivation attempts)

**What's missing for examination readiness:**
- Auto-allowed traces remain `in_progress` indefinitely (61 open traces observed) — no automatic closure
- JSON single-trace export omits `integrity_hash` from events
- SIEM JSON export fails on control characters in actor names (invalid JSON produced)
- CSV export row count mismatch (174 API traces vs 173 CSV rows)
- Seed-created traces have `verified_events: 0` (no integrity hashes) — legacy data gap
- No automated trace retention enforcement visible for compliance-mandated periods
- `dev-login` picks arbitrary admin user via `findFirst` — could authenticate into wrong tenant

---

## 2. Audit Trail Gaps

### Scenario A Results

#### A1.1: Evaluate (allow) — PARTIAL PASS
- **Events present:** `trace_initiated`, `identity_resolved`, `policy_evaluated`, `operation_allowed` (4 events)
- **Timestamps:** Sequential (290ms → 293ms, 1ms increments)
- **Actor names:** Correct (agent name, "Identity Service", "Policy Engine")
- **Descriptions:** Meaningful, not generic
- **Integrity hashes:** Present on all 4 events
- **FINDING:** Trace `final_outcome` remains `"in_progress"` with no `trace_closed` event. The trace is never automatically finalized. The SDK must call `POST /traces/:id/outcome` to close it. If the SDK fails or the agent crashes, the trace stays open forever. **61 open traces observed** in the system at time of testing.
- **Compliance risk:** A regulator asking "show me all completed actions" would miss these. An agent could act without a finalized audit record.

#### A1.2: Evaluate (approval_required) — PASS
- **Events present:** `trace_initiated`, `identity_resolved`, `policy_evaluated`, `sensitive_operation_detected`, `approval_requested` (5 events)
- **Trace status:** Correctly shows `"in_progress"` while awaiting approval
- **Timestamps:** Sequential (63ms → 67ms)
- **Approval request:** Linked to trace, status `"pending"`, approver fields null

#### A1.3: Approve request — PASS
- **New event created:** `approval_granted` with `actor_type: "human_reviewer"`, `actor_name: "Compliance Officer"`
- **Decision note preserved:** Full text stored in both approval record and event description
- **Separation of duties check:** `"pass"` (approver was not the agent owner)

#### A1.4: Record outcome — PASS
- **Events added:** `operation_executed` + `trace_closed` (total: 8 events)
- **Final outcome:** `"completed_with_approval"`
- **`completed_at`:** Set correctly
- **Duration:** 446,158ms (includes human review wait time — accurate)
- **Full event chain:** `trace_initiated → identity_resolved → policy_evaluated → sensitive_operation_detected → approval_requested → approval_granted → operation_executed → trace_closed`

#### A1.5: Evaluate (deny) — PASS
- **Events present:** `trace_initiated`, `identity_resolved`, `policy_evaluated`, `sensitive_operation_detected`, `operation_denied`, `trace_closed` (6 events)
- **Final outcome:** `"blocked"`
- **`completed_at`:** Set immediately (26ms total duration)
- **Trace closed automatically:** Yes — deny flows are properly finalized, unlike allow flows

### A2: Event Ordering — PASS
- All traces examined show strict chronological ordering (monotonic timestamps)
- No duplicate timestamps observed on programmatic events (1ms minimum separation enforced)
- Time between automated steps: 1-4ms (reasonable for in-process operations)
- Note: Seed-created events use 500ms intervals, which is synthetic but acceptable

### A3: Chain Completeness — PASS (for approval flow)
- Full approval flow: exactly 8 events, no gaps, no extras
- Deny flow: 6 events (correct — no approval phase)
- Allow flow: 4 events (missing `trace_closed` — see finding above)

---

## 3. Accountability Gaps

### Scenario B Results

#### B1: Every Approval Has an Approver — PASS
- Approved requests have `approver_name` set (e.g., "Compliance Officer", "Independent Reviewer")
- `decided_at` is set on all approved requests
- Corresponding `approval_granted` event exists in trace with matching `actor_name`

#### B2: Denied Requests — PASS
- Denied requests have `approver_name` set
- `approval_denied` event created with `actor_type: "human_reviewer"`
- Trace finalized correctly

#### B3: Separation of Duties — PASS
- Attempting to approve agent-001's request as "Sarah Chen" (the owner) returns:
  ```json
  {
    "error": "separation_of_duties_violation",
    "message": "Agent owner cannot self-approve (separation of duties violation)",
    "status": 403
  }
  ```
- No `approval_granted` event is created on the failed attempt
- Subsequent approval by "Independent Reviewer" succeeds with `separation_of_duties_check: "pass"`
- **The enforcement is robust** — it checks the `owner_name` field on the agent record

#### B4: Expired Approvals — NOT FULLY TESTED
- No expired approvals were observed during the test window
- The `expire-approvals` background job exists but TTL is 4+ hours on seeded policies
- Approval expiry would need longer test window or shorter TTL configuration to verify

---

## 4. Export Quality

### Scenario C Results

#### C1: JSON Export (Single Trace) — PARTIAL PASS
- Contains: all 8 events, timestamps in ISO 8601, agent names, operations, outcomes, `exported_at`
- Approval requests included with `flag_reason`, `approver_name`, `decision_note`
- **FINDING:** Event objects in export do NOT include `integrity_hash` field
  - The trace detail API (`GET /traces/:id`) includes `integrity_hash` per event
  - The export endpoint (`GET /traces/:id/export`) omits it
  - **Compliance impact:** A regulator receiving an exported trace cannot independently verify event integrity from the export alone

#### C2: CSV Bulk Export — PASS
- **Columns match specification exactly:**
  `trace_id,agent_id,agent_name,operation,target_integration,resource_scope,data_classification,final_outcome,started_at,completed_at,duration_ms,approval_required,approver_name,approval_decision,approval_decided_at,policy_rule_id,policy_version`
- Dates in ISO 8601 format
- Commas in agent names properly escaped with double-quote enclosure
- CSV is valid and parseable

#### C3: Integrity Verification — PASS
- Approval flow trace: `verified: true`, `verified_events: 8`, `broken_at: null`
- Deny trace: `verified: true`, `verified_events: 6`, `broken_at: null`
- **Note:** Seed-created traces return `verified: true` with `verified_events: 0` — this is technically correct (no hashes to verify = nothing broken) but the response is misleading. A compliance reviewer seeing "verified: true, verified_events: 0" might incorrectly assume full verification occurred.

#### C4: SIEM Export — PARTIAL FAIL
- JSON format export fails when event descriptions or actor names contain control characters (e.g., tab characters injected via stress test data: `Sarah\tChen`)
- Produces invalid JSON that cannot be parsed by standard JSON parsers
- **Compliance impact:** Automated SIEM ingestion would fail silently or reject the export
- **Note:** The control characters came from a prior security stress test injecting `\t` into `approver_name`. Normal operation would not produce these — but the platform should sanitize or reject such input at the API boundary.
- CSV format works correctly (tested separately)
- All expected fields present when export succeeds: `event_id`, `trace_id`, `agent_id`, `event_type`, `actor_type`, `actor_name`, `description`, `status`, `timestamp`, `policy_version`, `integrity_hash`
- **629 of 651 events have `integrity_hash`** — the 22 without are seed/legacy data (traces trace-001 through trace-004)

#### C5: Export Completeness — PARTIAL FAIL
- API reports 174 traces; CSV export contains 173 data rows
- **Off by 1** — likely a soft-deleted or race-condition trace
- For regulatory submission, this mismatch would raise questions

---

## 5. Integrity Verification

### Hash Chain Implementation — STRONG
- SHA-256 hash chains are computed for each event, incorporating the previous event's hash
- The `GET /traces/:traceId/verify` endpoint correctly validates the entire chain
- Trace-level `integrity_hash` is set to the final event's hash on trace closure
- Row-level locking (`SELECT ... FOR UPDATE`) prevents concurrent hash chain corruption

### Gaps
- **Legacy data has no hashes:** Seed-created events have `integrity_hash: null`. The verification endpoint returns `verified: true, verified_events: 0` for these traces. Should return a distinct status like `"no_hashes"` or `"unverifiable"`.
- **Export omits hashes:** Single-trace JSON export excludes `integrity_hash` from events. SIEM export includes them but can fail on control characters.
- **No tamper detection alerts:** If a hash chain is broken (e.g., direct DB modification), the system does not proactively alert. Verification is passive (on-demand API call only).

---

## 6. Policy Governance

### D1: Policy Rationale Quality — PASS
- All 12 seed policies have meaningful rationale (124-174 characters)
- Every rationale explains **why** the policy exists, not just **what** it does
- All policies specify a `data_classification` (internal, confidential, or restricted)
- Minimum rationale length enforced at API level (10 characters)

### D2: Policy Version History — PARTIAL PASS
- `PolicyRuleVersion` table exists with proper schema (version, change_summary, modified_by, modified_at)
- API endpoint at `GET /api/v1/policies/:id/versions` returns paginated version history
- One version history entry observed: `"priority: '200' → '150'"` with `modified_by: "Dashboard User"` and timestamp
- **Full snapshot stored:** Each version record captures the complete policy state at that point (name, operation, target, scope, classification, effect, rationale, priority, TTL)
- Change summaries are human-readable diffs
- Policies with no changes return `{"data":[], "pagination":{"total":0}}` — correct behavior
- **Gap:** Version history requires a policy to have been updated at least once. Initial creation is not recorded as a version entry. For compliance, the initial policy creation should also be a versioned record.

### D3: Policy Dry-Run Test — PASS
- `POST /api/v1/policies/test` endpoint exists and works correctly
- Returns policy effect, rule ID, rationale, and policy version
- **Confirmed:** Trace count before (174) equals trace count after (174) — no audit trail pollution from dry-run
- **All three decision types tested:** `deny` (PII export), `allow` (internal docs read), `approval_required` (customer email send) — all return correct results
- **Non-existent agent handled safely:** Returns `deny` with reason "Agent 'agent-nonexistent' not found" — no crash
- **Scope enforcement:** API keys with `evaluate` scope correctly receive 403 Forbidden on `/policies/test` — endpoint is dashboard-session-only
- Dashboard has a `PolicyTestModal` component for interactive testing

---

## 7. Separation of Duties

### Enforcement — ROBUST
- The system checks the `owner_name` field on the agent record against the `approver_name` in the approval request
- Match results in HTTP 403 with `"separation_of_duties_violation"` error
- The failed attempt does NOT create an `approval_granted` event (no false audit trail)
- A different approver can subsequently approve the same request with `separation_of_duties_check: "pass"`

### Potential Bypass Vectors (none found)
- The check is server-side, not client-side
- API key auth cannot reach the approve endpoint (requires session auth with `reviewer` or `admin` role)
- The `owner_name` comparison is case-sensitive — this is acceptable but should be documented

### Limitation
- The separation of duties check only compares `approver_name` against `owner_name`. There is no formal identity verification of the approver. In the current dev-bypass mode, anyone can claim any `approver_name`. In production, this should be tied to the authenticated session's identity.

---

## 8. Agent Governance

### E1: Agent Lifecycle Audit — PASS
- **Suspend:** `POST /agents/:id/suspend` correctly transitions to `suspended` state
- **Audit event created:** `lifecycle_changed` event with description "Agent lifecycle changed: active → suspended (suspend)" and actor "Dashboard User"
- **Lifecycle trace created:** Each lifecycle change creates its own `AuditTrace` with operation `lifecycle:suspend` or `lifecycle:reactivate`, containing the `lifecycle_changed` event with metadata capturing `previous_state` and `new_state`
- **Suspended agent evaluation:** Returns `deny` with reason "Agent 'Case Operations Agent' is suspended — all actions are denied" — blocked **before** policy evaluation (no `policy_rule_id`)
- **Reactivate:** Successfully transitions back to `active` state
- **Reactivated agent evaluation:** Returns `allow` (normal policy evaluation resumes)
- **Two lifecycle events recorded:** One for suspend, one for reactivate, both with integrity hashes

### E2: Revocation Permanence — PASS
- Revoked agent (Compliance Test Agent) returns `deny` on all evaluate attempts
- Reactivation attempt returns HTTP 400: "Cannot reactivate agent: invalid transition from 'revoked' to 'active'" with `valid_transitions: []`
- **Suspend of revoked agent also blocked** — HTTP 400 with same `invalid_lifecycle_transition` error
- Revocation event logged in audit trail with integrity hash
- **Revocation is genuinely permanent** — no state transition can undo it (state machine: `active → suspended/revoked`, `suspended → active/revoked`, `revoked → []`)

### E Gaps Identified
- **No `allowed_transitions` in API response:** The agent detail endpoint does not return valid lifecycle transitions. The client must hardcode the state machine. Consider adding this field for API-driven UIs.
- **Webhook only fires for suspend/revoke, not reactivate:** Downstream systems are not notified when a previously-suspended agent is restored.
- **Lifecycle actor is hardcoded:** All lifecycle events record `actor_name: "Dashboard User"` — a documented `TODO(P3.4)` placeholder pending real session identity.

---

## 9. Screenshots

Screenshots saved to `research/stress-tests/screenshots/03/`:

| File | Description |
|------|-------------|
| `dashboard-overview-admin-*.png` | Dashboard overview with stats, pending approvals, recent traces |
| `audit-traces-admin-*.png` | Audit trace list showing all outcome types |
| `trace-detail-full-approval-chain-*.png` | Full 8-event approval trace with integrity badge "Verified (8)" |
| `trace-detail-blocked-pii-*.png` | Blocked PII export trace detail |
| `approvals-queue-admin-*.png` | Approval queue with pending requests |
| `policies-list-admin-*.png` | Policy list showing all 12 seed policies with effects |
| `agents-registry-admin-*.png` | Agent registry showing lifecycle states |
| `finra-compliance-docs-*.png` | FINRA 2026 compliance mapping documentation page |

---

## 10. Recommendations Before Showing to a Compliance Team

### Critical (Must Fix)

1. **Auto-close allow traces.** When the policy engine returns `allow`, the trace should be finalized immediately (or within a configurable timeout). Currently, 61+ traces are stuck in `in_progress` with no `trace_closed` event. A regulator would flag this as incomplete audit coverage. Add `operation_executed` and `trace_closed` events in the evaluate endpoint for allow decisions, or implement a background job that closes stale allow traces.

2. **Include `integrity_hash` in JSON export.** The single-trace export endpoint omits integrity hashes from events. Regulators need these hashes to independently verify that audit records have not been tampered with. Add `integrity_hash` to the event select in the export query.

3. **Fix SIEM JSON export encoding.** The SIEM export produces invalid JSON when event data contains control characters (tabs, newlines). Sanitize string fields before JSON serialization, or use a JSON encoder that properly escapes all control characters.

4. **Replace dev-bypass auth with real session identity.** The `approver_name` field is currently self-reported. In a FINRA examination, an examiner would ask "how do you verify this is actually the person who approved?" The answer must be: the approver identity is derived from the authenticated session, not from user input.

### High Priority

5. **Add verification status distinction.** The integrity verification endpoint should distinguish between "verified (all hashes valid)" and "unverifiable (no hashes present)". Returning `verified: true, verified_events: 0` for legacy data is misleading.

6. **Fix CSV export completeness.** The off-by-one mismatch between API trace count and CSV rows should be investigated. Regulatory exports must be demonstrably complete.

7. **Record initial policy creation as a version entry.** Version history only captures updates, not the initial creation. For a complete compliance audit, the first version of every policy should be recorded.

8. **Add proactive integrity monitoring.** The hash chain verification is currently passive (on-demand API calls). Add a background job that periodically verifies all trace integrity and alerts on any broken chains.

### Medium Priority

9. **Implement trace retention policies.** FINRA requires records retention for defined periods. The platform should enforce configurable retention periods and prevent deletion of traces within the retention window.

10. **Add approval expiry testing.** The approval expiry background job exists but could not be verified within the test window. Consider adding a manual expiry trigger or shorter TTL options for compliance testing.

11. **Tie lifecycle events to authenticated users.** Currently lifecycle events show `actor_name: "Dashboard User"`. This should reflect the actual authenticated user who performed the action.

12. **Document the `dev-login` tenant selection bug.** The `findFirst({ where: { role: 'admin' }})` query can return an admin from any tenant, potentially authenticating users into the wrong workspace.

---

## Summary

| Category | Rating | Notes |
|----------|--------|-------|
| Audit Trail Completeness | **B+** | Strong for approval and deny flows; allow traces are not auto-closed |
| Approval Accountability | **A** | Approver attribution, SoD enforcement, decision notes all work |
| Export Quality | **B-** | CSV solid; JSON missing integrity hashes; SIEM export has encoding bug |
| Integrity Verification | **A-** | Hash chains work; legacy data handling and proactive monitoring needed |
| Policy Governance | **A-** | Rationale quality high; version history works; initial version not recorded |
| Separation of Duties | **A** | Robust enforcement; no bypass vectors found |
| Agent Governance | **A** | Lifecycle controls work; revocation is permanent; audit events generated |
| FINRA 2026 Readiness | **B** | Core capabilities present; 4 critical fixes needed before examination |
