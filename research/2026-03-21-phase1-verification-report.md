# Phase 1 Verification Report

**Date:** 2026-03-21
**Tester:** QA (automated via Playwright + manual API testing)
**Environment:** Local dev — Docker Compose (PostgreSQL), API on :4000, Dashboard on :3000

---

## Summary

| Test | Result | Notes |
|------|--------|-------|
| Test 1: Demo Script | **FAIL** | Policy engine does not match any rules — all 3 scenarios produce wrong decisions |
| Test 2: Approval Queue | **PASS** | Page loads, dark theme correct, pending cards visible, detail panel with amber "Why This Was Flagged" |
| Test 3: Approve an Item | **PASS** | Reviewer note accepted, approval succeeds, toast notification appears, queue refreshes |
| Test 4: Trace Viewer | **PASS** (with bug) | Trace list, event timeline, colored dots, approval_granted event all visible. Bug: trace outcome not updated after approval |
| Test 5: Overview | **PASS** | Overview loads, API connection shows green "connected" |

**Overall: 4/5 PASS, 1 FAIL**

---

## Test 1: Demo Script

**Command:** `AGENT_IDENTITY_API_KEY=<key> npx tsx scripts/demo.ts`

**Result: FAIL**

The script ran without crashing, but all 3 scenarios returned incorrect policy decisions:

### Scenario 1: Auto-Allow (Read Internal Documents)
- **Expected:** `decision: allow` (agent-002 reads internal docs, policy pol-005 should allow)
- **Actual:** `decision: deny` — "No policy rule matches this action — denied by default (secure by default)"

### Scenario 2: Auto-Block (Export Customer PII)
- **Expected:** `decision: deny` with reason referencing the deny policy (pol-004)
- **Actual:** `decision: deny` — but for wrong reason ("no matching policy" instead of matching the explicit deny rule)

### Scenario 3: Approval Flow (Send Customer Email)
- **Expected:** `decision: approval_required` with a valid `approval_request_id`
- **Actual:** `decision: deny`, `approval_request_id: null` — approval flow completely broken

### Root Cause

**`resource_scope` field mismatch** between the demo script and seeded policy rules:

| Scenario | Demo sends | Seed policy expects |
|----------|-----------|-------------------|
| 1 (allow) | `internal_docs` | `Internal knowledge base` |
| 2 (block) | `customer_pii_records` | `Customer PII records` |
| 3 (approval) | `customer_emails` | `Outbound customer communications` |

The policy engine uses exact string matching on `resource_scope`. The demo script uses snake_case identifiers while the seeded policies use human-readable display names with spaces and capitalization. No wildcard matching is configured for these rules.

### Additional Bug: Trace Integrity

After receiving a `deny` decision, `client.recordOutcome()` still succeeds and overwrites the trace outcome from `blocked` to `executed`. A denied action should not be recordable as "success" — this is a trace integrity issue.

---

## Test 2: Dashboard — Approval Queue

**URL:** `http://localhost:3000/dashboard/approvals`

**Result: PASS**

All criteria verified:

- **Dark theme**: Background is `#0A0A0B` (correct near-black from design tokens)
- **Pending approval cards**: 2 cards visible from seed data:
  - `send -> communications_service` (Customer Communications Agent)
  - `close -> case_management_system` (Case Operations Agent)
- **Detail panel**: Opens on card click with full context:
  - Request summary (operation, integration, scope, classification)
  - Authority context (Sarah Chen, Hybrid authority, On Behalf Of Owner)
  - "Why This Was Flagged" section with amber styling
  - Context snapshot
  - Trace timeline (5 events from seed data)
  - Governance metadata (trace ID, policy version, timestamps)
  - Reviewer action buttons (Approve / Deny)
- **Amber styling**: "Why This Was Flagged" section has `border-l-4 border-l-accent-amber` with `rgb(245, 158, 11)` = `#F59E0B` (exact design token value)

**Screenshots:**
- `screenshots/approvals-queue-initial-2026-03-21T08-32-37-195Z.png` — Queue with 2 pending cards
- `screenshots/approval-detail-panel-large-2026-03-21T08-32-58-050Z.png` — Detail panel open
- `screenshots/approval-detail-buttons-2026-03-21T08-34-19-981Z.png` — Scrolled to show Approve/Deny buttons

---

## Test 3: Dashboard — Approve an Item

**Result: PASS**

Steps completed:
1. Typed reviewer note: "Verified customer context. Communication approved for sending."
2. Clicked "Approve" button
3. Toast notification appeared: green checkmark with "Approved" text (bottom-right)
4. Queue refreshed: approved item disappeared, only 1 pending item remains (`close -> case_management_system`)

**Screenshots:**
- `screenshots/approval-note-filled-2026-03-21T08-34-30-730Z.png` — Note filled in before approval
- `screenshots/after-approval-2026-03-21T08-34-39-776Z.png` — Queue after approval with toast visible

---

## Test 4: Dashboard — Trace Viewer

**URL:** `http://localhost:3000/dashboard/audit`

**Result: PASS (with bug)**

