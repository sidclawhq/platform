# Implementation Ticket Pack — Agent Identity & Approval Layer (v0)

---

## Build Strategy

1. **Build state and seed data first.** TypeScript types, enum definitions, fixture data for all 3 agents / 4 scenarios, and the React Context provider must exist before any UI work begins. This is the foundation every component and page depends on.

2. **Build reusable primitives second.** StatusBadge, PageHeader, DataRow, and other shared UI atoms are used across every page. Getting them right once avoids duplication and inconsistency.

3. **Build pages in PRD-locked order: Approval Queue → Approval Detail → Audit Timeline → Agent Detail → Agent Registry → Policies → Architecture.** This keeps the emotional center of the product (approval + audit) sharp and validated before secondary screens are built.

4. **Defer polish, guided-demo, and reset behavior to the final phase.** These are integration-level concerns that depend on all pages existing.

5. **AI coding assistants will succeed best on:** typed component tickets with clear props, seed data generation from explicit schemas, individual page layouts against known fixtures, and the Architecture diagram (static SVG/JSX).

6. **AI coding assistants will struggle with:** cross-page state transitions (approve → trace update), the "Institutional Calm" design tone (needs human review of visual output), and scenario reset logic that touches multiple contexts.

7. **Human review is most important for:** visual tone and design fidelity (does it feel institutional, not SaaS?), the Approval Detail slide-over (the single most important screen), and the correctness of seeded scenario data (enterprise terminology must survive scrutiny).

8. **Major implementation risks:** (a) the approval flow state transition spanning Approval Queue → Approval Detail → Audit Timeline is the only non-trivial state logic — get it right early; (b) the dark-mode "Institutional Calm" aesthetic is easy to get wrong — review every page visually; (c) terminology drift — enforce the PRD glossary from the first commit.

9. **Stack:** Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui. State via React Context + useState. No server components needed; all pages can be client components.

10. **No backend, no auth, no real policy engine.** Every "evaluation" is a deterministic lookup against seeded fixture data.

---

## Section 1 — Page-Level Tickets

---

### P-01: App Shell — Global Layout with Navigation and Reset Control

**Goal:** Create the persistent app shell that wraps all pages: top/left navigation bar, page content area, toast notification region, and global reset button.

**Why it matters:** Every page shares the same shell. Without it, no page can be rendered in context. The navigation establishes the product's information architecture immediately.

**Scope:**
- Next.js App Router `layout.tsx` with dark-mode Tailwind config
- Top navigation with 5 links: Agents, Policies, Approval Queue, Audit, Architecture
- Active-state highlighting for current route
- "Reset simulation" button in header utility area
- Toast notification container (bottom-right)
- Import Inter (UI) and JetBrains Mono (technical/trace) fonts

**Out of scope:**
- Page content (handled by per-page tickets)
- Toast logic (separate ticket)
- Reset logic implementation (separate ticket)
- Responsive/mobile layout

**Inputs / dependencies:**
- S-01 (Tailwind + shadcn/ui project init)
- S-02 (TypeScript types — for reset function signature)

**Files likely to be touched:**
- `app/layout.tsx`
- `app/globals.css`
- `components/layout/AppShell.tsx`
- `components/layout/TopNav.tsx`
- `components/layout/ResetButton.tsx`
- `tailwind.config.ts`

**Detailed implementation notes:**
- Use Next.js App Router. The layout wraps `{children}`.
- Dark mode: set `<html class="dark">` and configure Tailwind `darkMode: 'class'`.
- Background: near-black (`#0a0a0f` or similar). Text: muted off-white (`#e0e0e6`).
- Navigation items: `[{ label: "Agents", href: "/agents" }, { label: "Policies", href: "/policies" }, { label: "Approval Queue", href: "/approvals" }, { label: "Audit", href: "/audit" }, { label: "Architecture", href: "/architecture" }]`
- Use `usePathname()` from `next/navigation` for active link styling.
- "Reset simulation" button: subtle, positioned in the right of the nav bar. On click, calls `resetScenarios()` from the app context (wired in S-04).
- Toast container: use shadcn/ui `<Toaster />` from `sonner` or equivalent.
- Fonts: load Inter via `next/font/google`, JetBrains Mono via `next/font/google`. Set Inter as default body font. JetBrains Mono available via a utility class `.font-mono-trace`.
- No gradients, no AI sparkle icons, no decorative elements. Restrained border usage (`border-white/5` or `border-white/10`).

**Acceptance criteria:**
- [ ] Dark-mode shell renders with near-black background and muted text
- [ ] All 5 navigation links are visible and route correctly
- [ ] Active navigation link is visually distinguished
- [ ] "Reset simulation" button is present and clickable (handler can be no-op initially)
- [ ] Toast container is mounted
- [ ] Inter is the default font; JetBrains Mono is available via class
- [ ] Shell does not feel like a generic SaaS sidebar — it feels institutional and quiet

**QA / test checklist:**
- [ ] Navigate to each of the 5 routes; active state updates
- [ ] Shell renders without layout shift on route change
- [ ] Dark mode is consistent (no white flashes)
- [ ] Reset button is visible and does not overlap navigation on standard desktop viewport

**Suggested order / priority:** 1 (must be first page-level ticket)

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build the global app shell for a Next.js App Router project (TypeScript + Tailwind + shadcn/ui).

