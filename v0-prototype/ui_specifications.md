# UI Specification

## Product

**Agent Identity & Approval Layer**

## Purpose of this document

Define the exact screens, objects, states, interactions, hierarchy, and copy direction for the v0 prototype.

This spec assumes:

- 3 seeded agents
    
- 4 deterministic scenarios
    
- Approve / Deny only
    
- client-side prototype
    
- no live integrations
    
- no real policy engine
    
- architecture page included
    
- design direction: **Institutional Calm**
    

---

# 1. Global UX rules

## 1.1 Product tone

The product should feel:

- institutional
    
- calm
    
- high-stakes
    
- operational
    
- credible
    
- restrained
    

It should **not** feel:

- playful
    
- chatty
    
- consumer-like
    
- magical
    
- experimental
    
- generically SaaS
    

## 1.2 Navigation model

Top navigation:

- Agents
    
- Policies
    
- Approval Queue
    
- Audit
    
- Architecture
    

No nested complex nav in v0.

## 1.3 Layout model

Every page uses the same shell:

- left or top navigation
    
- page title
    
- one-line explanatory subtitle
    
- toolbar row if needed
    
- main content area
    
- optional right-side contextual panel or slide-over
    

## 1.4 Semantic color usage

Use color sparingly and only where it carries meaning.

Primary semantic states:

- allowed
    
- approval required
    
- denied
    
- active
    
- suspended / revoked
    

Color is not decorative. It is narrative.

## 1.5 Reusable UI primitives

Core primitives should include:

- PageHeader
    
- SectionHeader
    
- StatCard
    
- StatusBadge
    
- DataRow
    
- DecisionCard
    
- QueueItemCard
    
- TraceEventRow
    
- TraceTimeline
    
- AgentMetaBlock
    
- PillFilter
    
- SearchInput
    
- SlideOverPanel
    
- ActionBar
    
- EmptyState
    
- ResetScenarioButton
    

## 1.6 Copy style

Copy must be:

- short
    
- factual
    
- slightly formal
    
- non-marketing
    
- operational
    

Avoid:

- “smart”
    
- “intelligent”
    
- “AI-powered magic”
    
- “unlock”
    
- “supercharge”
    

Use:

- “flagged for review”
    
- “policy effect”
    
- “resource scope”
    
- “delegated authority”
    
- “trace”
    
- “lifecycle state”
    

---

# 2. Global seeded objects

This UI spec assumes exactly three agents exist.

## 2.1 Agent A — Customer Communications Agent

Purpose: drafts or sends outbound customer communications  
Authority model: Hybrid  
Identity mode: Hybrid identity  
Delegation model: On behalf of owner  
Autonomy tier: Medium  
Lifecycle state: Active

## 2.2 Agent B — Internal Knowledge Retrieval Agent

Purpose: retrieves internal knowledge and summarises documents  
Authority model: Self  
Identity mode: Service identity  
Delegation model: Self  
Autonomy tier: Low  
Lifecycle state: Active

## 2.3 Agent C — Case Operations Agent

Purpose: writes structured updates into internal case systems  
Authority model: Self  
Identity mode: Service identity  
Delegation model: Self  
Autonomy tier: Medium  
Lifecycle state: Suspended or Active depending on scenario seed

---

# 3. Global seeded scenarios

## Scenario 1

Approval required → approved

## Scenario 2

Approval required → denied

## Scenario 3

Automatically allowed

## Scenario 4

Automatically blocked

A scenario reset control may exist globally in header utility area or per relevant page.

---

# 4. Screen 1 — Agent Registry

## 4.1 Purpose

Provide the complete list of agents as governed enterprise assets.

The screen must establish the product thesis immediately:  
these are not bots or hidden scripts, they are known actors with owners, authority models, lifecycle states, and access review dates.

## 4.2 Primary user question

**“What agents exist, and how are they classified?”**

## 4.3 Page structure

### Header area

- Page title: **Agents**
    
- Subtitle:  
    **Known AI agents with defined ownership, authority models, lifecycle states, and authorized integrations.**
    

### Toolbar row

- Search input: “Search agents”
    
- Filter pills:
    
    - Environment
        
    - Authority model
        
    - Autonomy tier
        
    - Lifecycle state
        

### Main content

Registry in card-list or table-card hybrid form.

Recommended for v0:  
**row-based registry with rich cells**, not a plain table.

Each row/card should show:

- agent name
    
- short description
    
- owner
    
