# Stress Test 1: New User Journey — Report

**Date:** 2026-03-21
**Tester:** Claude (automated browser + API)
**Environment:** localhost (API :4000, Dashboard :3000, Docs :3001, Landing :3002)

---

## Journey Log

### Step 1: Landing Page Discovery (localhost:3002)

The landing page loads cleanly with a dark theme. The hero section communicates the value prop within 5 seconds: "The approval and accountability layer for agentic AI." The page has the following sections:

1. **Hero** — Clear headline, two CTAs ("Get Started Free", "View on GitHub"), npm install command
2. **Stats** — 73%, 79%, 37% figures with NeuralTrust citation
3. **How it works** — Identity → Policy → Approval → Trace cards, Approval highlighted as "Differentiator"
4. **Approval card mockup** — Realistic approval UI with action context, risk classification, approve/deny buttons
5. **Comparison table** — SidClaw vs Traditional IAM, showing the approval gap
6. **Built for regulated industries** — Finance (FINRA 2026), Healthcare (HIPAA), Platform Teams
7. **Pricing** — Free, Team, Enterprise tiers
8. **Open source at the core** — Apache 2.0 messaging
9. **Final CTA** — "Get started in 2 minutes"
10. **Footer** — Minimal with GitHub link

**Issues found:**
- All "Get Started Free" links point to `https://app.sidclaw.com/signup` (production URL), not `localhost:3000/signup` — expected for production, but confusing for local dev/demo
- "View on GitHub" links to `https://github.com/sidclawhq/sdk` — should be verified that this repo exists
- npm install copy button has no visual feedback (no "Copied!" tooltip)
- **Mobile (375px):** Missing space in subtitle — "oversight.Not" should be "oversight. Not"
- **Mobile:** "Pricing" and "GitHub" nav links disappear with no hamburger menu

### Step 2: Documentation Quick Start (localhost:3001)

The docs site loads at localhost:3001 with a clean landing page. The Quick Start guide has 5 well-structured steps:

1. Install the SDK (`npm install @sidclaw/sdk`) — correct package name
2. Get an API Key — instructions for both cloud and local
3. Initialize the Client — correct import from `@sidclaw/sdk`
4. Wrap Your Agent's Tools — `withGovernance()` example
5. See It in Action — dashboard instructions

No `@agent-identity` references found anywhere in the docs content. Search functionality works (tested "webhook" — found "Webhooks" and "Webhook Endpoints").

**Issues found:**
- **Sidebar layout bug:** On direct URL navigation, the sidebar expands to full width, covering page content. Clicking a sidebar item fixes it. Reproducible on every page load via URL.
- **Sidebar text duplication:** Active page shows doubled text (e.g., "Agent IdentityAgent Identity", "FINRA 2026 ComplianceFINRA 2026 Compliance Mapping")
- Floating UI elements (search icon, theme toggle) appear misplaced in top-left on initial load

### Step 3: Signup (localhost:3000/signup)

The signup form has three fields (Name, Email, Password) plus GitHub and Google OAuth buttons.

**Validation testing:**
- Empty form submit → Browser HTML5 validation fires ("Please fill out this field")
- Short password "abc" → Red error: "Password must be at least 8 characters"
- Valid submission (Name: "New User", Email: newuser@test.com, Password: TestPass123) → Success

**Post-signup experience:**
- Redirected to `/dashboard?onboarding=true`
- Dashboard shows all zeros (0 agents, 0 policies, etc.)
- System Health shows green (API, Database, Jobs all healthy)

**Issues found:**
- **Browser title:** "Agent Identity & Approval Layer" — should be "SidClaw" (old branding)
- **Subtitle:** "Get started with Agent Identity" — should be "Get started with SidClaw"
- **Sidebar brand:** Shows "Agent Identity" throughout the entire dashboard
- **No API key shown after signup** — the key is created but never displayed. User has no way to know their API key.
- **No onboarding checklist visible** despite `?onboarding=true` URL parameter
- API key creation via Settings works, but checking only "Admin (full access)" scope triggers a validation error "Select at least one scope" — the admin scope isn't counted as a valid selection
- Toast messages persist across page navigations (e.g., "Select at least one scope" toast follows you to Agents page)

### Step 4: First Agent Registration

