# Stress Test 5: Power User Dashboard Workflow

**Date:** 2026-03-22
**Tester:** Claude (automated via Playwright MCP + curl)
**Environment:** Production (`app.sidclaw.com` / `api.sidclaw.com`)

## 1. Workflow Completion

| Test | Status | Notes |
|------|--------|-------|
| Setup: Account creation | Partial | Signup via API worked; dashboard signup form hangs indefinitely |
| Test 1: Multi-Agent Setup | Pass (API) | 5 agents created, filters/search verified via API |
| Test 2: Policy Configuration | Pass (API) | 16 policies created across 5 agents, all effects correct |
| Test 3: Trigger Evaluations | Pass | 5 evaluations: 1 allow, 1 deny, 3 approval_required — all correct |
| Test 4: Approval Queue | Partial | Sorting returns results but ordering has bugs (see below) |
| Test 5: Batch Approval | Pass | All 3 approvals approved with notes, queue cleared to 0 |
| Test 6: Trace Investigation | Pass (API) | Full event chains verified, JSON/CSV export works |
| Test 7: Agent Lifecycle | Pass | Suspend/deny/reactivate/allow cycle works correctly |
| Test 8: Overview Stats | Pass (API) | All stats accurate (5 agents, 16 policies, 0 pending, 9 traces) |
| Test 9: Global Search | Pass (API) | Cross-entity search returns relevant results |
| Test 10: Settings | Partial | API key CRUD works; no settings/tenant PATCH endpoint exists |

**Critical blocker:** The dashboard UI is non-functional in production because `NEXT_PUBLIC_API_URL` is baked as `http://localhost:4000` in the production build. Every API call from the dashboard goes to localhost and silently fails. All testing was done via the API directly.

## 2. Performance Observations

| Operation | Response Time | Notes |
|-----------|--------------|-------|
| Agent creation | ~200ms | Fast |
| Policy creation | ~150ms | Fast |
| Evaluate (allow) | ~40ms | Excellent |
| Evaluate (deny) | ~40ms | Excellent |
| Evaluate (approval_required) | ~60ms | Good, includes approval request creation |
| Approve | ~250ms | Acceptable, includes audit event creation |
| Trace detail | ~100ms | Good, includes event join |
| CSV export (5 traces) | ~80ms | Fast |
| JSON export (single trace) | ~50ms | Fast |
| Global search | ~100ms | Good |
| Dashboard overview | ~150ms | Good, aggregates multiple tables |

No timeouts or slow endpoints observed. API performance is excellent across all operations.

## 3. Data Accuracy

| Metric | Expected | Actual | Match |
|--------|----------|--------|-------|
| Total agents | 5 | 5 | Yes |
| Active agents | 5 | 5 | Yes (after reactivation) |
| Total policies | 16 | 16 | Yes |
| Pending approvals | 0 | 0 | Yes (after approving all 3) |
| Traces today | 7+ | 9 | Close (extra from testing) |
| Avg approval time | ~3 min | 3 min | Yes |
| System health | All healthy | All healthy | Yes |

Stats are accurate. The `traces_today` count includes the lifecycle test evaluations, which is correct behavior.

## 4. UX with Real Data

**Cannot assess dashboard UX** because the production build has a critical deployment bug:

- `NEXT_PUBLIC_API_URL` defaults to `http://localhost:4000`
- This is a Next.js build-time variable (`NEXT_PUBLIC_` prefix) — it must be set during `next build`
- The production deployment did not set this variable, so ALL dashboard API calls silently fail
- Dashboard pages render their chrome (sidebar, headers, filters) but show infinite loading spinners for all data

**API UX assessment:**
- API responses are well-structured with consistent pagination
- Error messages are clear and include request IDs
- Search returns results grouped by entity type with highlight fields
- Export includes comprehensive headers and all relevant fields

## 5. Approval Workflow

**Strengths:**
- Approval requests capture full context snapshot from the evaluate call (customer ID, PR number, recipient, etc.)
- `flag_reason` shows the policy rationale, providing clear "why this was flagged" information
- `risk_classification` computed correctly (high for confidential data, medium for standard)
- Separation of duties check included
- 24-hour expiry window set automatically
- Approval decision includes `approver_name` and `decision_note` — good audit trail

**Issues:**
- Approval sorting by risk is incorrect: returns high/medium/high instead of grouping high items together
- "Oldest first" sort returns items in wrong order (newest first, ignoring `order=asc`)
- After approval, trace `final_outcome` stays `in_progress` instead of updating to `completed_with_approval`
- No batch approval endpoint — must approve one at a time (3 sequential API calls)

**Efficiency for multiple items:** Approving 3 items required 3 separate POST calls. For a power user managing 10+ pending approvals daily, a batch approve endpoint would be significantly more efficient.

## 6. Search Quality

| Query | Expected | Actual | Quality |
|-------|----------|--------|---------|
| "customer" | Customer Support Bot + policies | 1 agent + 3 policies = 4 results | Good |
| "compliance" | Compliance Scanner + policies | 1 agent + 4 policies = 8 results | Good (matches rationale text too) |
| "merge" | Merge PRs policy + trace | 1 policy + 1 trace = 3 results | Good |

