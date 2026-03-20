# Improvements — Agent Identity & Approval Layer v0

Tracked improvements from the product review conducted 2026-03-20.

---

## Must-fix before external sharing

- [x] **Format timestamps in Trace Summary** — The Audit page's Trace Summary panel displays raw ISO strings (`2026-03-19T14:42:00Z`) for "Started" and "Completed" fields. Apply human-readable formatting consistent with the rest of the app.
  - File: `app/audit/page.tsx` (`TraceSummaryRow` for Started/Completed)

- [x] **Normalize date format across all pages** — `DecisionCard` uses US locale (`en-US`: "Mar 10, 2026, 10:00 AM") while `QueueItemCard`, `TraceEventRow`, and Approval Detail use GB locale (`en-GB`: "19 Mar 2026, 15:42"). Pick one locale (recommend `en-GB` for institutional tone) and apply everywhere.
  - Files: `components/policies/DecisionCard.tsx`, `components/approvals/QueueItemCard.tsx`, `components/audit/TraceEventRow.tsx`, `app/approvals/page.tsx` (ApprovalDetail), `app/agents/[id]/page.tsx`

- [x] **Add a "delegated" authority model agent** — Agents 002 and 003 both use `authority_model: 'self'`. No agent demonstrates `'delegated'`. Change Agent-003 (Case Operations Agent) to `authority_model: 'delegated'`, `identity_mode: 'delegated_identity'`, `delegation_model: 'on_behalf_of_user'`. Update the related approval request (apr-002), traces (TR-2051), events, and the authority explanation text in Agent Detail. This ensures all 3 authority models from the thesis are demonstrated.
  - Files: `lib/fixtures/agents.ts`, `lib/fixtures/approvals.ts`, `lib/fixtures/traces.ts`, `app/agents/[id]/page.tsx` (authority explanation)

- [x] **Clean up "Requested context" copy in Approval Detail** — The templated text reads awkwardly: "The agent prepared send outbound policy change notification using confidential context..." The lowercase operation name inlined into the sentence doesn't read naturally. Either capitalize/quote the operation name, smooth the sentence flow, or replace with hand-written context per scenario.
  - File: `app/approvals/page.tsx` (ApprovalDetail, "Requested context" section)

---

## Should improve if time allows

- [x] **Increase architecture diagram flow label readability** — Numbered flow labels (1–8) use 9px `muted-foreground` text, barely readable at normal zoom. Increase font size to 11px and use `secondary-foreground` color. Alternatively, add a numbered legend below the diagram.
  - File: `app/architecture/page.tsx` (flow label `<text>` elements)

- [x] **Make agent card activity text more visible** — `recent_activity_state` text ("3 operations this week") uses `text-muted-foreground/70` which is nearly invisible against the dark surface. Bump to `text-muted-foreground`.
  - File: `components/agents/AgentRowCard.tsx` (line 74)

- [x] **Add trace ID to toast notifications** — The success toast after approve/deny is generic ("Approval recorded..."). Include the trace ID for context, e.g. "Approval recorded for TR-2048. Operation executed and trace updated."
  - File: `app/approvals/page.tsx` (handleApprove/handleDeny callbacks)

- [x] **Show resolved count above empty state in Approval Queue** — When all approvals are resolved and the empty state appears, show how many items were resolved in the current session before offering the reset option. Provides context for what "reset" would restore.
  - File: `app/approvals/page.tsx` (empty state area)

---

## Not for v0 (deferred)

- [ ] Responsive / mobile layout (nav collapses needed below ~900px)
- [ ] Real backend, database, or authentication
- [ ] More than 3 agents or 4 scenarios
- [ ] Policy versioning diff or history view
- [ ] Decision notes input field for approve/deny (data model supports it, UI doesn't expose it)
- [ ] Guided demo walkthrough or onboarding overlay
- [ ] Filter state persistence across page navigations