**Issues found:**
- **No "Create Agent" button in the UI** — the Agents page only shows a list view with filters. There is no way for a new user to register an agent from the dashboard.
- Agent creation via API requires the `admin` scope, but the default API key only has `evaluate`, `traces:read`, `traces:write`, `approvals:read` — so API-based creation is also blocked.
- The API requires many undocumented fields (authorized_integrations as array of objects with name/resource_scope/data_classification/allowed_operations, credential_config, metadata, next_review_date as ISO datetime, created_by) — no sensible defaults.
- **Workaround:** Agent creation was accomplished via browser console using session authentication with CSRF token.
- Once created, the agent appeared correctly in the registry and the detail page rendered all fields properly with breadcrumbs, lifecycle controls (Suspend/Revoke), authorized integrations table, policy summary, and recent activity.

### Step 5: First Policy Creation

The Policies page has a "Create Policy" button — unlike Agents, this part of the UI is complete.

The Create Policy form includes: Agent (dropdown), Policy Name, Operation, Target Integration, Resource Scope, Data Classification (dropdown), Effect (dropdown), Priority (default 100), and Rationale.

Both policies were created successfully via the UI:
1. **Customer email review** — send_email → email_service / customer_emails, Confidential, Approval Required
2. **Internal docs access** — read_docs → knowledge_base / *, Internal, Allow

Policy cards display correctly with badges, rationale in italics, version number (v1), and action buttons (Test, History, Edit, Deactivate).

### Step 6: First SDK Evaluation

Both API calls returned correct decisions:

```
# read_docs → ALLOWED (as expected)
{"decision":"allow","reason":"Read access to internal docs is always permitted"}

# send_email → APPROVAL REQUIRED (as expected)
{"decision":"approval_required","reason":"Customer emails require human review for compliance","risk_classification":"high"}
```

### Step 7: First Approval

The approval request appeared immediately in the Approvals page with:
- "1 pending approval" header with risk breakdown (Critical: 0, High: 1, Medium: 0, Low: 0)
- Badge indicators: Pending, HIGH, Confidential
- Rationale displayed inline
- Sidebar badge showing "1" on Approvals link

The Approval Detail panel is excellent:
- REQUEST SUMMARY with operation, scope, badges
- AUTHORITY CONTEXT (owner, role, authority model, delegation model, team)
- **"Why This Was Flagged"** section — shows policy name, rationale, and version
- CONTEXT SNAPSHOT
- TRACE SO FAR — full event timeline within the approval
- GOVERNANCE METADATA — trace ID, policy version, timestamps, separation of duties status
- REVIEWER ACTION — notes field, Approve/Deny buttons

**Issue found:**
- **"Agent owner cannot self-approve"** — The separation of duties check prevents the agent owner from approving their own agent's requests. For a single-user workspace on the free tier, this creates a **dead end** — the user cannot complete the approval workflow alone. This is correct security behavior but devastating for the new user experience.

### Step 8: First Trace

The Audit page shows both traces correctly:
- send_email → "In Progress" (pending approval)
- read_docs → "In Progress" (pending)

Clicking a trace reveals a detailed timeline panel with:
- Trace header (ID, agent, operation, authority, scope, duration, start time)
- "Verified (5)" integrity badge
- Export JSON button
- Event Timeline with millisecond-precision timestamps:
  1. Trace Initiated (green dot)
  2. Identity Resolved (gray dot)
  3. Policy Evaluated (blue dot)
  4. Sensitive Operation Detected (blue dot)
  5. Approval Requested (amber dot)

The event sequence is logical and timestamps are sequential.

### Step 9: Edge Cases

| Test | Result |
|------|--------|
| **Refresh (F5)** | Pages reload correctly with state preserved |
| **XSS injection** | `<script>alert('xss')</script>` stored as data but rendered as escaped text — React's default escaping works correctly. No XSS execution. |
| **Back button** | Works correctly, pages maintain their state |
| **Toast persistence** | Toasts (e.g., "Select at least one scope", "Policy created") persist across page navigations — minor UX annoyance |

---

## Friction Points

1. **No API key after signup** — The most critical first-time friction. A developer signs up, sees an empty dashboard, and has no idea what their API key is or where to find it.
2. **No agent creation UI** — The Agents page has no "Create" button. The only way to create an agent is via API, but the default API key lacks the required scope.
3. **Self-approval blocked** — Single-user workspaces hit a dead end at the approval step. The separation of duties check prevents completing the workflow.
4. **Undocumented API fields** — Creating an agent via API requires many fields (authorized_integrations as complex objects, credential_config, metadata, next_review_date, created_by) with no defaults and no error messages that guide the user.
5. **Old branding throughout** — "Agent Identity" appears in browser titles, dashboard sidebar, and signup subtitle instead of "SidClaw".

---

## Bugs Found

### Critical (P0)

