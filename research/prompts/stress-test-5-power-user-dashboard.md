# Stress Test 5: Power User — Dashboard Deep Dive

You are an admin user who has been using SidClaw for a month. You manage 10+ agents, dozens of policies, and review approvals daily. Use Playwright to test the dashboard like someone who depends on it for their daily workflow.

**Do NOT modify any code.** Only test and report.

## Prerequisites

1. Start all services (db, API on :4000, dashboard on :3000).
2. Seed the database.
3. Log into the dashboard.

## Part A: Stress the Data — Create Volume

Before testing the UI, create realistic data volume via API:

```bash
API_KEY="<dev_api_key>"

# Create 8 more agents (total: 11 agents)
for i in $(seq 4 11); do
  curl -s -X POST http://localhost:4000/api/v1/agents \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Agent $i - $(echo test_$(date +%s)_$i)\",
      \"description\": \"Stress test agent number $i with a somewhat longer description to test text wrapping and truncation in the UI\",
      \"owner_name\": \"Owner $i\",
      \"owner_role\": \"Role $i\",
      \"team\": \"Team $((i % 3 + 1))\",
      \"environment\": \"$(echo 'dev test prod' | tr ' ' '\n' | sed -n \"$((i % 3 + 1))p\")\",
      \"authority_model\": \"$(echo 'self delegated hybrid' | tr ' ' '\n' | sed -n \"$((i % 3 + 1))p\")\",
      \"identity_mode\": \"service_identity\",
      \"delegation_model\": \"self\",
      \"autonomy_tier\": \"$(echo 'low medium high' | tr ' ' '\n' | sed -n \"$((i % 3 + 1))p\")\",
      \"created_by\": \"stress-test\"
    }"
done

# Create 30+ policies across agents
for i in $(seq 1 30); do
  AGENT_ID="agent-00$((i % 3 + 1))"
  curl -s -X POST http://localhost:4000/api/v1/policies \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"agent_id\": \"$AGENT_ID\",
      \"policy_name\": \"Stress Test Policy $i\",
      \"operation\": \"operation_$i\",
      \"target_integration\": \"integration_$((i % 5))\",
      \"resource_scope\": \"scope_$((i % 10))\",
      \"data_classification\": \"$(echo 'public internal confidential restricted' | tr ' ' '\n' | sed -n \"$((i % 4 + 1))p\")\",
      \"policy_effect\": \"$(echo 'allow approval_required deny' | tr ' ' '\n' | sed -n \"$((i % 3 + 1))p\")\",
      \"rationale\": \"This is stress test policy number $i with a detailed rationale explaining why this policy exists and what compliance requirement it addresses\",
      \"priority\": $((50 + i)),
      \"modified_by\": \"stress-test\"
    }"
done

# Create 50+ evaluations (generates traces + some approval requests)
for i in $(seq 1 50); do
  curl -s -X POST http://localhost:4000/api/v1/evaluate \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"agent_id\": \"agent-00$((i % 3 + 1))\",
      \"operation\": \"operation_$((i % 10))\",
      \"target_integration\": \"integration_$((i % 5))\",
      \"resource_scope\": \"scope_$((i % 10))\",
      \"data_classification\": \"$(echo 'public internal confidential restricted' | tr ' ' '\n' | sed -n \"$((i % 4 + 1))p\")\",
      \"context\": {\"test_number\": $i}
    }" > /dev/null
done

echo "Created stress test data"
```

## Part B: Dashboard Under Load

### B1: Agent Registry with 11+ Agents

Open `/dashboard/agents`:

- Does the page load without lag?
- Are all 11+ agents visible? Or is pagination working?
- **Sorting**: Click each sortable column header. Does it sort correctly? Does the sort indicator update?
- **Filtering**: Apply multiple filters simultaneously (e.g., environment=prod + lifecycle=active + authority=hybrid). Does the combination work? Does clearing one filter keep the others?
- **Search**: Type a partial agent name. Does it filter in real-time? What about searching for an owner name?
- **Pagination**: If there are enough agents, navigate between pages. Does the page indicator update?
- Take a screenshot showing all filters applied simultaneously.