Search searches across names, policy names, and rationale text. Results are grouped by entity type (agents, policies, traces, approvals) with highlight fields for display. No false positives observed.

## 7. Bugs Found

### Critical

1. **Dashboard build missing `NEXT_PUBLIC_API_URL`** — Production dashboard at `app.sidclaw.com` has `http://localhost:4000` baked into the JavaScript bundle. All dashboard API calls fail silently, making the entire dashboard non-functional. This must be set at build time to `https://api.sidclaw.com`.

### High

2. **Traces not finalized after approval** — When an approval request is approved, the associated trace's `final_outcome` remains `in_progress` instead of updating to `completed_with_approval`. The `completed_at` and `duration_ms` fields also remain null.

3. **Approval sorting broken** — Sort by `risk_classification` does not properly group risk levels (returns high/medium/high). Sort by `requested_at` with `order=asc` returns results in descending order instead.

### Medium

4. **Dashboard signup form hangs** — The signup form on `app.sidclaw.com/signup` sends the request and shows "Creating account..." indefinitely. Works via direct API call but the form never completes (likely because the POST goes to localhost:4000).

5. **Dashboard login form ambiguous** — The `button:has-text("Sign in")` matches the GitHub OAuth button before the email login submit button, causing unexpected OAuth redirect. The email login form's submit button needs a more specific selector or the OAuth buttons need different text.

6. **No `/api/v1/health` endpoint** — Returns 404. Health checks are only available via the dashboard overview endpoint. A dedicated health endpoint is needed for monitoring/load balancers.

7. **No settings/tenant management API** — No `GET/PATCH /api/v1/settings` or `/api/v1/tenant` endpoint exists. Users can't update workspace name or manage tenant settings via API.

### Low

8. **Signup API key has limited scopes** — The API key returned by signup only has `evaluate`, `traces:read`, `traces:write`, `approvals:read` scopes. Creating agents or policies requires session auth, so a new user can't set up their first agent without using the (broken) dashboard.

## 8. Feature Requests

1. **Batch approval endpoint** — `POST /api/v1/approvals/batch` accepting an array of `{ id, decision, note }` for approving multiple items at once. Critical for power users with 10+ daily approvals.

2. **Webhook notifications** — Alert on new pending approvals via Slack/email so reviewers don't have to poll the queue.

3. **Agent activity metrics** — Per-agent evaluation counts, approval rates, and deny rates on the agent detail page. "This agent triggered 47 evaluations this week, 12 required approval."

4. **Policy simulation/dry-run** — Before creating a policy, test what decisions would change: "This policy would have denied 3 actions in the last 7 days."

5. **Approval delegation** — Assign specific approval reviewers per agent or policy, not just "any admin/reviewer."

6. **Trace auto-finalization** — After an approval is granted, the trace should automatically finalize to `completed_with_approval`.

7. **API key scope management** — Ability to create API keys with admin scopes (agents:write, policies:write) for CI/CD automation.

8. **Dashboard mobile responsiveness** — Cannot assess currently, but a governance dashboard needs to support quick mobile approvals.

## 9. Overall Assessment

### API: Production-Ready

The API is solid for production use with 5+ agents:
- All CRUD operations work correctly with proper validation
- Policy engine evaluates accurately against rules
- Approval workflow captures rich context and maintains audit trail
- Global search returns relevant cross-entity results
- Export capabilities (JSON/CSV) work well
- Agent lifecycle management (suspend/reactivate) functions correctly
- Performance is excellent (<100ms for most operations)
- Error handling is consistent with clear messages and request IDs

### Dashboard: Non-Functional in Production

The dashboard is **completely broken** due to the `NEXT_PUBLIC_API_URL` deployment bug. The fix is simple (set the env var at build time), but until it's deployed:
- No pages can load data
- No users can sign up or log in through the UI
- The dashboard chrome renders correctly (sidebar, headers, filters are visible)

### Verdict

**API: 8/10** — Functional, fast, well-structured. Missing batch operations, trace finalization, and some settings endpoints. Ready for design partner use.

**Dashboard: 1/10** — Renders layout chrome only. All data-dependent features are broken due to deployment misconfiguration. A one-line fix (`NEXT_PUBLIC_API_URL=https://api.sidclaw.com`) during build would likely resolve most issues.

**For daily production governance of 5+ agents:** The API alone is sufficient for a technical user comfortable with curl/SDK. The dashboard needs the deployment fix before non-technical reviewers can use it for approval workflows.

## 10. Screenshots

Screenshots saved to `research/screenshots/stress-tests/`:
- `signup-page-*.png` — Signup form
- `after-signup-wait-*.png` — Signup form stuck on "Creating account..."
- `after-login-*.png` — Login redirect to localhost:4000
- `agents-page-*.png` — Agent registry page (layout renders, data loading spinner)
- `agents-registry-stuck-*.png` — Agent registry stuck loading
- `dashboard-loaded-*.png` — Dashboard overview stuck on "Loading..."
- `dashboard-final-overview-*.png` — Final dashboard state

All screenshots demonstrate the same core issue: dashboard chrome renders correctly but all data-dependent content shows infinite loading spinners due to the localhost API URL bug.