All visual/functional criteria met:
- **Trace list** on the left shows 7 traces (4 from seed + 3 from demo script)
- **Click on a trace** opens the event timeline on the right
- **Events in chronological order** with colored dots:
  - Gray (`#71717A`) — Trace Initiated, Identity Resolved
  - Blue (`#3B82F6`) — Policy Evaluated, Sensitive Operation Detected
  - Amber (`#F59E0B`) — Approval Requested, Approval Granted
- **Approved trace** (trace-001, send -> communications_service) shows full event sequence:
  1. Trace Initiated (15:30:00)
  2. Identity Resolved (15:30:00.500)
  3. Policy Evaluated (15:30:01) — "approval_required"
  4. Sensitive Operation Detected (15:30:01.500)
  5. Approval Requested (15:30:02)
  6. **Approval Granted (09:34:36)** — "Approved by Dashboard User: Verified customer context. Communication approved for sending."

### Bug: Trace outcome not updated after approval

The approved trace still shows "In Progress" as its outcome in both the trace list and detail view. After an approval is granted, the trace outcome should be updated to `completed_with_approval`. The `approval_granted` event is recorded correctly, but the parent trace's `final_outcome` field is not updated.

**Screenshots:**
- `screenshots/audit-page-initial-2026-03-21T08-34-59-940Z.png` — Trace list view
- `screenshots/trace-timeline-approved-2026-03-21T08-35-30-591Z.png` — Event timeline for approved trace

---

## Test 5: Dashboard — Overview

**URL:** `http://localhost:3000/dashboard`

**Result: PASS**

- Overview page loads with correct dark theme
- Shows "Dashboard shell is running"
- API connection status: **"API connected — v0.1.0"** in green
- Sidebar navigation with all expected links (Overview, Agents, Policies, Approvals, Audit, Settings)

**Screenshot:**
- `screenshots/overview-page-2026-03-21T08-36-11-859Z.png`

---

## Bugs Found

### BUG-1: Policy Engine — resource_scope mismatch (Critical)

**Severity:** Critical — breaks the core demo flow
**Location:** Seed data (`prisma/seed.ts`) and/or `scripts/demo.ts`
**Description:** The demo script sends snake_case `resource_scope` values (e.g., `internal_docs`) but the seeded policy rules use human-readable display names (e.g., `Internal knowledge base`). The policy engine requires exact string matching, so no policies match.
**Impact:** All 3 demo scenarios produce wrong results. The SDK evaluate → policy match → approval flow is completely broken for the demo.
**Fix:** Either update the demo script to use the exact resource_scope values from the seed data, or update the seed data to use the values the demo sends. The latter is preferred since the SDK evaluate request should use machine-readable identifiers.

### BUG-2: Trace outcome not updated after approval (Medium)

**Severity:** Medium — data integrity issue
**Location:** `apps/api/src/services/approval-service.ts` or approval route handler
**Description:** When an approval request is approved via the dashboard, the `approval_granted` event is recorded correctly, but the parent trace's `final_outcome` is not updated from `in_progress` to `completed_with_approval`.
**Impact:** Trace list shows stale "In Progress" status for approved traces. Filtering by outcome won't find approved traces correctly.

### BUG-3: recordOutcome succeeds after deny decision (Medium)

**Severity:** Medium — trace integrity issue
**Location:** `apps/api/src/routes/traces.ts` or trace service
**Description:** After a policy evaluation returns `deny` and the trace is closed with outcome `blocked`, calling `client.recordOutcome(traceId, { status: 'success' })` still succeeds and overwrites the trace outcome to `executed`. A denied/blocked trace should not accept a successful outcome recording.
**Impact:** Traces can show contradictory state (denied by policy but recorded as successfully executed).

---

## Design Assessment

### Does the dashboard feel "institutional and calm"?

**Yes — the design achieves the intended aesthetic.** Specific observations:

**What works well:**
- **Near-black background** (`#0A0A0B`) creates a serious, professional tone — clearly not a consumer SaaS
- **Restrained color palette**: amber only for flagged/approval items, green only for success states, no gratuitous color
- **No decorative elements**: no gradients, no sparkle icons, no rounded playful elements
- **Typography**: Inter body font is clean and professional; monospace (`JetBrains Mono`) for operations/integrations/scopes adds a technical, infrastructure feel
- **Subtle borders** (`#2A2A2E`) separate content areas without being distracting
- **Information density**: The approval detail panel packs substantial context (authority model, delegation chain, policy rationale, trace timeline) without feeling cluttered
- **Amber "Why This Was Flagged"** section is appropriately prominent — draws the reviewer's eye to the justification

**What could be improved:**
- The overview page is very sparse — just a shell message and API status. This is expected for Phase 1 but will need dashboard widgets (pending approvals count, recent activity, etc.) in Phase 2
- The trace list items could benefit from slightly more visual distinction between outcome states (the small colored badge is the only differentiator)

**Overall:** The dashboard successfully avoids the "generic AI SaaS" aesthetic. It reads more like an enterprise security/compliance tool (think Datadog's dark theme, or a SIEM dashboard) than a typical AI product. The design language communicates seriousness and trustworthiness, which is exactly right for a governance product that enterprise security teams need to trust.
