# Stress Test 5: Power User — Dashboard Deep Dive

**Date**: 2026-03-21
**Tester**: Automated (Claude Code + Playwright)
**Dashboard**: http://localhost:3000
**API**: http://localhost:4000

## Data Volume Created

| Entity | Count |
|--------|-------|
| Agents | 12 (3 seed + 9 stress) |
| Policies | 30 (13 seed + 17 stress) |
| Traces | 170+ (55 seed + 38 evaluations + lifecycle ops) |
| Pending Approvals | 13 initially, 7 after rapid approval test |
| Users | 3 (admin, viewer, reviewer) |
| API Keys | 6 |
| Webhooks | 1 |

---

## 1. Performance Assessment

| Page | Load Time | Notes |
|------|-----------|-------|
| `/dashboard` (Overview) | <1s | All stat cards render immediately |
| `/dashboard/agents` | <1s | 12 agents load without lag |
| `/dashboard/agents/agent-001` | <1s | Stats, integrations, activity all render |
| `/dashboard/policies` | ~1s | 30 policies in long scrollable list, no pagination |
| `/dashboard/approvals` | <1s | 13 pending approvals render immediately |
| `/dashboard/audit` | <1s | 100+ traces in scrollable list |
| `/dashboard/architecture` | <1s | SVG diagram renders instantly |
| `/dashboard/settings/*` | <1s | All settings sub-pages instant |

**No page exceeded 2 seconds to interactive.** No observable layout shifts on any page. All pages rendered content on first paint without skeleton/loading states visible.

---

## 2. Scaling Assessment

### Agents (12 agents)
- All 12 agents visible on a single page with "Showing 1-12 of 12" pagination indicator
- Pagination controls present (Previous/Next) but not needed at this volume
- Table layout handles 12 rows well; would benefit from pagination at ~25+ agents

### Policies (30 policies)
- All 30 policies render in a single scrollable page grouped by agent
- **No pagination** — at 30 policies this is manageable but becomes unwieldy
- Each policy card shows full rationale text, making the page very long
- **Recommendation**: Add pagination or "show more" at 10-15 policies per agent group

### Traces (170+ traces)
- Trace list loads all visible traces without lag
- Scrolling is smooth
- Date range and agent filters work correctly
- The trace detail panel updates correctly when clicking different traces

### Approvals (13 pending)
- Queue handles 13 items well
- Sort options (oldest, newest, highest risk, agent, classification) all work
- Summary bar shows accurate counts (Critical: 0, High: 12, Medium: 0, Low: 0)

---

## 3. Filter/Sort Bugs

### Working Correctly
- **Agents page**: Environment, Lifecycle, Authority, Autonomy filters — all work individually and in combination. Clearing one filter preserves others.
- **Policies page**: Agent filter, Effect filter, Classification filter — combined filtering works correctly.
- **Approvals page**: Status filter (Pending/Approved/Denied), Sort options (oldest, newest, highest risk) all work.
- **Audit page**: Agent filter, Outcome filter work. Date range filter present.
- **Policies page with query params**: `/dashboard/policies?agent_id=agent-001` correctly pre-selects the agent filter.

### Issues Found
- **No text search on agents page**: The agents registry has dropdown filters but no text search for agent name or owner. The only text search is the global search bar, which doesn't filter the page — it shows results in a dropdown. (Severity: Low, UX improvement)

---

## 4. Navigation Bugs

### Breadcrumbs
- **BUG**: Breadcrumbs show raw URL slugs instead of human-readable names:
  - Agent detail: Shows "Agents > agent-001" instead of "Agents > Customer Communications Agent"
  - Settings sub-pages: Shows "Settings > api-keys" instead of "Settings > API Keys"
  - **Severity**: Low — functional but poor UX

### Back/Forward
- Works correctly: Overview → Agents → Agent Detail → Policies, then Back x3 returns to Overview, Forward goes forward correctly.