- team
    
- environment
    
- authority model
    
- autonomy tier
    
- lifecycle state
    
- number of authorized integrations
    
- next review date
    
- recent activity indicator
    

## 4.4 Information hierarchy per row

### Left column

- Agent name
    
- One-line description
    

### Middle metadata

- Owner
    
- Team
    
- Environment
    
- Authority model
    

### Right metadata

- Autonomy tier badge
    
- Lifecycle state badge
    
- Next review date
    
- Recent trace count or activity pulse
    

### Far right

- “View details” chevron or text link
    

## 4.5 Visual treatment

This page should feel controlled and quiet.

The registry is **not** the emotional center of the product, so it should be visually clean but not overly dramatic.

Use:

- restrained cards or bordered rows
    
- modest hover effect
    
- clear badges
    
- subtle divider rhythm
    

Avoid:

- giant charts
    
- decorative metrics
    
- oversized hero panels
    

## 4.6 Row example copy

**Customer Communications Agent**  
Drafts and routes outbound customer communications under delegated authority.  
Owner: Service Operations Lead  
Team: Customer Operations  
Environment: Production  
Authority model: Hybrid  
Autonomy tier: Medium  
Lifecycle state: Active  
Authorized integrations: 3  
Next review: 18 Apr 2026

## 4.7 Interactions

- Clicking row opens Agent Detail
    
- Search filters visible rows
    
- Filters narrow results instantly
    
- No pagination in v0
    

## 4.8 Empty state

Only needed if filters produce zero results.

Title:  
**No agents match the current filters**

Body:  
**Try clearing one or more filters to view registered agents.**

Action:  
**Clear filters**

## 4.9 Acceptance conditions

A user should understand within 10 seconds:

- there are 3 agents
    
- each has an owner
    
- each has an authority model
    
- each has a lifecycle state
    
- this is an enterprise governance product
    

---

# 5. Screen 2 — Agent Detail

## 5.1 Purpose

Provide the governance profile of one agent.

This page must answer:

- who owns it,
    
- how it acts,
    
- what it can access,
    
- how tightly it is governed,
    
- and what has happened recently.
    

## 5.2 Primary user question

**“What kind of actor is this agent, and how is it controlled?”**

## 5.3 Layout

Recommended structure:

- header block
    
- 2-column main layout
    

### Left column

Primary profile and governance content

### Right column

Summaries, activity, lifecycle controls

## 5.4 Header block

Contains:

- agent name
    
- short description
    
- lifecycle state badge
    
- autonomy tier badge
    
- authority model badge
    

Optional secondary line:

- environment
    
- owner
    
- team
    

### Example

**Customer Communications Agent**  
Drafts and routes outbound customer communications under delegated authority.  
Badges: Active / Medium autonomy / Hybrid authority  
Meta line: Production · Owned by Service Operations Lead · Customer Operations

## 5.5 Main content sections

### Section A — Overview

Fields:

- owner name
    
- owner role
    
- team
    
- environment
    
- identity mode
    
- delegation model
    
- authority model
    
- next review date
    

This should appear as a structured data block, not paragraphs.

### Section B — Authority & identity

Purpose:  
make clear whether the agent acts:

- as itself,
    
- on behalf of a human,
    
- or through a hybrid approach.
    

Fields:

- identity mode
    
- delegation model
    
- authority explanation
    
- separation-of-duties note
    

Sample note:  
**Sensitive operations triggered by this agent require review by an approver other than the registered owner.**

### Section C — Authorized integrations

Display each integration as a compact card or row.

Each item includes:

- integration name
    
- resource scope
    
- data classification boundary
    
- allowed operations summary
    

Example:  
**Communications Service**  
Scope: Outbound policy communications  
Data classification: Confidential  
Operations: Draft, send with approval

### Section D — Policy summary

Small grouped metrics:

- allowed rules
    
- approval-required rules
    
- denied rules
    
- latest policy version
    

These should be stat cards or inline metric blocks.

### Section E — Recent approval activity

Short list of last 2–3 requests:

- operation
    
- policy effect
    
- outcome
    
- time
    

### Section F — Recent trace activity

Short trace summaries:

- trace ID
    
- operation
    
- outcome
    
- timestamp
    

## 5.6 Right-side panel sections

### Lifecycle controls card

Contains:

- current lifecycle state
    
- Suspend agent button
    
- Revoke all grants button
    

Buttons may be non-destructive visual controls in v0, but must exist.

