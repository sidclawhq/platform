# Stress Test 3: Compliance Reviewer Persona

You are a compliance officer at a financial services company evaluating SidClaw for FINRA 2026 readiness. You need to verify that the platform provides the governance controls your regulators require. Use Playwright MCP tools (mcp__playwright__*) for all browser interactions — navigate, click, fill forms, take screenshots.

**Do NOT modify any code. Only test and report from a compliance reviewer's perspective.**

## Evaluation

### Step 1: Review Compliance Documentation

1. Open `https://docs.sidclaw.com` in the browser via Playwright
2. Navigate to Compliance > FINRA 2026
3. Read the entire page. Does it convincingly map FINRA requirements to product capabilities?
4. Navigate to Compliance > EU AI Act — same assessment
5. Navigate to Compliance > NIST AI RMF — same assessment
6. Take screenshots of key sections
7. **Assessment question:** Would you feel confident presenting these pages to a regulator as evidence of your AI governance framework?

### Step 2: Verify Audit Trail Completeness

1. Open `https://app.sidclaw.com` and log in
2. Navigate to Audit (trace viewer)
3. Select a trace that went through the approval flow
4. Verify the event chain is complete:
   - trace_initiated (who started it)
   - identity_resolved (what identity was used)
   - policy_evaluated (which policy applied)
   - sensitive_operation_detected (why it was flagged)
   - approval_requested (request created)
   - approval_granted/denied (who decided, when, with what note)
   - operation_executed (what happened)
   - trace_closed (final state)
5. **Assessment question:** Is this audit trail sufficient for a FINRA examination? Would an examiner be able to reconstruct what happened?
6. Take a screenshot of a complete trace timeline

### Step 3: Verify Human-in-the-Loop Controls

1. Navigate to Approvals
2. If there are pending approvals, examine one:
   - Is the risk classification visible?
   - Is the "Why This Was Flagged" section clear about the policy rationale?
   - Can you see who owns the agent?
   - Can you see what the agent wants to do and why?
3. **Assessment question:** Does this approval card give a reviewer enough context to make an informed decision? Or is it just a rubber-stamp checkbox?
4. Take a screenshot of the approval detail

### Step 4: Verify Separation of Duties

1. Note the agent owner's name (e.g., "Sarah Chen" for agent-001)
2. If you can, attempt to approve a request for that agent while logged in as that owner (or as a user with the same name)
3. Expected: 403 — the system should prevent self-approval
4. **Assessment question:** Is the separation of duties control sufficient for regulatory requirements?

### Step 5: Verify Trace Export for Regulators

1. Navigate to Settings > Audit Export (or Audit page with export)
2. Export traces as CSV for a date range
3. Open the CSV — verify it has the required columns:
   - trace_id, agent_id, agent_name, operation, outcome, timestamps, approver, policy version
4. Export a single trace as JSON — verify it contains the complete event chain
5. **Assessment question:** Could you hand this CSV to a FINRA examiner as evidence of AI agent governance?
6. Take a screenshot of the export page

### Step 6: Verify Integrity Controls

1. Find a trace with integrity hashes
2. Check if there's a "Verified" badge or verification status
3. Call the verify API: `GET /api/v1/traces/<id>/verify`
4. **Assessment question:** Would a regulator accept this hash chain as evidence of tamper-proof logging?

### Step 7: Verify Policy Documentation

1. Navigate to Policies
2. Examine a policy rule — does it have:
   - Clear name
   - Explicit rationale (WHY the policy exists)
   - Data classification
   - Version history (showing policy evolution over time)
3. **Assessment question:** Can you demonstrate to an auditor that your AI policies are documented, versioned, and have documented rationale?

### Step 8: Architecture Understanding

1. Navigate to Architecture page
2. Review the control flow diagram
3. **Assessment question:** Could you use this page in a presentation to your board's risk committee to explain how AI agents are governed?

## Deliverable

Write a report to `research/stress-tests/stress-test-3-compliance-review.md` with:

1. **FINRA 2026 Readiness Checklist:**

| FINRA Requirement | SidClaw Capability | Evidence | Pass/Fail |
|---|---|---|---|
| Pre-approval of AI use cases | Agent Registry + Policy Rules | | |
| Documented supervisory owners | Agent owner_name, owner_role | | |
| Human-in-the-loop validation | Approval Primitive | | |
| Documented human checkpoint | Approval cards with context | | |
| AI agent audit trails | Correlated traces with events | | |
| Guardrails to constrain behavior | Policy engine (deny rules) | | |

2. **Gaps identified:** What's missing for full FINRA compliance?
3. **Strengths:** What would impress a regulator?
4. **Weaknesses:** What would concern a regulator?
5. **Overall verdict:** Ready for a FINRA-regulated enterprise pilot?
6. **Screenshots** of key evidence (trace timeline, approval card, policy with rationale, export, architecture)