| # | Location | Description |
|---|----------|-------------|
| 1 | Dashboard: Agents page | **No "Create Agent" button.** Users cannot register agents from the UI. The only path is API, which also fails due to scope restrictions on the default key. |
| 2 | Signup flow | **API key never shown after signup.** The key is created and hashed, but never displayed. There is no way to retrieve the full key afterward. |
| 3 | Approvals | **Single-user dead end.** Agent owner cannot self-approve, making the approval workflow impossible to complete for free-tier single-user workspaces. |

### High (P1)

| # | Location | Description |
|---|----------|-------------|
| 4 | Dashboard: everywhere | **Old branding "Agent Identity"** in browser titles, sidebar, and signup page. Should be "SidClaw". |
| 5 | API Keys: Create dialog | **"Admin (full access)" scope not recognized** as valid scope selection. Checking only Admin triggers "Select at least one scope" validation error. |
| 6 | Landing page: Pricing | **Pricing inconsistency (Team plan):** Landing page says "Unlimited policies" but API enforces 100 per agent. Landing page says "10 API keys" but API allows 20. |
| 7 | Docs site | **Sidebar layout bug:** On direct URL navigation, sidebar expands to cover entire page content. Content only appears after clicking a sidebar link. |

### Medium (P2)

| # | Location | Description |
|---|----------|-------------|
| 8 | Docs site: sidebar | **Duplicate text** in sidebar for active page (e.g., "Agent IdentityAgent Identity"). |
| 9 | Landing page: mobile | **Missing space** in hero subtitle — "oversight.Not" should be "oversight. Not". |
| 10 | Landing page: mobile | **Nav links hidden** (Pricing, GitHub) with no hamburger menu on mobile viewport. |
| 11 | Dashboard: toasts | **Toasts persist across navigation.** Error and success toasts follow the user to other pages. |
| 12 | Landing page | **npm copy button** has no visual feedback when clicked. |
| 13 | Signup: onboarding | **No onboarding checklist** displayed despite `?onboarding=true` URL parameter and OnboardingChecklist component existing in code. |

### Low (P3)

| # | Location | Description |
|---|----------|-------------|
| 14 | Landing page | "Get Started Free" links point to production URL `https://app.sidclaw.com/signup` — correct for production but confusing for local testing. |
| 15 | Docs site | Floating search/theme UI elements appear misaligned on initial page load. |

---

## UX Recommendations

1. **Show API key at signup** — After creating an account, display the API key in a modal with a copy button and the warning "This won't be shown again." The Settings > API Keys page already has this pattern for manually created keys.

2. **Add "Create Agent" button** — The Agents page needs a CTA, at minimum matching the pattern used by the Policies page. Consider a guided wizard for first-time users.

3. **Handle single-user approval** — Options:
   - Allow self-approval for the first agent or in free-tier workspaces
   - Show a clear message explaining the separation of duties requirement and how to invite a teammate
   - Provide a "sandbox mode" for solo developers to test the flow

4. **Replace "Agent Identity" branding** — Global search-and-replace for all UI strings referencing the old name. Check browser `<title>` tags, sidebar, signup page, and any metadata.

5. **Add onboarding checklist** — The component exists (`OnboardingChecklist.tsx`) but isn't rendered. It should appear on first login, showing: Create API key → Register agent → Create policy → Run first evaluation → Review approval.

6. **Improve API error messages** — When creating agents, return helpful error messages that show required fields with example values, not just Zod validation errors.

7. **Fix pricing page consistency** — Ensure landing page pricing matches API-enforced plan limits exactly.

---

## Edge Case Results

| Edge Case | Result | Notes |
|-----------|--------|-------|
| Back button | PASS | State persists correctly |
| Page refresh | PASS | All pages reload without errors |
| Double-click approve | N/A | Could not test — self-approval blocked |
| Multiple tabs | N/A | Not tested in this session |
| Long strings | N/A | Not tested via UI (no create agent UI) |
| XSS (`<script>alert('xss')</script>`) | PASS | Properly escaped by React, rendered as text |
| Empty states | PASS | Each page shows appropriate "No X found" messages |
| Toast persistence | FAIL | Toasts from one page appear on the next |

---

## Summary

The core platform works correctly: policy evaluation returns the right decisions, audit traces capture the full event chain with integrity verification, and the approval workflow surfaces rich context for human reviewers. The dashboard design is clean and professional.

However, the **new user journey is broken at multiple critical points**. A developer who signs up today cannot:
1. See their API key
2. Create an agent from the UI
3. Complete the approval workflow solo

These three blockers mean the first-time experience requires API workarounds with session auth and CSRF tokens — not the "2 minutes to first governed action" that the landing page promises.

**Priority fix order:** Show API key at signup → Add Create Agent UI → Handle single-user approval → Fix branding → Fix pricing inconsistencies.