### Governance snapshot card

Contains:

- autonomy tier
    
- authority model
    
- approval dependency
    
- next review date
    

### Linked navigation card

Links:

- View policies
    
- View approval queue
    
- View audit traces
    

## 5.7 Visual treatment

This page should feel like a dossier.

Not dense.  
Not flashy.  
Not like an app settings page.

Important:  
identity / authority / lifecycle must read as first-class governance concepts.

## 5.8 Empty states

Not required in normal flow.

## 5.9 Interaction notes

- Clicking policy summary can navigate to filtered Policies view
    
- Clicking approval activity can navigate to Approval Queue or Approval Detail
    
- Clicking recent trace can navigate to Audit with selected trace
    

## 5.10 Acceptance conditions

A viewer should leave this page understanding:

- the agent’s owner
    
- how the agent acts
    
- what boundaries it operates within
    
- how sensitive its operations are
    
- and whether it is currently healthy, suspended, or constrained
    

---

# 6. Screen 3 — Policies

## 6.1 Purpose

Show how policy governs agent operations across integration, scope, and data sensitivity.

## 6.2 Primary user question

**“What is this agent allowed to do, under what scope, and why?”**

## 6.3 Critical design instruction

This page must **not** look like a spreadsheet of permissions.

It should read like a set of governed decisions.

## 6.4 Header area

- Page title: **Policies**
    
- Subtitle:  
    **Policy rules define the effect of each operation across integration, scope, and data classification.**
    

Toolbar:

- search rules
    
- filter by agent
    
- filter by policy effect
    
- filter by data classification
    

## 6.5 Main content model

Display rules as **Decision Cards** or structured stacked rows.

Recommended layout:  
one decision card per rule, grouped by agent.

## 6.6 Decision card structure

### Top line

- Policy name
    
- Policy effect badge
    

### Body rows

- Agent
    
- Authorized integration
    
- Operation
    
- Resource scope
    
- Data classification
    
- Policy version
    
- Modified by / modified at
    

### Reasoning block

Title:  
**Rationale**

Body:  
one or two lines explaining why the effect exists.

This is mandatory.

### Optional metadata footer

- session TTL
    
- review note
    
- affected scenarios
    

## 6.7 Example card

**Outbound customer email review**  
Badge: Approval Required

Agent: Customer Communications Agent  
Authorized integration: Communications Service  
Operation: Send  
Resource scope: Outbound customer communications  
Data classification: Confidential  
Policy version: v1.4  
Modified by: Governance Admin  
Modified at: 12 Mar 2026

**Rationale**  
Outbound communication involving regulated customer context requires human review before release.

## 6.8 Visual treatment

This page should feel like:

- policy logic,
    
- structured control,
    
- explicit consequence.
    

Policy effect badge must be highly legible.

Rationale block should visually stand apart from metadata, because that is what prevents the screen from becoming generic RBAC UI.

## 6.9 Interactions

- Clicking rule may expand full details
    
- Clicking agent name may open Agent Detail
    
- Filter interactions are instant
    
- No editing in v0
    

## 6.10 Empty state

Title:  
**No policy rules match the current filters**

Body:  
**Adjust filters to view policy decisions across agents and integrations.**

Action:  
**Clear filters**

## 6.11 Acceptance conditions

The user should understand:

- policies govern operations, not just access
    
- policy effect is different from later human approval
    
- rationale is central to trust
    
- policy scope and data classification are first-class concepts
    

---

# 7. Screen 4 — Approval Queue

## 7.1 Purpose

Show all pending sensitive operations requiring human review.

This is one of the two most important screens in the product.

## 7.2 Primary user question

**“What actions are waiting for review, and why were they flagged?”**

## 7.3 Emotional goal

The page should feel like a control moment.

Not admin busywork.  
Not ticket processing.  
Not email triage.

A reviewer should feel:  
**this action is important, bounded, and explainable.**

## 7.4 Header area

- Page title: **Approval Queue**
    
- Subtitle:  
    **Sensitive agent operations requiring human review before execution.**
    

Toolbar:

- filter by status
    
- filter by agent
    
- filter by data classification
    
- search by trace ID or operation
    

## 7.5 Main content model

Queue items as vertically stacked cards.

Each card should feel like a briefing.

## 7.6 Queue item structure

### Top line

- Requested operation
    
- Status badge: Pending
    
- Trace ID on right
    

### Second line

- Agent name
    
- owner
    
- environment
    

### Main body