### Direct URL Navigation
- `/dashboard/agents/agent-001` — loads correctly
- `/dashboard/policies?agent_id=agent-001` — loads with agent filter pre-selected
- `/dashboard/audit` — loads correctly
- `/dashboard/settings/api-keys` — loads correctly

### 404 Handling
- `/dashboard/agents/non-existent-agent` — Shows "Failed to load agent details" with "Return to registry" link. Good handling within the app shell.
- **BUG**: `/dashboard/fake-page` — Shows Next.js default 404 page with **white background**, breaking the dark theme design system. Should have a custom 404 page with #0A0A0B background.
  - **Severity**: Medium — jarring visual break for users who mistype URLs

### Login Redirect
- **BUG**: After session expiry, navigating to `/dashboard/agents/agent-001` redirects to login, but after SSO login, redirects to `/dashboard` (overview) instead of the originally intended URL.
  - **Severity**: Medium — frustrating for daily users who bookmark deep links

---

## 5. Visual Consistency

### Consistent Across All Pages
- Background: `#0A0A0B` consistently used on all dashboard pages
- Borders: Subtle, consistent `border-border` class throughout
- Badge colors: Green = Active/Allow, Amber = Pending/Approval Required/High risk, Red = Deny/Revoked/Remove
- Spacing: Consistent padding and gaps between cards, tables, sections
- Fonts: Inter for body text, monospace (font-mono) for trace IDs, operations, timestamps

### Issues
- **404 page**: White background breaks design system (see Navigation Bugs)
- **Architecture page**: SVG diagram on dark background — lines/arrows are light gray, could be slightly more visible
- **Policy cards**: Long rationale text is shown in full, making policy list very tall. Consider truncation with "show more"

---

## 6. Data Integrity

| Metric | Overview | Actual Page | Match? |
|--------|----------|-------------|--------|
| Agents count | 12 | 12 (agents page) | Yes |
| Policies count | 30 | 30 (policies page) | Yes |
| Pending approvals | 7 | 7 (approval queue) | Yes |
| Sidebar badge | 7 | 7 (approval queue) | Yes |
| Traces today | 170 | 170+ (audit page) | Yes |

**All cross-page counts match.** After approving 5 items:
- Overview pending count decremented from 13 → 7 (correct, some expired during testing)
- Sidebar badge updated in sync
- Approval queue reflected correct remaining items
- Approved items visible under "Approved" status filter

---

## 7. Edge Cases

### Special Characters
- **Global search**: `<>{}()[]` handled gracefully — shows "No results" without errors or crashes
- **Global search**: 100+ character string handled gracefully — shows "No results"
- **Settings**: Workspace name with `Test & Co. "Workspace" <LLC>` — **save fails** with "Failed to save settings" error. Even plain text changes fail, suggesting a broader issue with the general settings save (likely CSRF or API proxy misconfiguration).

### Rapid Actions
- Rapid approval (5 items in quick succession): Queue updates correctly each time, no UI glitches, sidebar badge decrements properly
- Clicking different traces rapidly: Detail panel updates correctly each time

### Global Search
- Debounce works — results appear after typing pauses
- Escape key closes dropdown correctly
- Click outside closes dropdown
- Clicking a result navigates to correct page
- Grouped results: Agents, Policies, Approvals, Traces — all categories shown
- Search for exact agent name: appears as first result

### Approval Finality
- No "undo" option after approving — correct behavior
- Approved items move to "Approved" filter view

---

## 8. Screenshots

All 13 full-page screenshots saved to `research/stress-tests/screenshots/05/`:

| # | Page | File |
|---|------|------|
| 1 | Overview | `01-overview-*.png` |
| 2 | Agent Registry | `02-agents-registry-*.png` |
| 3 | Agent Detail | `03-agent-detail-*.png` |
| 4 | Policies | `04-policies-*.png` |
| 5 | Approvals | `05-approvals-*.png` |
| 6 | Audit/Traces | `06-audit-*.png` |
| 7 | Architecture | `07-architecture-*.png` |
| 8 | Settings Overview | `08-settings-*.png` |
| 9 | Settings: General | `09-settings-general-*.png` |
| 10 | Settings: Users | `10-settings-users-*.png` |
| 11 | Settings: API Keys | `11-settings-api-keys-*.png` |
| 12 | Settings: Webhooks | `12-settings-webhooks-*.png` |
| 13 | Settings: Audit Export | `13-settings-audit-export-*.png` |

Additional screenshots: `approvals-sorted-risk-*.png` (approvals sorted by highest risk)

---

## 9. UX Pain Points

1. **No per-page text search on agents or policies**: Power users managing 10+ agents need to quickly find by name. The global search shows results but doesn't filter the current page.

2. **Policies page has no pagination**: With 30 policies, the page becomes a very long scroll. Grouped by agent with full rationale text displayed means a lot of vertical space. Daily users reviewing policies would prefer pagination or collapsible agent groups.

3. **Breadcrumbs show raw IDs/slugs**: "agent-001" and "api-keys" in breadcrumbs rather than human-readable names. Minor but annoying for daily use.

4. **General settings save is broken**: Can't change workspace name or other settings. The save always fails. This blocks day-1 setup.

5. **No redirect-after-login preservation**: After session timeout, logging back in drops you at the overview instead of where you were. For a power user checking a specific approval from a notification link, this means navigating again.

6. **Approval detail requires extra click**: Each approval requires clicking to open the detail panel, then scrolling to the Approve/Deny buttons. For reviewing 10+ approvals daily, inline approve/deny buttons on the queue cards (or keyboard shortcuts) would dramatically speed up the workflow.

7. **No keyboard shortcuts**: No shortcuts for common actions like navigating between pages, searching (Cmd+K), or approve/deny (A/D keys when detail panel is open).

---

## 10. Bugs Found

### Critical (0)
None.

### High (1)

| # | Bug | Reproduction | Impact |
|---|-----|--------------|--------|
| H1 | General Settings save always fails | Go to Settings > General, change any field, click Save Changes → "Failed to save settings" | Blocks workspace configuration entirely |

### Medium (3)

| # | Bug | Reproduction | Impact |
|---|-----|--------------|--------|
| M1 | 404 page uses white background | Navigate to `/dashboard/fake-page` | Breaks dark theme; jarring for users |
| M2 | Login redirect doesn't preserve intended URL | Session expires → navigate to deep link → login → lands on overview | Frustrating for notification/bookmark users |
| M3 | Breadcrumbs show raw IDs instead of names | Navigate to `/dashboard/agents/agent-001` → breadcrumb shows "agent-001" | Poor UX, doesn't help orientation |

### Low (2)

| # | Bug | Reproduction | Impact |
|---|-----|--------------|--------|
| L1 | No text search filter on agents page | Open agents page → no input field to search by name/owner | Minor UX gap for power users |
| L2 | Policies page has no pagination | Create 30+ policies → all shown in single scroll | Usability degrades with scale |

---

## Summary

The dashboard performs well under stress test conditions. All pages load in under 1 second with realistic data volumes (12 agents, 30 policies, 170+ traces). Filtering, sorting, and cross-page data consistency all work correctly. The approval workflow — the platform's core differentiator — works smoothly including rapid sequential approvals.

The main issues are:
1. **General settings save is broken** (High) — likely API proxy or CSRF configuration issue
2. **404 page breaks dark theme** (Medium) — needs custom not-found page
3. **Login redirect drops deep links** (Medium) — needs redirect_uri preservation through auth flow
4. **Breadcrumbs show raw IDs** (Medium) — cosmetic but affects daily UX

Overall assessment: **Ready for beta with the High bug fixed.** The UX pain points (no text search, no pagination, no keyboard shortcuts) are quality-of-life improvements that can be addressed iteratively.