Requirements:
- File: app/layout.tsx wraps {children}
- Create components/layout/AppShell.tsx, TopNav.tsx, ResetButton.tsx
- Dark mode: html class="dark", background near-black (#0a0a0f), text muted off-white (#e0e0e6)
- Top navigation bar with 5 links: Agents (/agents), Policies (/policies), Approval Queue (/approvals), Audit (/audit), Architecture (/architecture)
- Use usePathname() for active link highlighting
- "Reset simulation" button in header utility area (right side). On click calls resetScenarios() from context — for now use a no-op placeholder.
- Mount a toast notification container (use sonner or shadcn toast)
- Load Inter as default body font and JetBrains Mono as .font-mono-trace utility class via next/font/google
- Update tailwind.config.ts: darkMode "class", extend colors for semantic states
- No gradients, no decorative elements, no AI icons. Restrained borders (border-white/5 or border-white/10). The design direction is "Institutional Calm" — premium, structured, restrained, trustworthy.
- No sidebar — use top navigation
```

---

### P-02: Approval Queue Page

**Goal:** Build the Approval Queue page showing pending sensitive operations as vertically stacked briefing cards.

**Why it matters:** This is one of the two most important screens. It is the first page built per the locked build sequence. The queue must feel like a security briefing, not a Jira queue.

**Scope:**
- Page route at `/approvals`
- PageHeader with title "Approval Queue" and subtitle
- Toolbar row: filter by status, filter by agent, filter by data classification, search by trace ID or operation
- Main content: vertically stacked QueueItemCard components for each pending approval request
- Empty state when filters produce zero results
- "Review" button on each card opens the Approval Detail slide-over (wired in P-03)
- Filtering/search is client-side against context data

**Out of scope:**
- Approval Detail slide-over (P-03)
- Approve/Deny actions (P-03)
- Toast notifications for approval outcomes (P-08)

**Inputs / dependencies:**
- P-01 (App Shell)
- S-02 (TypeScript types)
- S-03 (Seed data fixtures)
- S-04 (AppContext provider)
- C-01 (PageHeader)
- C-02 (StatusBadge)
- C-05 (QueueItemCard)
- C-07 (PillFilter)
- C-08 (SearchInput)
- C-10 (EmptyState)

**Files likely to be touched:**
- `app/approvals/page.tsx`
- `components/approvals/ApprovalQueuePage.tsx`

**Detailed implementation notes:**
- Read approval requests from AppContext. Filter to show `pending` status by default, but allow filter to show all statuses.
- Toolbar: PillFilter for status (Pending / Approved / Denied / All), PillFilter for agent (all 3 agents), PillFilter for data classification (public / internal / confidential / restricted). SearchInput for trace ID or operation text.
- Filtering is AND logic across all active filters.
- Each card renders via QueueItemCard (C-05) which displays: requested operation (top line), status badge, trace ID, agent name, owner, environment, target integration, resource scope, data classification, authority model, delegated from, policy effect, "Why this was flagged" block, requested timestamp, separation-of-duties status, and "Review" button.
- The "Why this was flagged" block must be the visual anchor of each card — slightly inset panel, subtle border emphasis, semantic accent strip on left.
- Empty state: "No actions are waiting for review" / "All approval-required operations have been resolved in the current simulation state." / Action: "Reset scenarios" (calls resetScenarios from context).
- Page subtitle: "Sensitive agent operations requiring human review before execution."

**Acceptance criteria:**
- [ ] Page renders at /approvals with header, toolbar, and queue cards
- [ ] Pending approval requests from seed data appear as briefing cards
- [ ] "Why this was flagged" block is the visual center of each card
- [ ] Filters narrow results instantly
- [ ] Search filters by trace ID or operation text
- [ ] Empty state renders when all filters exclude all items
- [ ] "Review" button on each card is clickable
- [ ] Page feels like a security briefing, not ticket processing

**QA / test checklist:**
- [ ] All seeded pending approvals render
- [ ] Filter by each dimension independently
- [ ] Combine multiple filters
- [ ] Search for a trace ID — correct card appears
- [ ] Clear all filters — all items reappear
- [ ] Empty state with "Reset scenarios" button renders when appropriate

**Suggested order / priority:** 3 (after shell and core components)

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build the Approval Queue page for a Next.js App Router project (TypeScript + Tailwind + shadcn/ui).

Route: /approvals
File: app/approvals/page.tsx and components/approvals/ApprovalQueuePage.tsx

This page shows pending sensitive agent operations requiring human review. It should feel like a security briefing, not a Jira queue or email inbox.

Requirements:
- PageHeader: title "Approval Queue", subtitle "Sensitive agent operations requiring human review before execution."
- Toolbar row with:
  - PillFilter for status (Pending / Approved / Denied / All)
  - PillFilter for agent (each of the 3 seeded agents)
  - PillFilter for data classification (public / internal / confidential / restricted)
  - SearchInput for trace ID or operation text
- Main content: vertically stacked QueueItemCard components, one per approval request from AppContext
- Filtering: AND logic across all active filters, client-side
- Each QueueItemCard shows: requested operation (top-line), Pending status badge, trace ID, agent name, owner, environment, target integration, resource scope, data classification, authority model, delegated from, policy effect, "Why this was flagged" block (visually prominent — inset panel with left accent border), requested timestamp, separation-of-duties status, "Review" button
- Empty state: title "No actions are waiting for review", body "All approval-required operations have been resolved in the current simulation state.", action "Reset scenarios"
- Read data from AppContext (useAppContext hook)
- Dark mode, institutional calm design. Stronger emphasis than Registry or Policies pages.
- The "Why this was flagged" block must be the visual and conceptual anchor of every card
```

---

### P-03: Approval Detail Slide-Over Panel

**Goal:** Build the slide-over panel that opens from the Approval Queue, showing full inspection of one approval request with Approve/Deny actions.

**Why it matters:** This is the single most important screen in the product. A reviewer must be able to make an informed, confident decision from this panel alone. "This is the product."

**Scope:**
- Slide-over panel from the right, ~40–50% desktop width, overlaying the Approval Queue
- Full approval request inspection with 6 sections: Request Summary, Authority Context, Why This Was Flagged, Requested Context, Reviewer Action Panel, Governance Metadata
- Approve and Deny buttons that update state
- Post-action: status change, queue item updates, related trace updates, inline confirmation
- Close button to dismiss panel

**Out of scope:**
- Escalation actions (not in v0)
- Decision note text area (optional — include if straightforward)
- Toast notification (handled by P-08; inline confirmation is sufficient here)

**Inputs / dependencies:**
- P-02 (Approval Queue page)
- S-02 (TypeScript types — ApprovalRequest, PolicyRule, AuditTrace, AuditEvent)
- S-03 (Seed data — for related policy lookup)
- S-04 (AppContext — for state mutation: approveRequest, denyRequest)
- C-02 (StatusBadge)
- C-06 (ApprovalDetailPanel component)
- C-09 (SlideOverPanel wrapper)

**Files likely to be touched:**
- `components/approvals/ApprovalDetailPanel.tsx`
- `components/layout/SlideOverPanel.tsx`
- `lib/state/AppContext.tsx` (approve/deny mutation functions)

**Detailed implementation notes:**
- The slide-over opens when "Review" is clicked on a QueueItemCard. Receive the selected `approvalRequest` as prop or via context.
- Panel width: `w-[45vw]` or similar. Slide in from right with a transition. Semi-transparent backdrop overlay on the left.
- **Header:** operation title, Pending badge, trace ID, close (X) button.
- **Section A — Request Summary:** agent name, owner, environment, requested operation, target integration, requested timestamp. Render as a compact DataRow grid.
- **Section B — Authority Context:** authority model, identity mode, delegated from, separation-of-duties result. This establishes trust context.
- **Section C — Why This Was Flagged (CORE SECTION):** policy effect badge, governing policy name, rationale (full text), data classification, resource scope. This must be the visually strongest panel — use a distinct background (`bg-white/[0.03]`), left accent border in amber/warning color, slightly larger typography for the rationale.
- **Section D — Requested Context:** trigger source (synthetic), context summary, intended impact, optional confidence note. Example: "The agent prepared an outbound communication using customer policy context and requested release through the communications service."
- **Section E — Reviewer Action Panel:** Approve button (muted green/teal), Deny button (muted red). Buttons should feel serious, not decorative. Optional: a small `<textarea>` for decision note.
- **Section F — Governance Metadata:** policy version, modified by, last modified at. Small, de-emphasized.
- **On Approve:** call `approveRequest(id)` from context → status changes to "approved" → trace updates with "approval_granted" and "operation_executed" events → show inline confirmation "Operation approved and recorded in trace." → close panel or keep open with updated state.
- **On Deny:** call `denyRequest(id)` from context → status changes to "denied" → trace updates with "approval_denied" and "operation_blocked" events → show inline confirmation "Operation denied and recorded in trace."
- The owner-cannot-self-approve note should be visible in the governance section.

**Acceptance criteria:**
- [ ] Slide-over opens from queue with smooth transition
- [ ] All 6 sections render with correct data from the selected approval request
- [ ] "Why this was flagged" is the visually strongest section
- [ ] Approve button changes status and updates related trace
- [ ] Deny button changes status and updates related trace
- [ ] Inline confirmation appears after action
- [ ] Panel can be closed via X button
- [ ] A reviewer can decide confidently without leaving the panel
- [ ] Panel feels like a security review, not a lightweight modal

**QA / test checklist:**
- [ ] Open panel for each pending approval request — data is correct
- [ ] Approve a request — status changes to Approved, queue item updates, trace updates
- [ ] Deny a request — status changes to Denied, queue item updates, trace updates
- [ ] Close and reopen — state is preserved
- [ ] After approving/denying, the queue page reflects the change
- [ ] Separation-of-duties note is visible
- [ ] Governance metadata section shows policy version

**Suggested order / priority:** 4 (immediately after Approval Queue)

**AI-assistant friendly:** Yes (but human review critical for design fidelity)

**Ready-to-copy prompt:**
```
Build the Approval Detail slide-over panel for a Next.js project (TypeScript + Tailwind + shadcn/ui). This is the most important screen in the product.

File: components/approvals/ApprovalDetailPanel.tsx (uses SlideOverPanel wrapper from components/layout/SlideOverPanel.tsx)

The panel slides in from the right (~45vw width) over the Approval Queue when "Review" is clicked on a QueueItemCard. It shows the full governance context for one approval request and captures the Approve/Deny decision.

Structure (6 sections):
1. Header: operation title, Pending badge, trace ID, close (X) button
2. Section A — Request Summary: agent, owner, environment, requested operation, target integration, timestamp (DataRow grid)
3. Section B — Authority Context: authority model, identity mode, delegated from, separation-of-duties result
4. Section C — Why This Was Flagged (MOST IMPORTANT SECTION): policy effect badge, governing policy name, rationale text, data classification, resource scope. Visually strongest: use distinct background (bg-white/[0.03]), left accent border in amber, slightly larger rationale text.
5. Section D — Requested Context: trigger source, context summary, intended impact
6. Section E — Reviewer Action Panel: Approve button (muted green/teal), Deny button (muted red). Serious, not decorative.
7. Section F — Governance Metadata: policy version, modified by, last modified at. De-emphasized.

Behavior:
- Props: approvalRequest, relatedPolicy, onApprove, onDeny, onClose
- On Approve: calls onApprove(id), shows inline confirmation "Operation approved and recorded in trace."
- On Deny: calls onDeny(id), shows inline confirmation "Operation denied and recorded in trace."
- Include note: "Owner cannot self-approve" in governance section
- Slide-in transition, semi-transparent backdrop

Design: dark mode, institutional calm. This panel should feel like a security review panel, not a lightweight modal. No big decorative buttons. No consumer-style confirmation.
```

---

### P-04: Audit Timeline Page

**Goal:** Build the Audit Timeline page showing trace-based evidence of agent operations with a vertical timeline, trace selector, and summary panel.

**Why it matters:** This is the second most important screen. It must communicate causality and evidence — not logs. The trace structure is what makes this product feel architecturally serious.

**Scope:**
- Page route at `/audit`
- PageHeader with title "Audit" and subtitle
- Toolbar: search by trace ID, filter by outcome, filter by agent
- Trace selector (top or left) showing all traces
- Main content: vertical timeline of events for the selected trace
- Side summary card for selected trace metadata
- Supports 4 outcome types: executed, completed_with_approval, denied, blocked

**Out of scope:**
- Live updating traces (all deterministic from seed)
- Export functionality
- Event detail expansion

**Inputs / dependencies:**
- P-01 (App Shell)
- S-02 (TypeScript types — AuditTrace, AuditEvent)
- S-03 (Seed data — 4 traces for 4 scenarios)
- S-04 (AppContext — traces update when approvals are decided)
- C-01 (PageHeader)
- C-02 (StatusBadge)
- C-11 (TraceTimeline)
- C-12 (TraceEventRow)

**Files likely to be touched:**
- `app/audit/page.tsx`
- `components/audit/AuditTimelinePage.tsx`
- `components/audit/TraceSelectorList.tsx`
- `components/audit/TraceSummaryCard.tsx`

**Detailed implementation notes:**
- Layout: trace selector on left or top (list of trace cards), main timeline in center, summary card on right or top-right.
- Trace selector: show each trace as a compact row with trace ID, agent name, operation, final outcome badge. Clicking selects the trace.
- Summary card for selected trace: trace ID, agent, requested operation, authority model, target integration, resource scope, start time, final outcome. Use JetBrains Mono for trace ID.
- Timeline: vertical spine with event nodes. Each event row shows: timestamp, event type, actor type, actor name, description, status, policy version (if relevant).
- Event types in order: trace_initiated → identity_resolved → delegation_resolved → policy_evaluated → sensitive_operation_detected (if applicable) → approval_required (if applicable) → approval_granted/denied (if applicable) → operation_executed/blocked → trace_closed.
- Approval decision event should be visually emphasized (slightly different background or stronger border).
- Final outcome visible at the bottom of timeline AND in summary card.
- Timestamps should use JetBrains Mono. Event descriptions should read as factual evidence.
- Empty state: "No traces match the current filters" / "Adjust filters or reset the simulation state to view correlated operation traces." / Action: "Reset scenarios"
- Page subtitle: "Correlated traces showing policy evaluation, approval control, and final outcome for agent operations."

**Acceptance criteria:**
- [ ] Page renders at /audit with header, toolbar, trace selector, timeline, and summary
- [ ] All 4 scenario traces are selectable
- [ ] Selected trace shows full event timeline with correct causal ordering
- [ ] Approval decision event is visually emphasized
- [ ] Final outcome is visible at timeline bottom and in summary card
- [ ] Trace IDs render in monospace font
- [ ] The page feels like evidence, not like server logs
- [ ] Filters narrow trace list correctly

**QA / test checklist:**
- [ ] Select each of the 4 traces — correct events render
- [ ] Verify event ordering matches expected sequence for each scenario type
- [ ] Filter by outcome — only matching traces appear
- [ ] Filter by agent — only matching traces appear
- [ ] Search by trace ID — correct trace is selected
- [ ] After approving/denying in Approval Queue, audit trace reflects the updated outcome

**Suggested order / priority:** 5

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build the Audit Timeline page for a Next.js App Router project (TypeScript + Tailwind + shadcn/ui).

Route: /audit
Files: app/audit/page.tsx, components/audit/AuditTimelinePage.tsx, components/audit/TraceSelectorList.tsx, components/audit/TraceSummaryCard.tsx

This page shows trace-based evidence of agent operations. It must look like evidence, not server logs.

Layout:
- Trace selector (left panel or top): list of trace cards showing trace ID, agent, operation, outcome badge. Click to select.
- Main content (center): vertical timeline with event nodes for the selected trace
- Summary card (right or top-right): trace ID, agent, operation, authority model, integration, scope, start time, final outcome

PageHeader: title "Audit", subtitle "Correlated traces showing policy evaluation, approval control, and final outcome for agent operations."

Toolbar: search by trace ID, filter by outcome (executed/completed_with_approval/denied/blocked), filter by agent

Timeline:
- Vertical spine with event nodes
- Each event: timestamp (JetBrains Mono), event type, actor type, actor name, description, status, policy version if relevant
- Event sequence: trace_initiated → identity_resolved → delegation_resolved → policy_evaluated → sensitive_operation_detected → approval_required → approval_granted/denied → operation_executed/blocked → trace_closed
- Approval decision event visually emphasized (different background/border)
- Final outcome visible at bottom of timeline AND in summary card

Data comes from AppContext (useAppContext). Traces update when approvals are decided.

Empty state: "No traces match the current filters" with "Reset scenarios" action.

Design: dark mode, institutional calm. Timestamps in JetBrains Mono. Evidence-grade presentation. No log-table feel.
```

---

### P-05: Agent Detail Page

**Goal:** Build the Agent Detail page showing the full governance profile of a single agent in a dossier-like 2-column layout.

**Why it matters:** This page proves that agents are governed machine actors with identity, authority, access boundaries, and lifecycle controls — not just names in a list.

**Scope:**
- Page route at `/agents/[id]`
- Header block: name, description, lifecycle badge, autonomy badge, authority badge, meta line
- Left column: Overview, Authority & Identity, Authorized Integrations, Policy Summary, Recent Approval Activity, Recent Trace Activity
- Right column: Lifecycle Controls card, Governance Snapshot card, Linked Navigation card
- Lifecycle controls: Suspend Agent, Revoke All Grants (visual-only in v0, update local state)

**Out of scope:**
- Editing agent fields
- Real credential management
- Full activity history (just recent 2–3 items)

**Inputs / dependencies:**
- P-01 (App Shell)
- S-02 (TypeScript types)
- S-03 (Seed data — full agent profiles)
- S-04 (AppContext)
- C-01 (PageHeader)
- C-02 (StatusBadge)
- C-03 (DataRow)
- C-04 (StatCard)
- C-13 (AgentMetaBlock)

**Files likely to be touched:**
- `app/agents/[id]/page.tsx`
- `components/agents/AgentDetailPage.tsx`
- `components/agents/AuthorityIdentitySection.tsx`
- `components/agents/AuthorizedIntegrationsSection.tsx`
- `components/agents/PolicySummarySection.tsx`
- `components/agents/RecentActivitySection.tsx`
- `components/agents/LifecycleControlsCard.tsx`
- `components/agents/GovernanceSnapshotCard.tsx`
- `components/agents/LinkedNavigationCard.tsx`

**Detailed implementation notes:**
- Dynamic route: `app/agents/[id]/page.tsx`. Look up agent by ID from AppContext.
- **Header block:** agent name (large), description, badges row (lifecycle state, autonomy tier, authority model), meta line: "Production · Owned by [owner] · [team]".
- **Left column:**
  - **Overview section:** structured DataRow grid — owner name, owner role, team, environment, identity mode, delegation model, authority model, next review date.
  - **Authority & Identity section:** identity mode, delegation model, authority explanation text (e.g., "This agent operates under hybrid authority — it acts on behalf of its registered owner for outbound communications."), separation-of-duties note.
  - **Authorized Integrations:** compact cards per integration — integration name, resource scope, data classification boundary, allowed operations summary.
  - **Policy Summary:** stat cards — allowed rules count, approval-required rules count, denied rules count, latest policy version. Clicking navigates to Policies page filtered by this agent.
  - **Recent Approval Activity:** last 2–3 approval requests — operation, policy effect, outcome, time. Clicking navigates to Approval Queue.
  - **Recent Trace Activity:** last 2–3 traces — trace ID, operation, outcome, timestamp. Clicking navigates to Audit with trace selected.
- **Right column:**
  - **Lifecycle Controls:** current state badge, "Suspend Agent" button, "Revoke All Grants" button. Buttons update lifecycle_state in context (visual-only — no real backend).
  - **Governance Snapshot:** autonomy tier, authority model, approval dependency note, next review date.
  - **Linked Navigation:** "View policies" → /policies?agent=X, "View approval queue" → /approvals?agent=X, "View audit traces" → /audit?agent=X.
- Page should feel like a dossier — not dense, not flashy, not like a settings page.

**Acceptance criteria:**
- [ ] Page renders for each of the 3 agents at /agents/[id]
- [ ] Header shows name, description, 3 badges, and meta line
- [ ] All 6 left-column sections render with correct data
- [ ] All 3 right-column cards render
- [ ] Lifecycle controls (Suspend, Revoke) are clickable and update state
- [ ] Policy summary counts match actual seeded policy rules for the agent
- [ ] Page feels like a governance dossier, not a generic profile
- [ ] Identity/authority/lifecycle read as first-class governance concepts

**QA / test checklist:**
- [ ] Navigate to each of the 3 agent detail pages — correct data renders
- [ ] Click Suspend Agent — lifecycle state updates to Suspended, badge reflects change
- [ ] Click Revoke All Grants — lifecycle state updates to Revoked
- [ ] Policy summary links navigate to filtered Policies page
- [ ] Approval activity links navigate to Approval Queue
- [ ] Trace activity links navigate to Audit
- [ ] Authorized integrations show correct scopes and classifications

**Suggested order / priority:** 6

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build the Agent Detail page for a Next.js App Router project (TypeScript + Tailwind + shadcn/ui).

Route: /agents/[id] (dynamic route)
Files: app/agents/[id]/page.tsx, components/agents/AgentDetailPage.tsx, plus sub-section components in components/agents/

This page shows the full governance profile of one agent. It should feel like a dossier.

Layout: header block + 2-column (left: primary content, right: summary cards)

Header block:
- Agent name (large), description, badges (lifecycle state, autonomy tier, authority model), meta line ("Production · Owned by [owner] · [team]")

Left column sections:
1. Overview: DataRow grid — owner, role, team, environment, identity mode, delegation model, authority model, next review date
2. Authority & Identity: identity mode, delegation model, authority explanation text, separation-of-duties note ("Sensitive operations triggered by this agent require review by an approver other than the registered owner.")
3. Authorized Integrations: compact cards — integration name, resource scope, data classification, allowed operations
4. Policy Summary: stat cards — allowed/approval-required/denied rule counts, policy version. Clickable → navigates to /policies?agent=[id]
5. Recent Approval Activity: last 2-3 requests — operation, effect, outcome, time. Clickable → /approvals
6. Recent Trace Activity: last 2-3 traces — trace ID, operation, outcome, timestamp. Clickable → /audit

Right column:
1. Lifecycle Controls card: current state badge, "Suspend Agent" button, "Revoke All Grants" button (update lifecycle_state in AppContext)
2. Governance Snapshot card: autonomy tier, authority model, approval dependency, next review
3. Linked Navigation card: View policies, View approval queue, View audit traces (links with agent filter)

Data from AppContext. Dark mode, institutional calm. Not dense, not flashy, not a settings page.
```

---

### P-06: Agent Registry Page

**Goal:** Build the Agent Registry page showing all 3 agents as governed enterprise assets in a row-based registry with rich cells.

**Why it matters:** This is the product's first impression — it must immediately establish that agents are registered, owned, classified, bounded, and manageable. It sets the enterprise governance tone.

**Scope:**
- Page route at `/agents`
- PageHeader with title "Agents" and subtitle
- Toolbar: search by agent name, filter pills for environment, authority model, autonomy tier, lifecycle state
- Main content: row-based registry (3 agents) — each row is a rich card
- Empty state for zero-result filters
- Clicking a row navigates to Agent Detail

**Out of scope:**
- Agent creation/editing
- Pagination (only 3 agents)
- Sorting

**Inputs / dependencies:**
- P-01 (App Shell)
- S-02 (TypeScript types)
- S-03 (Seed data)
- S-04 (AppContext)
- C-01 (PageHeader)
- C-02 (StatusBadge)
- C-07 (PillFilter)
- C-08 (SearchInput)
- C-10 (EmptyState)
- C-14 (AgentRowCard)

**Files likely to be touched:**
- `app/agents/page.tsx`
- `components/agents/AgentRegistryPage.tsx`

**Detailed implementation notes:**
- Read agents from AppContext.
- Toolbar: SearchInput for name search. PillFilter for environment (dev/test/prod), authority model (self/delegated/hybrid), autonomy tier (low/medium/high), lifecycle state (active/suspended/revoked).
- Each AgentRowCard (C-14): left column (name, one-line description), middle metadata (owner, team, environment, authority model), right metadata (autonomy tier badge, lifecycle state badge, next review date, recent trace count), far right (chevron or "View details" link).
- Row click navigates to `/agents/[id]` using Next.js router.
- Empty state: "No agents match the current filters" / "Try clearing one or more filters to view registered agents." / "Clear filters" action.
- Page subtitle: "Known AI agents with defined ownership, authority models, lifecycle states, and authorized integrations."
- Visual: controlled and quiet. Restrained cards with modest hover effect. Not the emotional center — should be clean, not dramatic.

**Acceptance criteria:**
- [ ] Page renders at /agents with 3 agent rows
- [ ] Each row shows name, description, owner, team, environment, authority model, autonomy tier, lifecycle state, integrations count, next review
- [ ] Filters and search narrow visible rows
- [ ] Clicking a row navigates to Agent Detail
- [ ] Empty state renders when filters exclude all agents
- [ ] Page is understandable within 10 seconds
- [ ] Feels like an enterprise control surface, not a generic list

**QA / test checklist:**
- [ ] All 3 agents render
- [ ] Search by partial name — filters correctly
- [ ] Each filter narrows results independently
- [ ] Combined filters work (AND logic)
- [ ] Clear filters restores all agents
- [ ] Click each row — correct Agent Detail page opens
- [ ] Lifecycle state badge updates if agent was suspended/revoked in Agent Detail

**Suggested order / priority:** 7

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build the Agent Registry page for a Next.js App Router project (TypeScript + Tailwind + shadcn/ui).

Route: /agents
Files: app/agents/page.tsx, components/agents/AgentRegistryPage.tsx

Shows all 3 seeded agents as governed enterprise assets.

PageHeader: title "Agents", subtitle "Known AI agents with defined ownership, authority models, lifecycle states, and authorized integrations."

Toolbar:
- SearchInput: search by agent name
- PillFilter: environment (dev/test/prod), authority model (self/delegated/hybrid), autonomy tier (low/medium/high), lifecycle state (active/suspended/revoked)

Main content: row-based registry with AgentRowCard for each agent
- Left: name, one-line description
- Middle: owner, team, environment, authority model
- Right: autonomy tier badge, lifecycle state badge, next review date, recent activity indicator
- Far right: chevron/"View details"
- Click navigates to /agents/[id]
- Filtering: AND logic, client-side

Empty state: "No agents match the current filters", "Try clearing one or more filters to view registered agents.", "Clear filters" button

Design: dark mode, institutional calm. Clean and quiet — not the dramatic center of the product. Restrained cards, modest hover, subtle dividers.
```

---

### P-07: Policies Page

**Goal:** Build the Policies page showing policy rules as decision cards grouped by agent, with rationale blocks.

**Why it matters:** This page proves that governance is reasoned, not just a permissions spreadsheet. The rationale for each policy effect is what makes it credible to enterprise audiences.

**Scope:**
- Page route at `/policies`
- PageHeader with title "Policies" and subtitle
- Toolbar: search rules, filter by agent, filter by policy effect, filter by data classification
- Main content: decision cards grouped by agent
- Each card shows: policy name, policy effect badge, agent, authorized integration, operation, resource scope, data classification, policy version, modified by/at, rationale block
- Empty state

**Out of scope:**
- Policy editing/creation
- Policy version history
- Session TTL enforcement

**Inputs / dependencies:**
- P-01 (App Shell)
- S-02 (TypeScript types — PolicyRule)
- S-03 (Seed data — policy rules)
- S-04 (AppContext)
- C-01 (PageHeader)
- C-02 (StatusBadge)
- C-07 (PillFilter)
- C-08 (SearchInput)
- C-10 (EmptyState)
- C-15 (DecisionCard)

**Files likely to be touched:**
- `app/policies/page.tsx`
- `components/policies/PoliciesPage.tsx`

**Detailed implementation notes:**
- Read policy rules from AppContext.
- Group rules by agent. Display agent name as a section heading.
- Each DecisionCard (C-15): top line (policy name + policy effect badge), body rows (agent, authorized integration, operation, resource scope, data classification, policy version, modified by / modified at), rationale block with distinct visual treatment (slightly different background, "Rationale" label, the reasoning text).
- Toolbar: SearchInput for rule text, PillFilter for agent, PillFilter for policy effect (allowed/approval_required/denied), PillFilter for data classification.
- Support URL query param `?agent=[id]` for pre-filtering when navigating from Agent Detail.
- Empty state: "No policy rules match the current filters" / "Adjust filters to view policy decisions across agents and integrations." / "Clear filters".
- Page subtitle: "Policy rules define the effect of each operation across integration, scope, and data classification."
- Clicking agent name in a card navigates to Agent Detail.
- The rationale block is what prevents this from being generic RBAC UI — it must stand apart visually.

**Acceptance criteria:**
- [ ] Page renders at /policies with decision cards grouped by agent
- [ ] Each card shows policy name, effect badge, all metadata fields, and rationale
- [ ] Rationale block is visually distinct from metadata
- [ ] Filters narrow cards correctly
- [ ] URL query param ?agent=[id] pre-filters
- [ ] Clicking agent name navigates to Agent Detail
- [ ] Page reads as policy decisions, not static permissions
- [ ] Empty state renders correctly

**QA / test checklist:**
- [ ] All seeded policy rules render
- [ ] Filter by each dimension
- [ ] Navigate from Agent Detail with ?agent param — pre-filtered
- [ ] Rationale is visible and legible for every rule
- [ ] Policy effect badges are visually prominent and distinct
- [ ] Search by operation or policy name works

**Suggested order / priority:** 8

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build the Policies page for a Next.js App Router project (TypeScript + Tailwind + shadcn/ui).

Route: /policies
Files: app/policies/page.tsx, components/policies/PoliciesPage.tsx

Shows policy rules as governed decisions with reasoning — NOT a spreadsheet of permissions.

PageHeader: title "Policies", subtitle "Policy rules define the effect of each operation across integration, scope, and data classification."

Toolbar: SearchInput for rule text, PillFilter for agent, PillFilter for policy effect (allowed/approval_required/denied), PillFilter for data classification (public/internal/confidential/restricted)

Main content: DecisionCard components grouped by agent (agent name as section heading)

Each DecisionCard:
- Top line: policy name + policy effect badge (Allowed green, Approval Required amber, Denied red)
- Body: agent, authorized integration, operation, resource scope, data classification, policy version, modified by / modified at
- Rationale block: visually distinct (slightly different bg, label "Rationale", reasoning text). This is MANDATORY and must stand apart from metadata.

Support URL query param ?agent=[id] for pre-filtering from Agent Detail page.
Clicking agent name navigates to /agents/[id].

Empty state: "No policy rules match the current filters" / "Adjust filters to view policy decisions across agents and integrations." / "Clear filters"

Design: dark mode, institutional calm. Policy effect badge must be highly legible. Rationale block must prevent the page from looking like generic RBAC UI.
```

---

### P-08: Architecture Page

**Goal:** Build the Architecture page with a conceptual control-architecture diagram and supporting explanatory notes.

**Why it matters:** This page provides disproportionate credibility during enterprise conversations. A technical leader should understand the future-state architecture quickly.

**Scope:**
- Page route at `/architecture`
- PageHeader with title "Architecture" and subtitle
- One large diagram showing: Human User/Owner, Enterprise IdP, Agent, Credential Binding Boundary, PEP, PDP, Approval Service, Authorized Integrations, Trace/Audit Store
- Flow lines showing the operation path
- 4 supporting note cards below the diagram
- Static content — no interactivity needed

**Out of scope:**
- Interactive diagram manipulation
- Clickable diagram elements linking to other pages
- Technical deep-dive content

**Inputs / dependencies:**
- P-01 (App Shell)
- C-01 (PageHeader)

**Files likely to be touched:**
- `app/architecture/page.tsx`
- `components/architecture/ArchitecturePage.tsx`
- `components/architecture/ArchitectureDiagram.tsx`
- `components/architecture/ArchitectureNoteCard.tsx`

**Detailed implementation notes:**
- The diagram can be built as a CSS/Tailwind grid with styled boxes and SVG or CSS connecting lines. Alternatively, use inline SVG. Do NOT use an external diagramming library.
- **Diagram boxes (9):** Human User / Owner, Enterprise IdP, Agent, Credential Binding Boundary, Policy Enforcement Point (PEP), Policy Decision Point (PDP), Approval Service, Authorized Integrations, Trace / Audit Store.
- **Flow path:** (1) Human/user context → (2) Agent operation request → (3) Identity/delegation resolution → (4) PEP → (5) PDP → (6) if approval required → Approval Service → (7) if approved → Authorized Integration → (8) Trace written throughout.
- Flow lines can be simple SVG paths or CSS borders with arrows.
- **4 note cards below diagram:**
  1. "Identity and delegation" — In production, agent identities may map to service principals or equivalent machine identities. Human approvers authenticate through the enterprise identity provider.
  2. "Policy evaluation" — The prototype simulates policy effects locally. A production deployment would typically externalize policy evaluation to a dedicated decision point.
  3. "Approval control" — Approval is distinct from policy evaluation. Policy may require human review before an operation proceeds.
  4. "Auditability" — Operations are represented as correlated traces rather than isolated log lines.
- Page subtitle: "Conceptual control architecture for governed AI agent operations in enterprise environments."
- Visual: cleanest page in the product. Technical, quiet, elegant. No cloud-sticker clutter, no overloaded enterprise boxes.

**Acceptance criteria:**
- [ ] Page renders at /architecture with diagram and 4 note cards
- [ ] All 9 diagram components are visible and labeled
- [ ] Flow path is legible and follows the correct order
- [ ] Note cards provide accurate explanatory text
- [ ] Page is the cleanest and most elegant in the product
- [ ] A technical stakeholder can understand the architecture quickly

**QA / test checklist:**
- [ ] Diagram renders without overflow on standard desktop viewport
- [ ] All boxes and labels are readable in dark mode
- [ ] Flow lines are visible and directional
- [ ] Note cards render below diagram with correct content
- [ ] No external dependencies required for diagram rendering

**Suggested order / priority:** 9

**AI-assistant friendly:** Yes (static content, well-defined structure)

**Ready-to-copy prompt:**
```
Build the Architecture page for a Next.js App Router project (TypeScript + Tailwind + shadcn/ui).

Route: /architecture
Files: app/architecture/page.tsx, components/architecture/ArchitecturePage.tsx, components/architecture/ArchitectureDiagram.tsx, components/architecture/ArchitectureNoteCard.tsx

This page provides architectural credibility. It should be the cleanest, most elegant page in the product.

PageHeader: title "Architecture", subtitle "Conceptual control architecture for governed AI agent operations in enterprise environments."

Diagram (build with CSS grid + inline SVG, no external diagramming libraries):
- 9 boxes: Human User / Owner, Enterprise IdP, Agent, Credential Binding Boundary, Policy Enforcement Point (PEP), Policy Decision Point (PDP), Approval Service, Authorized Integrations, Trace / Audit Store
- Flow path: Human context → Agent request → Identity resolution → PEP → PDP → (if needed) Approval Service → Authorized Integration → Trace written throughout
- Use SVG paths or CSS for flow arrows between boxes
- Boxes: dark cards with subtle borders, clean labels

4 note cards below diagram:
1. "Identity and delegation" — agent identities map to service principals; human approvers authenticate via enterprise IdP
2. "Policy evaluation" — prototype simulates locally; production would use external PDP
3. "Approval control" — approval is distinct from policy evaluation
4. "Auditability" — operations as correlated traces, not isolated logs

Design: dark mode, technical, quiet, elegant. No cloud-sticker clutter. No overloaded enterprise diagrams. Clean whitespace.
```

---

### P-09: Toast Notifications and Post-Action Feedback

**Goal:** Wire up toast notifications for approval granted, approval denied, and simulation reset events.

**Why it matters:** Light confirmation of state changes is needed to close the feedback loop after actions, keeping the demo experience smooth.

**Scope:**
- Toast notification on approval granted: "Approval recorded. Operation executed and trace updated."
- Toast notification on approval denied: "Denial recorded. Operation blocked and trace updated."
- Toast notification on simulation reset: "Simulation state reset"
- Use the shadcn/ui toast (sonner) already mounted in the app shell

**Out of scope:**
- Notification center
- Persistent notification history
- Sound or animation

**Inputs / dependencies:**
- P-01 (App Shell — toast container mounted)
- P-03 (Approval Detail — triggers approve/deny)
- S-04 (AppContext — reset triggers)

**Files likely to be touched:**
- `components/approvals/ApprovalDetailPanel.tsx` (add toast calls)
- `components/layout/ResetButton.tsx` (add toast call)
- `lib/state/AppContext.tsx` (optional: fire toasts from context actions)

**Detailed implementation notes:**
- Use `toast()` from sonner (or shadcn toast wrapper).
- On approve: `toast("Approval recorded. Operation executed and trace updated.")`
- On deny: `toast("Denial recorded. Operation blocked and trace updated.")`
- On reset: `toast("Simulation state reset")`
- Toast style: minimal, dark, muted. No icons. Brief duration (3–4 seconds). Position: bottom-right.

**Acceptance criteria:**
- [ ] Toast appears after approving a request
- [ ] Toast appears after denying a request
- [ ] Toast appears after resetting simulation
- [ ] Toasts auto-dismiss after ~4 seconds
- [ ] Toast styling matches dark mode institutional calm

**QA / test checklist:**
- [ ] Approve → toast text is correct
- [ ] Deny → toast text is correct
- [ ] Reset → toast text is correct
- [ ] Multiple toasts stack without overflow

**Suggested order / priority:** 10

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Wire up toast notifications for the Agent Identity & Approval Layer prototype (Next.js + Tailwind + shadcn/ui).

The app shell already mounts a toast container (sonner). Add toast calls for these events:

1. After approval granted: toast("Approval recorded. Operation executed and trace updated.")
2. After approval denied: toast("Denial recorded. Operation blocked and trace updated.")
3. After simulation reset: toast("Simulation state reset")

Files to modify:
- components/approvals/ApprovalDetailPanel.tsx — add toast calls after onApprove/onDeny
- components/layout/ResetButton.tsx — add toast call after resetScenarios()

Toast style: minimal, dark, no icons, 3-4 second auto-dismiss, bottom-right position.
```

---

### P-10: Guided Demo Flow and Polish Pass

**Goal:** Ensure the golden demo path works smoothly end-to-end in ~90 seconds, with proper reset behavior and preloaded relevant state.

**Why it matters:** The product must communicate value in under 2 minutes. The golden path must be rehearsed and smooth, with no dead ends or confusing empty states.

**Scope:**
- Verify golden path: Registry → Agent Detail → Policies → Approval Queue → Approval Detail → Audit Timeline → Architecture
- Ensure reset restores full default seeded state (pending approvals, traces, lifecycle states)
- Optional: lightweight "Simulation active" indicator in header
- Verify all navigation links and cross-page transitions work
- Verify the Approval Queue has at least one pending item on initial load
- Verify audit traces are pre-populated for all 4 scenarios
- Final visual consistency pass

**Out of scope:**
- Guided walkthrough tooltips
- Auto-play demo mode
- Video recording

**Inputs / dependencies:**
- All page tickets (P-01 through P-09)
- All component tickets
- All state/seed tickets

**Files likely to be touched:**
- `lib/state/AppContext.tsx` (reset function completeness)
- `components/layout/TopNav.tsx` (optional demo indicator)
- Various pages (polish adjustments)

**Detailed implementation notes:**
- Reset must restore: all approval requests to original seeded statuses (pending for scenario 1 & 2), all traces to initial state, all agent lifecycle states to defaults.
- Golden path test: start at /agents → click agent → view detail → navigate to /policies → see rules → navigate to /approvals → see pending items → click Review → approve one → see confirmation → navigate to /audit → see updated trace → navigate to /architecture → done.
- Optional demo indicator: small muted text in nav bar like "Simulation" or a subtle chip. Not prominent.
- Cross-page state: after approving in Approval Detail, the Audit page must show the updated trace, the Agent Detail must show updated recent activity, and the Approval Queue must show the updated status.

**Acceptance criteria:**
- [ ] Golden demo path completes without dead ends
- [ ] Reset restores all state to baseline
- [ ] Cross-page state consistency after approve/deny actions
- [ ] No empty states appear during the default demo path
- [ ] Product is understandable by a new viewer in under 2 minutes

**QA / test checklist:**
- [ ] Walk through golden path start to finish
- [ ] Approve a request, then check Audit, Agent Detail, and Approval Queue for consistency
- [ ] Reset simulation, then re-walk golden path
- [ ] Deny a request, verify trace and queue update
- [ ] Verify all navigation links work (no 404s)

**Suggested order / priority:** 11 (final ticket)

**AI-assistant friendly:** No (requires human judgment on flow quality and visual polish)

**Ready-to-copy prompt:**
```
N/A — This ticket requires human walkthrough and judgment. Use it as a QA checklist.

Golden demo path to verify:
1. /agents — see 3 agents
2. Click first agent → /agents/[id] — see full governance profile
3. Navigate to /policies — see decision cards with rationale
4. Navigate to /approvals — see pending items
5. Click Review on a pending item — slide-over opens
6. Approve the operation — confirmation appears, panel updates
7. Navigate to /audit — see updated trace with approval_granted event
8. Navigate to /architecture — see diagram and notes

Then reset simulation and repeat. All state should be restored.

Cross-page consistency checks:
- After approve: audit trace shows completed_with_approval, approval queue shows Approved status, agent detail shows updated recent activity
- After deny: audit trace shows denied, approval queue shows Denied status
- After reset: all pending approvals restored, all traces restored, all lifecycle states restored
```

---

## Section 2 — Component-Level Tickets

---

### C-01: PageHeader Component

**Goal:** Build a reusable PageHeader component that renders a page title and one-line explanatory subtitle.

**Why it matters:** Every page uses the same header pattern. Consistency is critical for the institutional feel.

**Scope:**
- Renders a large title and a muted subtitle
- Optional: toolbar slot for children

**Out of scope:**
- Page-specific toolbar content (handled by each page)

**Inputs / dependencies:**
- S-01 (project init)

**Files likely to be touched:**
- `components/ui/PageHeader.tsx`

**Detailed implementation notes:**
- Props: `title: string`, `subtitle: string`, `children?: ReactNode` (for toolbar row below subtitle).
- Title: `text-2xl font-semibold text-white/90`
- Subtitle: `text-sm text-white/50 mt-1`
- Toolbar slot: renders `{children}` below subtitle with `mt-4` spacing.
- Bottom border or spacing to separate from content.

**Acceptance criteria:**
- [ ] Renders title and subtitle with correct hierarchy
- [ ] Children slot renders toolbar content when provided
- [ ] Matches dark-mode institutional calm aesthetic

**QA / test checklist:**
- [ ] Renders with title only (no subtitle)
- [ ] Renders with title + subtitle
- [ ] Renders with title + subtitle + toolbar children
- [ ] Typography is correct weight and color

**Suggested order / priority:** 2a (first batch of components, before pages)

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a PageHeader component for a Next.js project (TypeScript + Tailwind).

File: components/ui/PageHeader.tsx

Props:
- title: string
- subtitle: string
- children?: ReactNode (toolbar slot)

Renders:
- Title: text-2xl font-semibold text-white/90
- Subtitle: text-sm text-white/50 mt-1
- Children (toolbar): mt-4 below subtitle
- Bottom spacing/border to separate from page content

Dark mode, institutional calm aesthetic. No decorative elements.
```

---

### C-02: StatusBadge Component

**Goal:** Build a reusable StatusBadge that renders semantic status labels across 4 categories: lifecycle, policy, approval, and trace.

**Why it matters:** Status badges are the most frequently used visual primitive. They encode lifecycle state, policy effect, approval status, and trace outcome with consistent semantic color.

**Scope:**
- Props: label, category, and optional size
- Categories: lifecycle, policy, approval, trace
- Correct color mapping for each label within each category
- Compact pill-style rendering

**Out of scope:**
- Animated badges
- Icon badges

**Inputs / dependencies:**
- S-01 (project init)

**Files likely to be touched:**
- `components/ui/StatusBadge.tsx`

**Detailed implementation notes:**
- Props: `label: string`, `category: 'lifecycle' | 'policy' | 'approval' | 'trace'`, `size?: 'sm' | 'md'`
- Color mapping (all muted, not saturated):
  - **Lifecycle:** active → green/teal, suspended → amber/yellow, revoked → red
  - **Policy effect:** allowed → green/teal, approval_required → amber, denied → red
  - **Approval status:** pending → amber, approved → green/teal, denied → red
  - **Trace outcome:** executed → green/teal, completed_with_approval → blue/teal, denied → red, blocked → red/muted
- Render as: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`
- Background: `bg-{color}/10`, text: `text-{color}-400`
- Labels should be title-cased for display: "Active", "Approval Required", "Pending", etc.

**Acceptance criteria:**
- [ ] Renders correct color for every label in every category
- [ ] Pill style is consistent across all instances
- [ ] Readable in dark mode
- [ ] Size variant works (sm and md)

**QA / test checklist:**
- [ ] Render each lifecycle state — correct color
- [ ] Render each policy effect — correct color
- [ ] Render each approval status — correct color
- [ ] Render each trace outcome — correct color
- [ ] No color collisions between categories (e.g., "denied" in policy vs approval should both be red but distinguishable by context)

**Suggested order / priority:** 2b

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a StatusBadge component for a Next.js project (TypeScript + Tailwind).

File: components/ui/StatusBadge.tsx

Props:
- label: string
- category: 'lifecycle' | 'policy' | 'approval' | 'trace'
- size?: 'sm' | 'md' (default 'sm')

Color mapping (muted, not saturated — dark mode):
- Lifecycle: active → emerald, suspended → amber, revoked → red
- Policy: allowed → emerald, approval_required → amber, denied → red
- Approval: pending → amber, approved → emerald, denied → red
- Trace: executed → emerald, completed_with_approval → sky/teal, denied → red, blocked → red/muted

Style: inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
Background: bg-{color}-500/10, text: text-{color}-400

Display labels title-cased: "Active", "Approval Required", "Pending", "Completed With Approval", etc.

Format the label by replacing underscores with spaces and title-casing.
```

---

### C-03: DataRow Component

**Goal:** Build a reusable DataRow component that renders a label-value pair in a structured grid format.

**Why it matters:** Agent Detail, Approval Detail, and other sections need consistent label-value rendering. This is the building block for structured data display.

**Scope:**
- Label (muted) + value (bright) in a horizontal row
- Optional: monospace variant for trace IDs

**Out of scope:**
- Editable fields
- Multi-line values

**Inputs / dependencies:**
- S-01 (project init)

**Files likely to be touched:**
- `components/ui/DataRow.tsx`

**Detailed implementation notes:**
- Props: `label: string`, `value: string | ReactNode`, `mono?: boolean`
- Layout: `grid grid-cols-[180px_1fr] gap-2 py-1.5`
- Label: `text-sm text-white/40 font-medium`
- Value: `text-sm text-white/80`, if `mono` then also `font-mono-trace` (JetBrains Mono)
- Can also accept a `compact` prop for tighter spacing.

**Acceptance criteria:**
- [ ] Renders label and value in aligned grid
- [ ] Mono variant applies JetBrains Mono to value
- [ ] Consistent across all usage contexts

**QA / test checklist:**
- [ ] Regular text value renders correctly
- [ ] ReactNode value (e.g., StatusBadge) renders correctly
- [ ] Mono variant applies correct font

**Suggested order / priority:** 2c

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a DataRow component for a Next.js project (TypeScript + Tailwind).

File: components/ui/DataRow.tsx

Props:
- label: string
- value: string | ReactNode
- mono?: boolean (applies JetBrains Mono class)

Layout: grid grid-cols-[180px_1fr] gap-2 py-1.5
Label: text-sm text-white/40 font-medium
Value: text-sm text-white/80. If mono=true, add font-mono class (JetBrains Mono).

Dark mode. Clean, structured, no decoration.
```

---

### C-04: StatCard Component

**Goal:** Build a reusable StatCard component for displaying a single metric with label.

**Why it matters:** Used in Agent Detail (policy summary counts) and potentially elsewhere. Provides a clean, enterprise-grade metric display.

**Scope:**
- Renders a numeric value and a label
- Optional: semantic color variant

**Out of scope:**
- Charts or sparklines
- Click interactions

**Inputs / dependencies:**
- S-01 (project init)

**Files likely to be touched:**
- `components/ui/StatCard.tsx`

**Detailed implementation notes:**
- Props: `value: number | string`, `label: string`, `tone?: 'default' | 'success' | 'warning' | 'danger'`
- Container: `bg-white/[0.03] border border-white/[0.06] rounded-lg p-4`
- Value: `text-2xl font-semibold text-white/90`
- Label: `text-xs text-white/40 mt-1 uppercase tracking-wide`
- Tone applies a subtle left border color accent.

**Acceptance criteria:**
- [ ] Renders value and label
- [ ] Tone variants apply correct accent color
- [ ] Consistent dark-mode styling

**QA / test checklist:**
- [ ] Default tone renders cleanly
- [ ] Success/warning/danger tones show correct accent
- [ ] Numeric and string values both work

**Suggested order / priority:** 2d

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a StatCard component for a Next.js project (TypeScript + Tailwind).

File: components/ui/StatCard.tsx

Props:
- value: number | string
- label: string
- tone?: 'default' | 'success' | 'warning' | 'danger'

Container: bg-white/[0.03] border border-white/[0.06] rounded-lg p-4
Value: text-2xl font-semibold text-white/90
Label: text-xs text-white/40 mt-1 uppercase tracking-wide
Tone: applies subtle left border color (emerald for success, amber for warning, red for danger)

Dark mode, institutional calm. No decorative elements.
```

---

### C-05: QueueItemCard Component

**Goal:** Build the QueueItemCard used on the Approval Queue page, displaying a pending operation as a structured briefing card with a prominent "Why this was flagged" block.

**Why it matters:** This card is the primary unit of interaction on one of the two most important screens. The "Why this was flagged" block is the conceptual center of the product.

**Scope:**
- Full card rendering: top line (operation + status badge + trace ID), second line (agent, owner, environment), body (integration, scope, classification, authority, delegation, policy effect), "Why this was flagged" block, footer (timestamp, SoD status, Review button)
- "Review" button triggers `onReview` callback

**Out of scope:**
- Approve/Deny inline (handled by slide-over)
- Card expansion

**Inputs / dependencies:**
- S-02 (TypeScript types — ApprovalRequest)
- C-02 (StatusBadge)
- C-03 (DataRow)

**Files likely to be touched:**
- `components/approvals/QueueItemCard.tsx`

**Detailed implementation notes:**
- Props: `approvalRequest: ApprovalRequest`, `agentName: string`, `onReview: (id: string) => void`
- Card container: `bg-white/[0.02] border border-white/[0.06] rounded-lg p-5`
- **Top line:** `<div class="flex justify-between">` — left: operation text (font-medium text-white/90), right: StatusBadge (approval category, label from status) + trace ID in mono
- **Second line:** agent name, owner, environment — `text-sm text-white/50`
- **Body rows:** use DataRow or inline label-value pairs for: target integration, resource scope, data classification, authority model, delegated from (if applicable), policy effect badge
- **"Why this was flagged" block:** MOST IMPORTANT. Container: `bg-amber-500/[0.04] border-l-2 border-amber-500/30 rounded-r-md p-4 mt-4`. Title: `text-xs uppercase tracking-wide text-amber-400/80 font-medium mb-1` "Why this was flagged". Body: `text-sm text-white/70 leading-relaxed` with the flag_reason text.
- **Footer:** `flex justify-between items-center mt-4 pt-3 border-t border-white/[0.06]`. Left: timestamp + SoD status. Right: "Review" button (shadcn Button variant outline, small).

**Acceptance criteria:**
- [ ] Card renders all fields correctly for a given ApprovalRequest
- [ ] "Why this was flagged" block is visually prominent with amber accent
- [ ] Review button calls onReview with correct ID
- [ ] Card feels like a briefing, not a form

**QA / test checklist:**
- [ ] Render card for each seeded approval request — all fields populated
- [ ] "Why this was flagged" block is visually the strongest element
- [ ] Click Review — callback fires with correct ID
- [ ] Card renders cleanly for requests with and without delegated_from

**Suggested order / priority:** 2e

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a QueueItemCard component for a Next.js project (TypeScript + Tailwind + shadcn/ui).

File: components/approvals/QueueItemCard.tsx

Props:
- approvalRequest: ApprovalRequest (from lib/types)
- agentName: string
- onReview: (id: string) => void

Card container: bg-white/[0.02] border border-white/[0.06] rounded-lg p-5

Structure:
1. Top line (flex justify-between): operation text (font-medium text-white/90) | StatusBadge (approval category) + trace ID (mono)
2. Second line: agent name, owner, environment (text-sm text-white/50)
3. Body rows: target integration, resource scope, data classification, authority model, delegated from (if set), policy effect badge
4. "Why this was flagged" block (MOST IMPORTANT):
   - Container: bg-amber-500/[0.04] border-l-2 border-amber-500/30 rounded-r-md p-4 mt-4
   - Title: "Why this was flagged" (text-xs uppercase tracking-wide text-amber-400/80 font-medium)
   - Body: flag_reason text (text-sm text-white/70 leading-relaxed)
5. Footer (flex justify-between, top border): timestamp + SoD status | "Review" button (shadcn Button, outline variant, small)

Dark mode, institutional calm. The "Why this was flagged" block is the visual anchor.
```

---

### C-06: SlideOverPanel Component

**Goal:** Build a reusable slide-over panel wrapper that slides in from the right with a backdrop overlay.

**Why it matters:** Used by Approval Detail. Provides a focused review experience without full page navigation.

**Scope:**
- Slide-in from right animation
- Configurable width
- Semi-transparent backdrop
- Close on backdrop click or close button
- Children slot for content

**Out of scope:**
- Multiple simultaneous panels
- Left-side slide-over

**Inputs / dependencies:**
- S-01 (project init)

**Files likely to be touched:**
- `components/layout/SlideOverPanel.tsx`

**Detailed implementation notes:**
- Props: `isOpen: boolean`, `onClose: () => void`, `width?: string` (default `w-[45vw]`), `children: ReactNode`
- Backdrop: `fixed inset-0 bg-black/40 z-40` — click to close
- Panel: `fixed top-0 right-0 h-full z-50 bg-[#0f0f14] border-l border-white/[0.06] overflow-y-auto` + `transform transition-transform duration-300` — `translate-x-0` when open, `translate-x-full` when closed.
- Use `useEffect` to prevent body scroll when open.

**Acceptance criteria:**
- [ ] Panel slides in from right with smooth transition
- [ ] Backdrop is semi-transparent and clickable to close
- [ ] Content renders inside the panel
- [ ] Panel closes on backdrop click and close button
- [ ] No layout shift on the underlying page

**QA / test checklist:**
- [ ] Open and close transition is smooth
- [ ] Backdrop click closes panel
- [ ] Scroll works inside panel for long content
- [ ] Body scroll is disabled when panel is open

**Suggested order / priority:** 2f

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a SlideOverPanel component for a Next.js project (TypeScript + Tailwind).

File: components/layout/SlideOverPanel.tsx

Props:
- isOpen: boolean
- onClose: () => void
- width?: string (default "w-[45vw]")
- children: ReactNode

Backdrop: fixed inset-0 bg-black/40 z-40, click to close
Panel: fixed top-0 right-0 h-full z-50 bg-[#0f0f14] border-l border-white/[0.06] overflow-y-auto
Animation: transform transition-transform duration-300, translate-x-0 when open, translate-x-full when closed
Prevent body scroll when open (useEffect).

Dark mode. Clean, no decoration. Stable layout — no jumps when opening/closing.
```

---

### C-07: PillFilter Component

**Goal:** Build a reusable pill-based filter component for toolbar rows.

**Why it matters:** Used on every list page (Registry, Policies, Approval Queue, Audit) for filtering by dimension.

**Scope:**
- Renders a set of selectable pill options for one filter dimension
- Single-select with "All" option
- Visual active state

**Out of scope:**
- Multi-select
- Dropdown variant

**Inputs / dependencies:**
- S-01 (project init)

**Files likely to be touched:**
- `components/ui/PillFilter.tsx`

**Detailed implementation notes:**
- Props: `label: string`, `options: string[]`, `value: string | null`, `onChange: (value: string | null) => void`
- Layout: horizontal flex with label + pills. Label: `text-xs text-white/40 uppercase tracking-wide mr-2`. Each pill: `px-3 py-1 rounded-full text-xs cursor-pointer transition-colors`. Active: `bg-white/10 text-white/90`. Inactive: `bg-transparent text-white/40 hover:text-white/60`.
- First option is always "All" (value: null).

**Acceptance criteria:**
- [ ] Renders label and pills
- [ ] Clicking a pill selects it and deselects others
- [ ] "All" option clears the filter
- [ ] Active state is visually distinct

**QA / test checklist:**
- [ ] Select each option — onChange fires with correct value
- [ ] Select "All" — onChange fires with null
- [ ] Active pill is visually highlighted

**Suggested order / priority:** 2g

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a PillFilter component for a Next.js project (TypeScript + Tailwind).

File: components/ui/PillFilter.tsx

Props:
- label: string
- options: string[]
- value: string | null
- onChange: (value: string | null) => void

Layout: horizontal flex. Label (text-xs text-white/40 uppercase tracking-wide mr-2) + pills.
Each pill: px-3 py-1 rounded-full text-xs cursor-pointer transition-colors
Active: bg-white/10 text-white/90
Inactive: bg-transparent text-white/40 hover:text-white/60
First option is always "All" (value = null, clears filter).

Single-select. Dark mode.
```

---

### C-08: SearchInput Component

**Goal:** Build a reusable search input component for toolbar rows.

**Why it matters:** Used on multiple pages for search-by-name, search-by-trace-ID, or search-by-operation.

**Scope:**
- Text input with placeholder text
- Debounced onChange
- Optional clear button

**Out of scope:**
- Autocomplete / suggestions
- Search icon animation

**Inputs / dependencies:**
- S-01 (project init)

**Files likely to be touched:**
- `components/ui/SearchInput.tsx`

**Detailed implementation notes:**
- Props: `placeholder: string`, `value: string`, `onChange: (value: string) => void`
- Use shadcn/ui `Input` component with dark styling override: `bg-white/[0.03] border-white/[0.08] text-white/80 placeholder:text-white/30`
- Optional: debounce 200ms on onChange using a simple useEffect + setTimeout pattern.
- Width: `w-64` or configurable.

**Acceptance criteria:**
- [ ] Renders input with placeholder
- [ ] Typing fires onChange with value
- [ ] Styling matches dark mode

**QA / test checklist:**
- [ ] Type text — value updates
- [ ] Clear text — value resets
- [ ] Placeholder is visible when empty

**Suggested order / priority:** 2h

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a SearchInput component for a Next.js project (TypeScript + Tailwind + shadcn/ui).

File: components/ui/SearchInput.tsx

Props:
- placeholder: string
- value: string
- onChange: (value: string) => void

Use shadcn/ui Input with dark styling: bg-white/[0.03] border-white/[0.08] text-white/80 placeholder:text-white/30
Width: w-64 (or accept className override)
Optional: 200ms debounce on onChange.
```

---

### C-09: EmptyState Component

**Goal:** Build a reusable empty state component for zero-result filter states.

**Why it matters:** Used on Registry, Policies, Approval Queue, and Audit pages when filters produce no results.

**Scope:**
- Title, body text, and action button
- Centered layout

**Out of scope:**
- Illustrations or icons

**Inputs / dependencies:**
- S-01 (project init)

**Files likely to be touched:**
- `components/ui/EmptyState.tsx`

**Detailed implementation notes:**
- Props: `title: string`, `body: string`, `actionLabel?: string`, `onAction?: () => void`
- Container: centered, `py-16 text-center`
- Title: `text-lg font-medium text-white/60`
- Body: `text-sm text-white/40 mt-2 max-w-md mx-auto`
- Action button: `mt-4`, shadcn Button variant ghost/outline, small

**Acceptance criteria:**
- [ ] Renders title and body centered
- [ ] Action button is optional and clickable
- [ ] Matches dark mode aesthetic

**QA / test checklist:**
- [ ] Renders without action button
- [ ] Renders with action button — click fires onAction
- [ ] Text is centered and legible

**Suggested order / priority:** 2i

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build an EmptyState component for a Next.js project (TypeScript + Tailwind + shadcn/ui).

File: components/ui/EmptyState.tsx

Props:
- title: string
- body: string
- actionLabel?: string
- onAction?: () => void

Container: centered, py-16 text-center
Title: text-lg font-medium text-white/60
Body: text-sm text-white/40 mt-2 max-w-md mx-auto
Action button (optional): mt-4, shadcn Button variant ghost, small

Dark mode.
```

---

### C-10: TraceTimeline Component

**Goal:** Build the vertical timeline component that renders a sequence of audit events as connected nodes on a spine.

**Why it matters:** This is the core visual element of the Audit page — it must communicate causality and evidence, not just a list of events.

**Scope:**
- Vertical spine with event nodes
- Each node renders a TraceEventRow
- Approval decision event visually emphasized
- Final outcome node at bottom

**Out of scope:**
- Horizontal timeline
- Zoom/pan
- Animated sequencing

**Inputs / dependencies:**
- S-02 (TypeScript types — AuditEvent)
- C-11 (TraceEventRow)

**Files likely to be touched:**
- `components/audit/TraceTimeline.tsx`

**Detailed implementation notes:**
- Props: `events: AuditEvent[]`
- Layout: vertical list with a left spine line. Each event is a node on the spine.
- Spine: `border-l-2 border-white/[0.08]` running vertically. Each node: a small circle (`w-3 h-3 rounded-full`) positioned on the spine.
- Node color: default `bg-white/20`, approval events `bg-amber-400`, final outcome `bg-emerald-400` or `bg-red-400` depending on result.
- Each node connects to a TraceEventRow displaying the event details.
- Spacing between events: `py-4` or `py-6`.

**Acceptance criteria:**
- [ ] Renders vertical timeline with connected nodes
- [ ] Events appear in correct chronological order
- [ ] Approval decision event is visually emphasized
- [ ] Final outcome node has semantic color
- [ ] Timeline feels like evidence, not a log

**QA / test checklist:**
- [ ] Render 9-event trace — all events connected on spine
- [ ] Approval event node has different color
- [ ] Final event node reflects outcome
- [ ] Empty events array renders gracefully

**Suggested order / priority:** 2j

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a TraceTimeline component for a Next.js project (TypeScript + Tailwind).

File: components/audit/TraceTimeline.tsx

Props:
- events: AuditEvent[] (from lib/types)

Renders a vertical timeline with a left spine line and event nodes.

Spine: border-l-2 border-white/[0.08] running vertically on the left
Event nodes: small circles (w-3 h-3 rounded-full) positioned on the spine
- Default node: bg-white/20
- Approval-related events: bg-amber-400
- Final outcome: bg-emerald-400 (success) or bg-red-400 (denied/blocked)

Each node connects to a TraceEventRow component that displays the event details.
Events rendered in chronological order, spaced with py-4 or py-6.

Design: must feel like evidence, not a log. Dark mode, institutional calm.
```

---

### C-11: TraceEventRow Component

**Goal:** Build a single event row for the audit timeline, displaying timestamp, event type, actor, description, and status.

**Why it matters:** Each event row is a unit of evidence. The factual, precise rendering is what makes the audit feel serious.

**Scope:**
- Renders one AuditEvent with all fields
- Timestamp in JetBrains Mono
- Status indicator
- Policy version if relevant

**Out of scope:**
- Click-to-expand details
- Event editing

**Inputs / dependencies:**
- S-02 (TypeScript types — AuditEvent)
- C-02 (StatusBadge)

**Files likely to be touched:**
- `components/audit/TraceEventRow.tsx`

**Detailed implementation notes:**
- Props: `event: AuditEvent`
- Layout: horizontal row or structured block next to the timeline node.
- Timestamp: `text-xs font-mono-trace text-white/40` — format as HH:MM:SS
- Event type: `text-sm font-medium text-white/70` — format with title case and replace underscores
- Actor line: `text-xs text-white/40` — "Actor: {actor_type} · {actor_name}"
- Description: `text-sm text-white/60 mt-1`
- Status: small StatusBadge or inline indicator
- Policy version: `text-xs text-white/30` shown conditionally

**Acceptance criteria:**
- [ ] Renders all event fields correctly
- [ ] Timestamp uses monospace font
- [ ] Description reads as factual evidence
- [ ] Policy version shown when present, hidden when null

**QA / test checklist:**
- [ ] Render events of different types — all fields populated
- [ ] Event with policy_version shows it; event without does not
- [ ] Timestamp format is consistent

**Suggested order / priority:** 2k

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a TraceEventRow component for a Next.js project (TypeScript + Tailwind).

File: components/audit/TraceEventRow.tsx

Props:
- event: AuditEvent (from lib/types)

Layout:
- Timestamp: text-xs font-mono (JetBrains Mono) text-white/40, format HH:MM:SS
- Event type: text-sm font-medium text-white/70, title-cased with underscores replaced
- Actor: text-xs text-white/40 — "Actor: {actor_type} · {actor_name}"
- Description: text-sm text-white/60 mt-1
- Status: small inline status indicator
- Policy version: text-xs text-white/30, shown only when present

Dark mode. Factual, precise, evidence-grade.
```

---

### C-12: AgentRowCard Component

**Goal:** Build the rich row card used in the Agent Registry, showing an agent's core identity, governance metadata, and navigation affordance.

**Why it matters:** This is the primary unit on the Registry page. It must communicate that agents are governed enterprise assets at a glance.

**Scope:**
- Full row rendering: left (name, description), middle (owner, team, environment, authority model), right (autonomy tier badge, lifecycle badge, review date, activity indicator), far right (chevron)
- Click handler for navigation

**Out of scope:**
- Inline editing
- Context menu

**Inputs / dependencies:**
- S-02 (TypeScript types — Agent)
- C-02 (StatusBadge)

**Files likely to be touched:**
- `components/agents/AgentRowCard.tsx`

**Detailed implementation notes:**
- Props: `agent: Agent`, `onClick: (id: string) => void`
- Container: `bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 cursor-pointer hover:bg-white/[0.04] transition-colors`
- Layout: CSS grid or flex — 4 zones (left, middle, right metadata, far-right chevron).
- Left: agent name (`text-base font-medium text-white/90`), description (`text-sm text-white/50 mt-0.5`)
- Middle: compact DataRow-style lines for owner, team, environment, authority model
- Right: StatusBadge for autonomy tier, StatusBadge for lifecycle state, next review date text, activity indicator (e.g., "3 recent traces" or a dot)
- Far right: `→` chevron or "View details" text link

**Acceptance criteria:**
- [ ] Renders all agent metadata in structured zones
- [ ] Hover state is subtle
- [ ] Click fires onClick with agent ID
- [ ] Badges for autonomy and lifecycle render correctly
- [ ] Card feels like an enterprise registry row, not a generic list item

**QA / test checklist:**
- [ ] Render for each of the 3 agents — all fields populated
- [ ] Click each card — correct ID passed
- [ ] Hover effect is visible but restrained

**Suggested order / priority:** 2l

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build an AgentRowCard component for a Next.js project (TypeScript + Tailwind).

File: components/agents/AgentRowCard.tsx

Props:
- agent: Agent (from lib/types)
- onClick: (id: string) => void

Container: bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 cursor-pointer hover:bg-white/[0.04] transition-colors

Layout (4 zones, flex or grid):
- Left: agent name (text-base font-medium text-white/90), description (text-sm text-white/50)
- Middle: owner, team, environment, authority model (compact label-value pairs)
- Right: StatusBadge for autonomy tier, StatusBadge for lifecycle state, next review date, activity indicator
- Far right: → chevron

Click calls onClick(agent.id). Subtle hover. Dark mode, institutional calm.
```

---

### C-13: DecisionCard Component

**Goal:** Build the policy decision card used on the Policies page, showing a policy rule with effect badge, metadata, and mandatory rationale block.

**Why it matters:** The rationale block is what prevents the Policies page from being generic RBAC UI. It demonstrates that governance is reasoned.

**Scope:**
- Full card: top line (policy name + effect badge), body (agent, integration, operation, scope, classification, version, modified by/at), rationale block
- Optional: session TTL display

**Out of scope:**
- Policy editing
- Version history

**Inputs / dependencies:**
- S-02 (TypeScript types — PolicyRule)
- C-02 (StatusBadge)

**Files likely to be touched:**
- `components/policies/DecisionCard.tsx`

**Detailed implementation notes:**
- Props: `policyRule: PolicyRule`, `agentName: string`, `onAgentClick?: (agentId: string) => void`
- Container: `bg-white/[0.02] border border-white/[0.06] rounded-lg p-5`
- **Top line:** policy name (`text-base font-medium text-white/90`) + StatusBadge (policy category, effect label)
- **Body rows:** DataRow-style pairs for: agent (clickable → onAgentClick), authorized integration, operation, resource scope, data classification, policy version, modified by, modified at
- **Rationale block:** `bg-white/[0.03] border-l-2 border-blue-400/30 rounded-r-md p-4 mt-4`. Label: "Rationale" (`text-xs uppercase tracking-wide text-blue-400/60 font-medium mb-1`). Body: rationale text (`text-sm text-white/60 leading-relaxed`).
- Optional footer: session TTL if present.

**Acceptance criteria:**
- [ ] Renders policy name and effect badge prominently
- [ ] All metadata fields render correctly
- [ ] Rationale block is visually distinct from metadata
- [ ] Agent name is clickable if onAgentClick provided
- [ ] Card reads as a governed decision, not a permissions row

**QA / test checklist:**
- [ ] Render for each policy rule — all fields populated
- [ ] Rationale block stands out visually
- [ ] Click agent name — fires callback
- [ ] Effect badges for allowed/approval_required/denied are distinct

**Suggested order / priority:** 2m

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Build a DecisionCard component for a Next.js project (TypeScript + Tailwind).

File: components/policies/DecisionCard.tsx

Props:
- policyRule: PolicyRule (from lib/types)
- agentName: string
- onAgentClick?: (agentId: string) => void

Container: bg-white/[0.02] border border-white/[0.06] rounded-lg p-5

Structure:
1. Top line: policy name (text-base font-medium text-white/90) + StatusBadge (policy category, effect)
2. Body rows: agent (clickable), authorized integration, operation, resource scope, data classification, policy version, modified by, modified at
3. Rationale block (MANDATORY, visually distinct):
   - Container: bg-white/[0.03] border-l-2 border-blue-400/30 rounded-r-md p-4 mt-4
   - Label: "Rationale" (text-xs uppercase tracking-wide text-blue-400/60 font-medium mb-1)
   - Body: rationale text (text-sm text-white/60 leading-relaxed)

Dark mode. The rationale block is what makes this NOT a generic RBAC UI.
```

---

## Section 3 — State / Seed-Data Tickets

---

### S-01: Project Initialization and Toolchain Setup

**Goal:** Initialize the Next.js project with TypeScript, Tailwind CSS, and shadcn/ui. Configure the foundational toolchain.

**Why it matters:** Every other ticket depends on the project existing and being correctly configured.

**Scope:**
- Next.js 14+ with App Router
- TypeScript strict mode
- Tailwind CSS with dark mode (`class` strategy)
- shadcn/ui initialization
- Inter and JetBrains Mono fonts
- Base color palette and semantic CSS variables for dark mode
- Folder structure scaffolding

**Out of scope:**
- Component code
- Seed data
- State management

**Inputs / dependencies:**
- None (first ticket)

**Files likely to be touched:**
- `package.json`
- `tsconfig.json`
- `tailwind.config.ts`
- `app/layout.tsx` (basic)
- `app/globals.css`
- `components.json` (shadcn config)
- Folder stubs: `components/ui/`, `components/agents/`, `components/policies/`, `components/approvals/`, `components/audit/`, `components/architecture/`, `components/layout/`, `lib/types/`, `lib/fixtures/`, `lib/state/`

**Detailed implementation notes:**
- `npx create-next-app@latest agent-identity --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"`
- `npx shadcn@latest init` — choose dark theme defaults
- Tailwind config: `darkMode: 'class'`, extend theme with custom colors:
  ```
  colors: {
    surface: { DEFAULT: '#0a0a0f', raised: '#12121a', overlay: '#1a1a24' },
    border: { subtle: 'rgba(255,255,255,0.06)', DEFAULT: 'rgba(255,255,255,0.1)' },
    semantic: { success: '#10b981', warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6' }
  }
  ```
- globals.css: set body bg to surface, default text to white/80
- Create all folder stubs as empty directories (can add `.gitkeep` files)
- Add `sonner` for toasts: `npm install sonner`
- tsconfig: `strict: true`

**Acceptance criteria:**
- [ ] `npm run dev` starts without errors
- [ ] Dark mode renders correctly
- [ ] shadcn/ui Button component can be imported and rendered
- [ ] All folder stubs exist
- [ ] TypeScript strict mode is on
- [ ] Inter and JetBrains Mono fonts load

**QA / test checklist:**
- [ ] Fresh `npm install && npm run dev` — no errors
- [ ] Import a shadcn component — renders correctly
- [ ] Tailwind classes apply in dark mode
- [ ] Custom color tokens work in classes

**Suggested order / priority:** 0 (absolute first)

**AI-assistant friendly:** Yes

**Ready-to-copy prompt:**
```
Initialize a Next.js project for the "Agent Identity & Approval Layer" prototype.

Steps:
1. Create Next.js 14+ app with App Router, TypeScript, Tailwind, ESLint: npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
2. Initialize shadcn/ui: npx shadcn@latest init (dark theme)
3. Install sonner for toasts: npm install sonner
4. Configure tailwind.config.ts:
   - darkMode: 'class'
   - Extend colors: surface (#0a0a0f, raised #12121a, overlay #1a1a24), border (subtle rgba(255,255,255,0.06)), semantic (success #10b981, warning #f59e0b, danger #ef4444, info #3b82f6)
5. Configure globals.css: body background surface, text white/80
6. Load Inter (default) and JetBrains Mono (mono) via next/font/google
7. Set tsconfig strict: true
8. Create folder structure:
   - components/ui/
   - components/agents/
   - components/policies/
   - components/approvals/
   - components/audit/
   - components/architecture/
   - components/layout/
   - lib/types/
   - lib/fixtures/
   - lib/state/

Verify: npm run dev starts clean, shadcn Button renders, dark mode works, custom colors apply.
```

---

### S-02: TypeScript Type Definitions

**Goal:** Define all TypeScript types, interfaces, and enum types for the data model: Agent, PolicyRule, ApprovalRequest, AuditTrace, AuditEvent, and all associated enums.

**Why it matters:** Strong typing is a hard requirement. Every component and fixture depends on these types. They are the contract that prevents terminology drift and structural ambiguity across the entire codebase.

**Scope:**
- `Agent` interface with all fields from PRD 17.1
- `PolicyRule` interface with all fields from PRD 17.2
- `ApprovalRequest` interface with all fields from PRD 17.3
- `AuditTrace` interface with all fields from PRD 17.4
- `AuditEvent` interface with all fields from PRD 17.5
- All enum types: Environment, AuthorityModel, IdentityMode, DelegationModel, AutonomyTier, LifecycleState, DataClassification, PolicyEffect, ApprovalStatus, SeparationOfDutiesCheck, TraceOutcome, ActorType, EventType
- `AuthorizedIntegration` sub-type for the agent's integrations list

**Out of scope:**
- Seed data values (S-03)
- State management (S-04)

**Inputs / dependencies:**
- S-01 (project init)
- PRD sections 17.1–17.5 (data model)

**Files likely to be touched:**
- `lib/types/index.ts`
- `lib/types/agent.ts`
- `lib/types/policy.ts`
- `lib/types/approval.ts`
- `lib/types/audit.ts`
- `lib/types/enums.ts`

**Detailed implementation notes:**

Enums (use string literal union types for simplicity with AI assistants):

```typescript
// lib/types/enums.ts
export type Environment = 'dev' | 'test' | 'prod';
export type AuthorityModel = 'self' | 'delegated' | 'hybrid';
export type IdentityMode = 'service_identity' | 'delegated_identity' | 'hybrid_identity';
export type DelegationModel = 'self' | 'on_behalf_of_user' | 'on_behalf_of_owner' | 'mixed';
export type AutonomyTier = 'low' | 'medium' | 'high';
export type LifecycleState = 'active' | 'suspended' | 'revoked';
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';
export type PolicyEffect = 'allow' | 'approval_required' | 'deny';
export type ApprovalStatus = 'pending' | 'approved' | 'denied';
export type SeparationOfDutiesCheck = 'pass' | 'fail' | 'not_applicable';
export type TraceOutcome = 'executed' | 'blocked' | 'denied' | 'completed_with_approval';
export type ActorType = 'agent' | 'policy_engine' | 'approval_service' | 'human_reviewer' | 'system';
export type EventType = 'trace_initiated' | 'identity_resolved' | 'delegation_resolved' | 'policy_evaluated' | 'sensitive_operation_detected' | 'approval_required' | 'approval_granted' | 'approval_denied' | 'operation_executed' | 'operation_blocked' | 'trace_closed';
```

Interfaces:

```typescript
// lib/types/agent.ts
export interface AuthorizedIntegration {
  name: string;
  resource_scope: string;
  data_classification: DataClassification;
  allowed_operations: string[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  owner_name: string;
  owner_role: string;
  team: string;
  environment: Environment;
  authority_model: AuthorityModel;
  identity_mode: IdentityMode;
  delegation_model: DelegationModel;
  autonomy_tier: AutonomyTier;
  lifecycle_state: LifecycleState;
  authorized_integrations: AuthorizedIntegration[];
  next_review_date: string;
  recent_activity_state: string;
}
```

Similar for PolicyRule, ApprovalRequest, AuditTrace, AuditEvent — follow PRD 17.x exactly.

Re-export everything from `lib/types/index.ts`.

**Acceptance criteria:**
- [ ] All interfaces match PRD data model exactly
- [ ] All enum types cover every value listed in PRD
- [ ] Types compile with TypeScript strict mode
- [ ] Re-exported from lib/types/index.ts
- [ ] Field names use snake_case as specified in PRD

**QA / test checklist:**
- [ ] Import each type — no compile errors
- [ ] Create a test object of each type — type checker validates
- [ ] No `any` types used
- [ ] All PRD-specified fields present (cross-reference sections 17.1–17.5)

**Suggested order / priority:** 1 (before all components)

**AI-assistant friendly:** Yes (mechanical, well-defined)

**Ready-to-copy prompt:**
```
Create TypeScript type definitions for the Agent Identity & Approval Layer prototype.

Create these files:
- lib/types/enums.ts — all enum types as string literal unions
- lib/types/agent.ts — Agent interface and AuthorizedIntegration sub-type
- lib/types/policy.ts — PolicyRule interface
- lib/types/approval.ts — ApprovalRequest interface
- lib/types/audit.ts — AuditTrace and AuditEvent interfaces
- lib/types/index.ts — re-exports everything

Enum types (string literal unions):
- Environment: 'dev' | 'test' | 'prod'
- AuthorityModel: 'self' | 'delegated' | 'hybrid'
- IdentityMode: 'service_identity' | 'delegated_identity' | 'hybrid_identity'
- DelegationModel: 'self' | 'on_behalf_of_user' | 'on_behalf_of_owner' | 'mixed'
- AutonomyTier: 'low' | 'medium' | 'high'
- LifecycleState: 'active' | 'suspended' | 'revoked'
- DataClassification: 'public' | 'internal' | 'confidential' | 'restricted'
- PolicyEffect: 'allow' | 'approval_required' | 'deny'
- ApprovalStatus: 'pending' | 'approved' | 'denied'
- SeparationOfDutiesCheck: 'pass' | 'fail' | 'not_applicable'
- TraceOutcome: 'executed' | 'blocked' | 'denied' | 'completed_with_approval'
- ActorType: 'agent' | 'policy_engine' | 'approval_service' | 'human_reviewer' | 'system'
- EventType: 'trace_initiated' | 'identity_resolved' | 'delegation_resolved' | 'policy_evaluated' | 'sensitive_operation_detected' | 'approval_required' | 'approval_granted' | 'approval_denied' | 'operation_executed' | 'operation_blocked' | 'trace_closed'

Agent interface fields: id, name, description, owner_name, owner_role, team, environment, authority_model, identity_mode, delegation_model, autonomy_tier, lifecycle_state, authorized_integrations (AuthorizedIntegration[]), next_review_date, recent_activity_state

AuthorizedIntegration: name, resource_scope, data_classification, allowed_operations (string[])

PolicyRule fields: id, agent_id, policy_name, authorized_integration, operation, resource_scope, data_classification, policy_effect, rationale, policy_version, modified_by, modified_at, max_session_ttl (string | null)

ApprovalRequest fields: id, trace_id, agent_id, requested_operation, target_integration, resource_scope, data_classification, authority_model, delegated_from (string | null), policy_effect, flag_reason, status, requested_at, decided_at (string | null), approver_name (string | null), decision_note (string | null), separation_of_duties_check

AuditTrace fields: trace_id, agent_id, authority_model, requested_operation, target_integration, resource_scope, started_at, completed_at (string | null), final_outcome

AuditEvent fields: id, trace_id, agent_id, approval_request_id (string | null), timestamp, event_type, actor_type, actor_name, description, status, policy_version (string | null), correlation_id (string | null)

Use snake_case for field names. TypeScript strict mode. No 'any' types.
```

---

### S-03: Seed Data Fixtures

**Goal:** Create complete, realistic seed data for all 3 agents, their policy rules, 4 scenario approval requests, 4 audit traces with full event sequences.

**Why it matters:** The entire prototype runs on deterministic seeded data. If the seed data is unrealistic, vague, or incomplete, every page will look broken or unconvincing. Enterprise audiences will notice weak data immediately.

**Scope:**
- 3 agents with full profiles including authorized integrations
- ~8–12 policy rules across the 3 agents covering allow, approval_required, and deny effects
- 4 approval requests (one per scenario: 2 pending, 1 pre-approved, 1 pre-denied — or 2 pending + 2 auto-resolved via trace only)
- 4 audit traces with full event sequences (7–9 events each)
- All data must use correct enterprise terminology
- Dates should be realistic (March 2026 timeframe)

**Out of scope:**
- Dynamic data generation
- Randomization
- Data editing UI

**Inputs / dependencies:**
- S-02 (TypeScript types — all interfaces and enums)
- PRD sections 15, 16 (scenarios and agent definitions)
- UI Spec sections 2, 3 (seeded objects and scenarios)

**Files likely to be touched:**
- `lib/fixtures/agents.ts`
- `lib/fixtures/policies.ts`
- `lib/fixtures/approvals.ts`
- `lib/fixtures/traces.ts`
- `lib/fixtures/index.ts`

**Detailed implementation notes:**

**Agents (3):**

1. **Customer Communications Agent** (agent-001)
   - Purpose: drafts or sends outbound customer communications
   - Owner: Sarah Chen, Service Operations Lead, Customer Operations
   - Environment: prod
   - Authority model: hybrid, Identity mode: hybrid_identity, Delegation: on_behalf_of_owner
   - Autonomy tier: medium
   - Lifecycle: active
   - Authorized integrations:
     - Communications Service: scope "Outbound customer communications", classification: confidential, ops: ["draft", "send"]
     - CRM Platform: scope "Customer records (read-only)", classification: confidential, ops: ["read"]
     - Template Engine: scope "Approved communication templates", classification: internal, ops: ["read", "render"]
   - Next review: 2026-04-18
   - Recent activity: "3 operations this week"

2. **Internal Knowledge Retrieval Agent** (agent-002)
   - Purpose: retrieves internal knowledge and summarises documents
   - Owner: Marcus Webb, Knowledge Systems Lead, Enterprise Architecture
   - Environment: prod
   - Authority model: self, Identity mode: service_identity, Delegation: self
   - Autonomy tier: low
   - Lifecycle: active
   - Authorized integrations:
     - Document Store: scope "Internal knowledge base", classification: internal, ops: ["read", "summarize"]
     - Policy Repository: scope "Published policy documents", classification: confidential, ops: ["read"]
   - Next review: 2026-05-02
   - Recent activity: "12 operations this week"

3. **Case Operations Agent** (agent-003)
   - Purpose: writes structured updates into internal case systems
   - Owner: Priya Sharma, Operations Manager, Case Management
   - Environment: prod
   - Authority model: self, Identity mode: service_identity, Delegation: self
   - Autonomy tier: medium
   - Lifecycle: active (default), suspended (togglable)
   - Authorized integrations:
     - Case Management System: scope "Active case records", classification: confidential, ops: ["read", "update", "close"]
     - Notification Service: scope "Internal team notifications", classification: internal, ops: ["send"]
   - Next review: 2026-04-25
   - Recent activity: "7 operations this week"

**Policy Rules (~10):**

Include a mix:
- Agent 001: "Outbound customer email review" (approval_required, confidential), "Draft communication — internal templates" (allow, internal), "Access restricted customer PII" (deny, restricted)
- Agent 002: "Retrieve internal knowledge base" (allow, internal), "Access confidential policy documents" (approval_required, confidential), "Access restricted board materials" (deny, restricted)
- Agent 003: "Update active case records" (allow, confidential), "Close case with financial impact" (approval_required, confidential), "Access restricted legal hold cases" (deny, restricted), "Send internal team notification" (allow, internal)

Each rule should have a realistic rationale explaining why the policy effect exists.

**Approval Requests (4 — one per scenario):**

- **Scenario 1 (approval required → pending, will be approved):** Agent 001 wants to send outbound customer email. Flag reason: "This operation would send regulated customer-facing communication using confidential context. Policy requires human approval before release." Status: pending.
- **Scenario 2 (approval required → pending, will be denied):** Agent 003 wants to close a case with financial impact. Flag reason: "Closing a case with financial impact above threshold requires human review under operational risk policy." Status: pending.
- **Scenario 3 (automatically allowed):** Agent 002 retrieved internal knowledge. No approval request — represented only as a trace with outcome "executed".
- **Scenario 4 (automatically blocked):** Agent 001 attempted to access restricted customer PII. No approval request — represented only as a trace with outcome "blocked".

So only 2 ApprovalRequest objects with status "pending" initially.

**Audit Traces (4 — one per scenario):**

Each trace has 7–9 events following the pattern: trace_initiated → identity_resolved → delegation_resolved → policy_evaluated → [sensitive_operation_detected → approval_required → approval pending] OR [operation_executed → trace_closed] OR [operation_blocked → trace_closed].

Scenario 1 and 2 traces start with events up through "approval_required" — the remaining events (approval_granted/denied, operation_executed/blocked, trace_closed) are added when the user takes action.

Scenario 3 trace: full sequence ending in operation_executed → trace_closed (outcome: executed).

Scenario 4 trace: full sequence ending in operation_blocked → trace_closed (outcome: blocked).

Use realistic timestamps in March 2026.

**Acceptance criteria:**
- [ ] 3 complete agent objects with all fields
- [ ] ~10 policy rules with realistic rationale text
- [ ] 2 pending approval requests + traces for 4 scenarios
- [ ] All traces have correct event sequences
- [ ] Enterprise terminology is correct throughout
- [ ] Dates are realistic (March 2026)
- [ ] Data compiles against TypeScript types with no errors

**QA / test checklist:**
- [ ] Import all fixtures — no type errors
- [ ] Each agent has ≥2 authorized integrations
- [ ] Each approval request references a valid agent_id and trace_id
- [ ] Each trace references a valid agent_id
- [ ] All audit events within a trace have correct trace_id
- [ ] Scenario 1 and 2 traces have events only up to "approval_required" initially
- [ ] Scenario 3 and 4 traces are complete
- [ ] Flag reasons are specific and enterprise-credible

**Suggested order / priority:** 1 (parallel with S-02, before components)

**AI-assistant friendly:** Yes (but human review critical for data realism and terminology)

**Ready-to-copy prompt:**
```
Create complete seed data fixtures for the Agent Identity & Approval Layer prototype. All data must be realistic, enterprise-credible, and use correct governance terminology.

Import types from lib/types. Create these files:
- lib/fixtures/agents.ts — 3 agents
- lib/fixtures/policies.ts — ~10 policy rules
- lib/fixtures/approvals.ts — 2 pending approval requests (scenarios 1 & 2)
- lib/fixtures/traces.ts — 4 audit traces with event sequences
- lib/fixtures/index.ts — re-exports

AGENT 1 (agent-001): Customer Communications Agent
- Owner: Sarah Chen, Service Operations Lead, Customer Operations
- Environment: prod, Authority: hybrid, Identity: hybrid_identity, Delegation: on_behalf_of_owner
- Autonomy: medium, Lifecycle: active
- Integrations: Communications Service (outbound customer comms, confidential, [draft, send]), CRM Platform (customer records read-only, confidential, [read]), Template Engine (approved templates, internal, [read, render])
- Next review: 2026-04-18

AGENT 2 (agent-002): Internal Knowledge Retrieval Agent
- Owner: Marcus Webb, Knowledge Systems Lead, Enterprise Architecture
- Environment: prod, Authority: self, Identity: service_identity, Delegation: self
- Autonomy: low, Lifecycle: active
- Integrations: Document Store (internal KB, internal, [read, summarize]), Policy Repository (published policies, confidential, [read])
- Next review: 2026-05-02

AGENT 3 (agent-003): Case Operations Agent
- Owner: Priya Sharma, Operations Manager, Case Management
- Environment: prod, Authority: self, Identity: service_identity, Delegation: self
- Autonomy: medium, Lifecycle: active
- Integrations: Case Management System (active cases, confidential, [read, update, close]), Notification Service (team notifications, internal, [send])
- Next review: 2026-04-25

POLICY RULES (~10): Mix of allow, approval_required, deny across all 3 agents. Each rule has:
- id, agent_id, policy_name, authorized_integration, operation, resource_scope, data_classification, policy_effect, rationale (1-2 sentence explanation WHY), policy_version (v1.x), modified_by ("Governance Admin"), modified_at (March 2026 dates), max_session_ttl (null or "4h"/"8h")

Key rules:
- agent-001: "Outbound customer email review" (approval_required, confidential) — rationale about regulated customer comms
- agent-001: "Draft communication — internal templates" (allow, internal)
- agent-001: "Access restricted customer PII" (deny, restricted)
- agent-002: "Retrieve internal knowledge base" (allow, internal)
- agent-002: "Access confidential policy documents" (approval_required, confidential)
- agent-002: "Access restricted board materials" (deny, restricted)
- agent-003: "Update active case records" (allow, confidential)
- agent-003: "Close case with financial impact" (approval_required, confidential) — rationale about financial threshold
- agent-003: "Access restricted legal hold cases" (deny, restricted)
- agent-003: "Send internal team notification" (allow, internal)

APPROVAL REQUESTS (2 pending):
- Scenario 1: agent-001 wants to send outbound customer email (trace TR-2048). Flag: "This operation would send regulated customer-facing communication using confidential context. Policy requires human approval before release." Status: pending. SoD: pass. Requested: 2026-03-19T14:42:00Z.
- Scenario 2: agent-003 wants to close case with financial impact (trace TR-2051). Flag: "Closing a case with financial impact above threshold requires human review under operational risk policy." Status: pending. SoD: pass. Requested: 2026-03-19T15:18:00Z.

AUDIT TRACES (4):
- TR-2048 (scenario 1, agent-001): Events up through approval_required. Outcome: null (pending). Will be completed when user approves/denies.
- TR-2051 (scenario 2, agent-003): Events up through approval_required. Outcome: null (pending).
- TR-2045 (scenario 3, agent-002): Complete trace — retrieve internal docs, auto-allowed. Outcome: executed.
- TR-2046 (scenario 4, agent-001): Complete trace — attempted restricted PII access, auto-blocked. Outcome: blocked.

Each trace event: id, trace_id, agent_id, approval_request_id (null unless approval-related), timestamp (ISO), event_type, actor_type, actor_name, description, status, policy_version, correlation_id.

Use realistic timestamps in March 2026, spaced seconds apart within each trace.
Export all as typed arrays: SEED_AGENTS, SEED_POLICIES, SEED_APPROVALS, SEED_TRACES (with SEED_EVENTS nested or separate).
```

---

### S-04: Application State Context Provider

**Goal:** Build the React Context + useState state management layer that holds all application state and provides mutation functions for approve, deny, reset, and lifecycle changes.

**Why it matters:** This is the only state layer in the app. It must correctly handle the cross-page state transitions that make the demo coherent — approve an operation and the trace updates, the queue updates, and the agent's recent activity updates.

**Scope:**
- React Context provider wrapping the app
- State: agents, policyRules, approvalRequests, auditTraces, auditEvents
- Initialize from seed data fixtures
- Mutation functions: approveRequest(id), denyRequest(id), suspendAgent(id), revokeAgent(id), resetScenarios()
- useAppContext() hook

**Out of scope:**
- Persistence (localStorage)
- Undo/redo
- Optimistic updates

**Inputs / dependencies:**
- S-02 (TypeScript types)
- S-03 (Seed data fixtures)

**Files likely to be touched:**
- `lib/state/AppContext.tsx`
- `lib/state/index.ts`

**Detailed implementation notes:**

```typescript
interface AppState {
  agents: Agent[];
  policyRules: PolicyRule[];
  approvalRequests: ApprovalRequest[];
  auditTraces: AuditTrace[];
  auditEvents: AuditEvent[];
}

interface AppContextValue extends AppState {
  approveRequest: (id: string, note?: string) => void;
  denyRequest: (id: string, note?: string) => void;
  suspendAgent: (id: string) => void;
  revokeAgent: (id: string) => void;
  resetScenarios: () => void;
}
```

- Initialize state from `SEED_AGENTS`, `SEED_POLICIES`, `SEED_APPROVALS`, `SEED_TRACES`, `SEED_EVENTS` using deep copy (structuredClone or JSON parse/stringify).

- **approveRequest(id):**
  1. Update the approval request: status → "approved", decided_at → now ISO, approver_name → "Security Reviewer" (hardcoded for v0)
  2. Find the related trace (by trace_id on the approval request)
  3. Append 3 new audit events to the trace: approval_granted, operation_executed, trace_closed
  4. Update the trace: final_outcome → "completed_with_approval", completed_at → now

- **denyRequest(id):**
  1. Update the approval request: status → "denied", decided_at → now ISO, approver_name → "Security Reviewer"
  2. Find related trace
  3. Append 3 new audit events: approval_denied, operation_blocked, trace_closed
  4. Update trace: final_outcome → "denied", completed_at → now

- **suspendAgent(id):** Update agent lifecycle_state → "suspended"

- **revokeAgent(id):** Update agent lifecycle_state → "revoked"

- **resetScenarios():** Re-initialize all state from seed data (fresh deep copy)

- Wrap in a `AppProvider` component. Provide `useAppContext()` hook.

**Acceptance criteria:**
- [ ] Context initializes with seed data correctly
- [ ] approveRequest updates approval status, creates trace events, updates trace outcome
- [ ] denyRequest updates approval status, creates trace events, updates trace outcome
- [ ] suspendAgent/revokeAgent update lifecycle state
- [ ] resetScenarios restores all state to original seed values
- [ ] All state is reactive (components re-render on change)
- [ ] No state mutation bugs (immutable updates)

**QA / test checklist:**
- [ ] Call approveRequest — approval status is "approved", trace has 3 new events, trace outcome is "completed_with_approval"
- [ ] Call denyRequest — approval status is "denied", trace has 3 new events, trace outcome is "denied"
- [ ] Call suspendAgent — agent lifecycle is "suspended"
- [ ] Call revokeAgent — agent lifecycle is "revoked"
- [ ] Call resetScenarios — all state returns to initial seed values
- [ ] Approve then reset — state is clean
- [ ] Multiple components reading the same state all update

**Suggested order / priority:** 1 (parallel with S-02 and S-03, before pages)

**AI-assistant friendly:** Yes (but human review critical for state transition correctness)

**Ready-to-copy prompt:**
```
Build the React Context state management layer for the Agent Identity & Approval Layer prototype (Next.js + TypeScript).

File: lib/state/AppContext.tsx

State shape:
```typescript
interface AppState {
  agents: Agent[];
  policyRules: PolicyRule[];
  approvalRequests: ApprovalRequest[];
  auditTraces: AuditTrace[];
  auditEvents: AuditEvent[];
}
```

Context value includes state + mutation functions:
- approveRequest(id: string, note?: string): void
- denyRequest(id: string, note?: string): void
- suspendAgent(id: string): void
- revokeAgent(id: string): void
- resetScenarios(): void

Initialize from seed data fixtures (lib/fixtures). Use structuredClone for deep copy on init and reset.

approveRequest(id):
1. Set approval request status → "approved", decided_at → now ISO, approver_name → "Security Reviewer"
2. Find related trace via trace_id
3. Append 3 audit events: approval_granted (actor: human_reviewer), operation_executed (actor: system), trace_closed (actor: system)
4. Set trace final_outcome → "completed_with_approval", completed_at → now

denyRequest(id):
1. Set approval request status → "denied", decided_at → now ISO, approver_name → "Security Reviewer"
2. Find related trace
3. Append 3 events: approval_denied, operation_blocked, trace_closed
4. Set trace final_outcome → "denied", completed_at → now

suspendAgent(id): Set lifecycle_state → "suspended"
revokeAgent(id): Set lifecycle_state → "revoked"
resetScenarios(): Re-clone seed data, replace all state

Use immutable state updates (spread or structuredClone). Export AppProvider component and useAppContext() hook.

Import types from lib/types. Import fixtures from lib/fixtures.
```

---

## Execution Order Summary

| Order | Ticket | Description |
|-------|--------|-------------|
| 0 | S-01 | Project init |
| 1a | S-02 | TypeScript types |
| 1b | S-03 | Seed data fixtures |
| 1c | S-04 | AppContext state provider |
| 2a | C-01 | PageHeader |
| 2b | C-02 | StatusBadge |
| 2c | C-03 | DataRow |
| 2d | C-04 | StatCard |
| 2e | C-05 | QueueItemCard |
| 2f | C-06 | SlideOverPanel |
| 2g | C-07 | PillFilter |
| 2h | C-08 | SearchInput |
| 2i | C-09 | EmptyState |
| 2j | C-10 | TraceTimeline |
| 2k | C-11 | TraceEventRow |
| 2l | C-12 | AgentRowCard |
| 2m | C-13 | DecisionCard |
| 3 | P-01 | App Shell |
| 4 | P-02 | Approval Queue page |
| 5 | P-03 | Approval Detail slide-over |
| 6 | P-04 | Audit Timeline page |
| 7 | P-05 | Agent Detail page |
| 8 | P-06 | Agent Registry page |
| 9 | P-07 | Policies page |
| 10 | P-08 | Architecture page |
| 11 | P-09 | Toast notifications |
| 12 | P-10 | Guided demo flow and polish |

**Tickets suitable for parallel execution:**
- S-02, S-03 can be worked in parallel (types first, then fixtures immediately after)
- C-01 through C-13 can all be worked in parallel once S-02 is done
- P-02 through P-08 are sequential by build priority, but P-06/P-07 could overlap if different engineers work them