- target integration
    
- resource scope
    
- data classification
    
- authority model
    
- delegated from, if applicable
    
- policy effect
    

### Critical block

Title:  
**Why this was flagged**

Body:  
Plain-language explanation of the governing reason.

This block must be visually prominent.

### Footer

- requested timestamp
    
- separation-of-duties status
    
- “Review” action button
    

## 7.7 Example queue card

**Send outbound policy change email**  
Pending · Trace TR-2048

Agent: Customer Communications Agent  
Owner: Service Operations Lead  
Environment: Production

Target integration: Communications Service  
Scope: Outbound customer communications  
Data classification: Confidential  
Authority model: Hybrid  
Delegated from: Service Operations Lead  
Policy effect: Approval Required

**Why this was flagged**  
This operation would send regulated customer-facing communication using confidential context. Policy requires human approval before release.

Requested: 19 Mar 2026, 14:42  
Separation of duties: Pass

[Review]

## 7.8 Visual treatment

This page should use stronger emphasis than Registry or Policies.

The “Why this was flagged” block should visually anchor each card.

Potential treatment:

- slightly inset panel
    
- subtle border emphasis
    
- semantic accent strip
    
- stronger typography weight
    

## 7.9 Interactions

- Clicking Review opens Approval Detail in slide-over
    
- Approve / Deny are not executed on this page directly unless design chooses inline quick actions
    
- Recommended for v0: detail slide-over handles decision
    

## 7.10 Empty states

### No pending approvals

Title:  
**No actions are waiting for review**

Body:  
**All approval-required operations have been resolved in the current simulation state.**

Action:  
**Reset scenarios**

## 7.11 Acceptance conditions

A stakeholder should immediately understand:

- what is being requested
    
- why it was flagged
    
- why human review exists
    
- and that this product is about governed execution, not generic AI
    

---

# 8. Screen 5 — Approval Detail (slide-over)

## 8.1 Purpose

Allow detailed inspection of one approval request and capture the human decision.

This is the most important screen in the product.

## 8.2 Primary user question

**“Do I approve this operation, and on what basis?”**

## 8.3 Presentation model

Slide-over from the right, over the Approval Queue.

Width:  
approximately 40–50% desktop width.

Must feel focused and serious.

## 8.4 Structure

### Header

- operation title
    
- Pending badge
    
- trace ID
    
- close button
    

### Section A — Request summary

Fields:

- agent
    
- owner
    
- environment
    
- requested operation
    
- target integration
    
- requested timestamp
    

### Section B — Authority context

Fields:

- authority model
    
- identity mode
    
- delegated from
    
- separation-of-duties result
    

### Section C — Why this was flagged

This is the core section.

Fields:

- policy effect
    
- governing policy name
    
- rationale
    
- data classification
    
- resource scope
    

Presentation:  
this should be the strongest panel on the page.

### Section D — Requested context

Fields:

- trigger source
    
- context summary
    
- intended impact
    
- confidence / determinism note if included in seed data
    

Example:  
**The agent prepared an outbound communication using customer policy context and requested release through the communications service.**

### Section E — Reviewer action panel

Contains:

- Approve button
    
- Deny button
    
- optional decision note text area
    

### Section F — Governance metadata

Contains:

- policy version
    
- modified by
    
- last modified at
    

## 8.5 Post-action behavior

### On Approve

- status changes to Approved
    
- queue item disappears from pending state or changes state
    
- related trace updates with approval granted and operation executed
    
- brief inline confirmation appears
    

### On Deny

- status changes to Denied
    
- trace updates with approval denied and operation blocked
    
- confirmation appears
    

## 8.6 Confirmation copy examples

### Approved

**Operation approved and recorded in trace.**

### Denied

**Operation denied and recorded in trace.**

## 8.7 Visual treatment

This panel should feel like:

- a security review panel
    
- a decision point
    
- evidence-backed action
    

Avoid:

- lightweight modal feel
    
- big decorative buttons
    
- consumer-style confirmation patterns
    

## 8.8 Acceptance conditions

A reviewer should be able to decide confidently without leaving the panel.

A stakeholder should see this and think:  
**“This is the product.”**

---

# 9. Screen 6 — Audit Timeline

## 9.1 Purpose

Show the evidence trail and causal flow of an agent operation.

This is the second most important screen in the product.

## 9.2 Primary user question

**“What happened, in what order, under what authority, and with what outcome?”**

## 9.3 Design principle