### B2: Agent Detail with Rich Data

Open an agent that has many policies and traces:

- Do the stats load quickly? (policy_count, pending_approvals, traces_last_7_days)
- Is the "Recent Activity" section populated? Are the links correct?
- Does "View all policies →" navigate to the correct filtered page?
- Does "View all traces →" work?

### B3: Policy Page with 30+ Policies

Open `/dashboard/policies`:

- Does it load without lag?
- Are policies correctly grouped by agent?
- With 30+ policies, is the page still usable? Or does it need pagination?
- **Filtering by agent**: Select a specific agent — does it filter correctly? Do the other agents' policies disappear?
- **Filtering by effect**: Select "deny" — does it show only deny policies?
- **Combined filters**: Agent + effect + classification simultaneously
- **Search**: Search for a policy name. Search for text in a rationale.
- **Create policy while filtered**: Create a new policy while filters are active. After creation, does it appear in the list? Are the filters preserved?
- **Edit a policy**: Click Edit on a policy. Change the priority. Save. Does the version increment? Does the change appear immediately?
- **Deactivate a policy**: Click Deactivate on a policy. Confirm. Does it disappear from the list (since default is is_active=true)?

### B4: Approval Queue with Many Pending

Open `/dashboard/approvals`:

- How many pending approvals are there?
- **Sort by risk**: Click "Highest risk" sort. Are critical/high items at the top?
- **Sort by time**: Are oldest items at the top?
- **Stale indicators**: Do any approvals show amber/red stale badges?
- **Rapid approve**: Approve 5 items in quick succession. Does the queue update correctly each time? Any UI glitches? Does the pending count badge in the sidebar decrement?
- **Approve then undo?**: After approving, is there any way to undo? (There shouldn't be — once approved, it's final)
- **Detail panel while queue updates**: Open a detail panel, then approve a DIFFERENT item from the queue. Does the detail panel break? Does the queue refresh behind it?
- **Filter by status**: Switch between "Pending", "Approved", "Denied". Do counts match?
- Take a screenshot of the queue sorted by risk.

### B5: Trace Viewer with 50+ Traces

Open `/dashboard/audit`:

- Does the trace list load without lag?
- **Scrolling**: Scroll through the trace list. Is the performance smooth?
- **Select multiple traces**: Click different traces rapidly. Does the detail panel update correctly each time?
- **Date range filter**: Set a narrow date range. Do only matching traces appear?
- **Agent filter**: Filter by agent. Do only that agent's traces show?
- **Combined filters**: Date range + agent + outcome simultaneously
- **Event expansion**: In a trace detail, click events to expand metadata. Do they expand/collapse smoothly?
- **Trace with many events**: Find a trace with the most events. Does the timeline render completely?
- **Export while filtered**: Export CSV while filters are active. Does the export respect the filters?
- Take a screenshot of the trace viewer with a trace selected and events expanded.

### B6: Overview Dashboard

Open `/dashboard`:

- Do all 7 stat cards show correct numbers?
- **Pending approvals**: Does the count match the actual pending count in the queue?
- **Recent traces**: Are these the most recent 10? Click one — does it navigate correctly?
- **System health**: All green?
- **After approving items**: Return to overview. Did the pending count update?

### B7: Global Search Stress

Use the search bar:

- Search for a common term that appears across agents, policies, traces (e.g., "operation" or "test")
- Does the dropdown show grouped results?
- Search for an exact agent name — does it appear first?
- Search for a trace ID (copy one from the audit page)
- Search for a very long string (100+ characters) — does it handle gracefully?
- Search for special characters: `<>{}()[]`
- Rapid typing: Type quickly, pause, type again. Does the search debounce correctly?
- Click a result — does it navigate to the correct page?
- Press Escape — does the dropdown close?
- Click outside the dropdown — does it close?

### B8: Settings Pages

Open `/dashboard/settings`:

#### General Settings
- Change workspace name to something with special characters: `Test & Co. "Workspace" <LLC>`
- Save. Refresh. Is the name preserved correctly?
- Change it back. Save.

