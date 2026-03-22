# Stress Test 5: Power User Dashboard Workflow

You are an experienced platform engineer who manages 5+ AI agents in production. Test the dashboard's ability to handle realistic multi-agent governance workflows on the live platform at `https://app.sidclaw.com`. Use Playwright MCP tools (mcp__playwright__*) for all browser interactions — navigate, click, fill forms, take screenshots.

**Do NOT modify any code. Only interact via the browser and API.**

## Setup

1. Open `https://app.sidclaw.com/signup` and create an account:
   - Name: `Platform Engineer`
   - Email: `platform-eng@sidclaw.com`
   - Password: `PlatformEng2026!`

2. Get an API key from Settings > API Keys (or use the one from onboarding)

## Workflow Tests

### Test 1: Multi-Agent Setup

Create 5 agents via the dashboard (if Create Agent UI exists) or via API:

| Agent | Authority | Autonomy | Environment |
|-------|-----------|----------|-------------|
| Customer Support Bot | hybrid | high | prod |
| Data Pipeline Agent | self | medium | prod |
| Code Review Assistant | delegated | low | dev |
| Compliance Scanner | self | high | prod |
| Internal Comms Agent | hybrid | medium | prod |

For each, set appropriate `authorized_integrations`.

Verify:
- All 5 appear in the Agent Registry
- Filters work: filter by environment (prod shows 4), by autonomy (high shows 2)
- Search works: type "compliance" — shows Compliance Scanner only
- Take a screenshot of the registry with 5 agents

### Test 2: Complex Policy Configuration

Create 15+ policies across the 5 agents — a realistic policy set:

| Agent | Policy | Effect |
|-------|--------|--------|
| Customer Support | Read knowledge base | allow |
| Customer Support | Send email to customer | approval_required |
| Customer Support | Access customer PII | deny |
| Customer Support | Update CRM record | approval_required |
| Data Pipeline | Read source tables | allow |
| Data Pipeline | Write to target tables | allow |
| Data Pipeline | Drop tables | deny |
| Data Pipeline | Export to external | approval_required |
| Code Review | Read repository | allow |
| Code Review | Post comments | allow |
| Code Review | Merge PRs | approval_required |
| Compliance Scanner | Read all systems | allow |
| Compliance Scanner | Generate reports | allow |
| Compliance Scanner | Modify compliance records | deny |
| Internal Comms | Send internal messages | allow |
| Internal Comms | Send external emails | approval_required |

Verify:
- Policies page shows all policies grouped by agent
- Effect badge colors correct (green/amber/red)
- "View policies" link from agent detail shows filtered view
- Take a screenshot of the policies page

### Test 3: Trigger Multiple Evaluations

Via API, trigger evaluations for several agents to simulate real traffic:

```bash
API_KEY="<key>"

# Allow path
curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<compliance_scanner_id>","operation":"read","target_integration":"compliance_system","resource_scope":"all_records","data_classification":"internal"}'

# Approval path
curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<customer_support_id>","operation":"send_email","target_integration":"email_service","resource_scope":"customer_emails","data_classification":"confidential","context":{"customer_id":"C-1234","template":"follow-up","reason":"Customer requested callback after support ticket"}}'

# Deny path
curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<data_pipeline_id>","operation":"drop","target_integration":"database","resource_scope":"production_tables","data_classification":"restricted"}'

# More approvals
curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<code_review_id>","operation":"merge","target_integration":"github","resource_scope":"main_branch","data_classification":"confidential","context":{"pr_number":"#847","title":"Update auth middleware","approvals":2}}'

curl -s -X POST https://api.sidclaw.com/api/v1/evaluate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<internal_comms_id>","operation":"send_external","target_integration":"email_service","resource_scope":"external_contacts","data_classification":"confidential","context":{"recipient":"partner@company.com","subject":"Partnership update"}}'
```

### Test 4: Approval Queue Under Load

1. Open the Approvals page
2. Verify multiple pending approvals appear (from Test 3)
3. Test sorting: "Highest risk" — do critical/high risk items sort first?
4. Test sorting: "Oldest first"
5. Verify stale indicators (if any approvals are old enough)
6. Verify the pending count badge in the sidebar matches

### Test 5: Batch Approval Workflow

1. Review and approve each pending approval one by one:
   - Read the "Why This Was Flagged" section
   - Read the context snapshot (does it show the context you passed in the evaluate call?)
   - Add a reviewer note
   - Click Approve
2. Verify toast notifications after each
3. Verify the queue refreshes (approved items disappear)
4. Take screenshots of: approval detail with context, after approving

### Test 6: Trace Investigation

1. Navigate to Audit
2. Verify all traces from Test 3 appear
3. Select a trace that went through approval — verify the complete event chain
4. Verify the context snapshot is visible in the trace events
5. Select a denied trace — verify it shows blocked immediately
6. Use filters: filter by agent, by outcome
7. Export a trace as JSON — verify it downloads
8. Export traces as CSV for today's date range — verify it downloads
9. Take screenshots of: trace list with multiple agents, trace detail with approval events

### Test 7: Agent Lifecycle Management

1. Navigate to Agent Detail for one of the prod agents
2. Suspend it — verify confirmation dialog, then suspension
3. Trigger an evaluation for the suspended agent (via API) — verify it returns `deny` with reason "Agent is suspended"
4. Reactivate the agent — verify it goes back to active
5. Trigger another evaluation — verify it works normally now
6. Take screenshots of: suspension, denial, reactivation

### Test 8: Overview Dashboard Accuracy

1. Navigate to Overview
2. Verify stat cards reflect the real numbers:
   - Total agents: 5 (or however many you created)
   - Active agents: matches
   - Total policies: 15+
   - Pending approvals: should be 0 after Test 5 (all approved)
   - Traces today: reflects all evaluations
3. Verify system health: API, Database, Jobs all healthy
4. Take a screenshot

### Test 9: Global Search

1. Use the search bar:
   - Search "customer" — should find Customer Support Bot agent and related policies
   - Search "compliance" — should find Compliance Scanner
   - Search "merge" — should find the merge PR trace or the Code Review policy
2. Click a search result — verify navigation works
3. Take a screenshot of search results

### Test 10: Settings Management

1. Navigate to Settings > General
2. Change the workspace name to "Production Governance Platform"
3. Save — verify toast
4. Navigate to Settings > API Keys
5. Create a new API key with only `evaluate` scope
6. Verify the key appears in the list
7. Take a screenshot of settings

## Deliverable

Write a report to `research/stress-tests/stress-test-5-power-user.md` with:

1. **Workflow completion**: Did you complete all 10 tests? Which ones had issues?
2. **Performance observations**: Any slow pages? Slow API responses? Timeouts?
3. **Data accuracy**: Do stats, counts, and badge numbers match reality?
4. **UX with real data**: How does the dashboard feel with 5 agents, 15 policies, and multiple traces? Still clean or cluttered?
5. **Approval workflow**: Was the approve flow efficient for multiple items? What would make it faster?
6. **Search quality**: Did search return relevant results?
7. **Bugs found**: Any errors, broken flows, or unexpected behavior?
8. **Feature requests**: What's missing for a real production governance workflow?
9. **Overall assessment**: Is this dashboard usable for daily production governance of 5+ agents?
10. **Screenshots** saved to `research/screenshots/stress-tests/`