This must look like evidence.

Not like:

- server logs
    
- a data table
    
- console output
    
- random event feed
    

## 9.4 Layout

Recommended:

- trace selector at top or left
    
- main vertical timeline in center
    
- summary card on side
    

## 9.5 Header area

- Page title: **Audit**
    
- Subtitle:  
    **Correlated traces showing policy evaluation, approval control, and final outcome for agent operations.**
    

Toolbar:

- search by trace ID
    
- filter by outcome
    
- filter by agent
    

## 9.6 Trace summary panel

For selected trace, show:

- trace ID
    
- agent
    
- requested operation
    
- authority model
    
- target integration
    
- resource scope
    
- start time
    
- final outcome
    

## 9.7 Timeline structure

Vertical timeline with event nodes.

Each event row contains:

- timestamp
    
- event type
    
- actor type
    
- actor name
    
- event description
    
- status
    
- policy version if relevant
    

## 9.8 Example event sequence

1. Trace initiated
    
2. Agent identity resolved
    
3. Delegation model resolved
    
4. Policy evaluated
    
5. Sensitive operation detected
    
6. Approval required
    
7. Approval granted
    
8. Operation executed
    
9. Trace closed
    

## 9.9 Visual hierarchy

- timeline spine visible
    
- current/important events slightly stronger
    
- approval decision event emphasized
    
- final outcome visible at bottom and in summary
    

## 9.10 Example event copy

**14:42:06 — Policy evaluated**  
Actor: Policy Engine  
Status: Completed  
Description: Operation `send` on Communications Service evaluated against policy v1.4. Effect: Approval Required.

**14:43:11 — Approval granted**  
Actor: Human Reviewer  
Status: Completed  
Description: Reviewer approved outbound communication after policy-based manual review.

## 9.11 Outcomes to support

- Completed with approval
    
- Denied
    
- Executed automatically
    
- Blocked by policy
    

## 9.12 Empty state

Title:  
**No traces match the current filters**

Body:  
**Adjust filters or reset the simulation state to view correlated operation traces.**

Action:  
**Reset scenarios**

## 9.13 Acceptance conditions

A viewer must understand:

- traces are correlated operations
    
- control events are visible
    
- approval and policy are separate steps
    
- evidence is stronger than log spam
    

---

# 10. Screen 7 — Architecture

## 10.1 Purpose

Provide architectural credibility for technical audiences.

## 10.2 Primary user question

**“How would this fit into a real enterprise control architecture?”**

## 10.3 Header area

- Page title: **Architecture**
    
- Subtitle:  
    **Conceptual control architecture for governed AI agent operations in enterprise environments.**
    

## 10.4 Page layout

Simple and clean.  
One large diagram with short explanatory notes.

Do not overcrowd.

## 10.5 Diagram components

Required boxes:

- Human User / Owner
    
- Enterprise IdP
    
- Agent
    
- Credential Binding Boundary
    
- Policy Enforcement Point (PEP)
    
- Policy Decision Point (PDP)
    
- Approval Service
    
- Authorized Integrations
    
- Trace / Audit Store
    

## 10.6 Flow lines

Show a simple path:

1. human/user context or agent trigger
    
2. agent operation request
    
3. identity / delegation resolution
    
4. policy enforcement point
    
5. policy decision point
    
6. if approval required → approval service
    
7. if approved → authorized integration call
    
8. trace written throughout operation
    

## 10.7 Supporting notes

Short note cards below diagram:

### Note 1

**Identity and delegation**  
In production, agent identities may map to service principals or equivalent machine identities. Human approvers authenticate through the enterprise identity provider.

### Note 2

**Policy evaluation**  
The prototype simulates policy effects locally. A production deployment would typically externalize policy evaluation to a dedicated decision point.

### Note 3

**Approval control**  
Approval is distinct from policy evaluation. Policy may require human review before an operation proceeds.

### Note 4

**Auditability**  
Operations are represented as correlated traces rather than isolated log lines.

## 10.8 Visual treatment

This page should be the cleanest in the product.  
Technical, quiet, elegant.

No “cloud sticker” clutter.  
No overloaded enterprise boxes.

## 10.9 Acceptance conditions

A technical stakeholder should think:

- this is conceptually coherent
    
- the team understands real enterprise boundaries
    
- the prototype knows what it is and what it is not
    

---

# 11. Guided demo behavior

## 11.1 Goal

Allow the product to be demoed in 90 seconds without requiring a dedicated “Scenarios” page.