#### Users
- Is the user list loaded?
- Can you see role dropdowns?
- What happens if you try to change your own role? (Should be prevented)
- What happens if you try to remove yourself? (Should be prevented)

#### API Keys
- List shows existing keys?
- Create a new key. Is the raw key dialog dismissible only after acknowledging?
- After dismissal, is the key gone? (Can't see it again)
- Can you see the key prefix in the list?

#### Webhooks
- Create a webhook to a test URL
- Send a test event — does it show success/failure?
- View delivery history — are there entries?
- Delete the webhook — does it disappear?

#### Audit Export
- Select a date range and export JSON — does it download?
- Export CSV — valid file?
- "Configure Webhooks" link works?

## Part C: Navigation Stress

### C1: Breadcrumbs
Navigate to:
- `/dashboard/agents/agent-001` — breadcrumb: "Agents > [Agent Name]"?
- `/dashboard/settings/api-keys` — breadcrumb: "Settings > API Keys"?
- Click breadcrumb parent links — do they navigate correctly?

### C2: Back/Forward
- Navigate: Overview → Agents → Agent Detail → Policies
- Click browser Back button 3 times — do you land back on Overview?
- Click Forward — do you go forward correctly?
- Does the page state (filters, selected items) persist across navigation?

### C3: Direct URL Navigation
Open these URLs directly (paste into browser):
- `http://localhost:3000/dashboard/agents/agent-001`
- `http://localhost:3000/dashboard/policies?agent_id=agent-001`
- `http://localhost:3000/dashboard/audit`
- `http://localhost:3000/dashboard/settings/api-keys`
- Do they all load correctly without going through the sidebar?

### C4: 404 Handling
- Navigate to `/dashboard/agents/non-existent-agent` — what happens?
- Navigate to `/dashboard/fake-page` — what happens?
- Is there a proper 404 page or just a blank screen?

## Part D: Visual Consistency

Using Playwright, take full-page screenshots of every major page and examine:

1. `/dashboard` — Overview
2. `/dashboard/agents` — Registry
3. `/dashboard/agents/agent-001` — Detail
4. `/dashboard/policies` — List
5. `/dashboard/approvals` — Queue
6. `/dashboard/audit` — Trace viewer
7. `/dashboard/architecture` — Diagram
8. `/dashboard/settings` — Settings overview
9. `/dashboard/settings/general` — General settings
10. `/dashboard/settings/users` — Users
11. `/dashboard/settings/api-keys` — API Keys
12. `/dashboard/settings/webhooks` — Webhooks
13. `/dashboard/settings/audit-export` — Audit export

For each:
- Is the background consistently `#0A0A0B`?
- Are borders consistently subtle?
- Are fonts consistent (Inter for body, monospace for technical data)?
- Are badge colors consistent (green=active/allow, amber=pending/approval, red=deny/revoked)?
- Is spacing consistent between cards, sections, tables?
- Any text overflows or truncation issues?
- Any misaligned elements?

## Part E: Performance

For each major page, note:
- Time to first meaningful paint (when content appears)
- Time until interactive (when you can click things)
- Any layout shifts (content jumping around as it loads)

Flag any page that takes >2 seconds to become interactive.

## Deliverable

Write a report to `research/stress-tests/05-power-user-dashboard.md` with:

1. **Performance assessment**: Page load times, any laggy interactions
2. **Scaling assessment**: How does the UI handle 11 agents, 30+ policies, 50+ traces?
3. **Filter/sort bugs**: Any combination that doesn't work
4. **Navigation bugs**: Back/forward, breadcrumbs, direct URLs, 404 handling
5. **Visual consistency**: Any pages that break the design system
6. **Data integrity**: Do counts match between pages? (Overview pending count == Approvals pending count)
7. **Edge cases**: Special characters, long strings, rapid clicks, concurrent operations
8. **Screenshots**: Save ALL 13 full-page screenshots to `research/stress-tests/screenshots/05/`
9. **UX pain points**: What was frustrating about using the dashboard daily?
10. **Bugs found**: With severity and reproduction steps