## 11.2 Mechanism

Use seeded state plus:

- global reset button
    
- optional lightweight “Demo state” text in top utility area
    
- selected pages preloaded with relevant items
    

## 11.3 Golden path

Recommended demo path:

1. Agent Registry
    
2. Agent Detail
    
3. Policies
    
4. Approval Queue
    
5. Approval Detail
    
6. Audit Timeline
    
7. Architecture
    

## 11.4 Demo pacing

- Registry: very brief
    
- Agent Detail: brief
    
- Policies: brief with one rule
    
- Approval detail: main focus
    
- Audit: strong focus
    
- Architecture: close strongly
    

## 11.5 Global reset control

Button label:  
**Reset simulation**

On click:

- restore default seeded state
    
- repopulate pending approval
    
- reset traces and outcomes
    

---

# 12. Notification model

## 12.1 Purpose

Provide light confirmation of state changes.

## 12.2 Use cases

- approval granted
    
- approval denied
    
- simulation reset
    

## 12.3 Pattern

Small toast or inline banner.

Copy examples:

### Reset

**Simulation state reset**

### Approved

**Approval recorded. Operation executed and trace updated.**

### Denied

**Denial recorded. Operation blocked and trace updated.**

No noisy notification center in v0.

---

# 13. Global status system

## 13.1 Lifecycle states

- Active
    
- Suspended
    
- Revoked
    

## 13.2 Policy effects

- Allowed
    
- Approval Required
    
- Denied
    

## 13.3 Approval statuses

- Pending
    
- Approved
    
- Denied
    

## 13.4 Trace outcomes

- Executed
    
- Completed with approval
    
- Denied
    
- Blocked
    

All badges should be visually consistent but distinct by category.

---

# 14. Accessibility and usability requirements

## 14.1 Contrast

Dark mode must preserve strong readability.

## 14.2 Focus states

All clickable elements need visible keyboard focus states.

## 14.3 Hit targets

Buttons and clickable cards should be comfortably targetable.

## 14.4 Layout stability

No jumpy layout when slide-over opens or closes.

## 14.5 Readability

Do not overload cards with text.  
Reasoning should be concise.

---

# 15. Component-level spec summary

## 15.1 StatusBadge

Props:

- label
    
- category
    
- tone
    

Categories:

- lifecycle
    
- policy
    
- approval
    
- trace
    

## 15.2 AgentRowCard

Props:

- agent
    
- onClick
    

Displays:

- core identity
    
- authority model
    
- autonomy tier
    
- lifecycle state
    
- review date
    

## 15.3 DecisionCard

Props:

- policyRule
    
- compact/full mode
    

Displays:

- policy name
    
- policy effect
    
- operation
    
- scope
    
- classification
    
- rationale
    

## 15.4 QueueItemCard

Props:

- approvalRequest
    
- onReview
    

Displays:

- request summary
    
- why flagged
    
- trace id
    
- SoD status
    

## 15.5 ApprovalDetailPanel

Props:

- approvalRequest
    
- relatedPolicy
    
- onApprove
    
- onDeny
    
- onClose
    

## 15.6 TraceTimeline

Props:

- trace
    
- events
    

## 15.7 ArchitectureDiagram

Props:

- none or simple seed config
    

---

# 16. Copy deck starter

## Navigation

- Agents
    
- Policies
    
- Approval Queue
    
- Audit
    
- Architecture
    

## Buttons

- View details
    
- Review
    
- Approve
    
- Deny
    
- Reset simulation
    
- Suspend agent
    
- Revoke all grants
    

## Labels

- Authority model
    
- Identity mode
    
- Delegation model
    
- Authorized integrations
    
- Resource scope
    
- Data classification
    
- Policy effect
    
- Lifecycle state
    
- Separation of duties
    
- Trace ID
    

---

# 17. Final design priorities

If time is limited, optimize in this order:

## Priority 1

Approval Queue + Approval Detail

## Priority 2

Audit Timeline

## Priority 3

Agent Detail

## Priority 4

Policies

## Priority 5

Architecture

## Priority 6

Registry polish

That order reflects product value, not navigation order.

---

# 18. Final definition of success for the UI

The UI is successful if:

1. it feels unlike a generic AI app,
    
2. approval feels consequential,
    
3. audit feels evidentiary,
    
4. policies feel reasoned,
    
5. architecture feels credible,
    
6. and the entire product can be understood in under two minutes.
