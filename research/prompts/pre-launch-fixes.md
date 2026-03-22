# Task: Pre-Launch Critical Fixes

## Context

Pre-launch testing found 3 critical blockers and 6 medium/low issues. Fix all of them. Read the full test reports for details:

- `research/stress-tests/pre-launch-test-4-demos-docs.md` — demo API failures, localhost leak
- `research/stress-tests/pre-launch-test-5-sdk-npm.md` — missing MCP binary in npm package
- `research/stress-tests/pre-launch-test-1-signup-billing.md` — trace status, onboarding checklist

---

## CRITICAL 1: Demo API Backends Broken

### Atlas Financial Demo (`apps/demo`)

**Problem:** `POST /api/chat` returns 500 on every request. The chat is completely non-functional.

**Debug steps:**
1. Check `apps/demo/src/app/api/chat/route.ts`
2. Start the demo locally: `cd apps/demo && npm run dev`
3. Open `http://localhost:3003` and try the chat
4. Check the terminal for the actual error stack trace
5. Common causes:
   - `ANTHROPIC_API_KEY` not set in Railway environment
   - Wrong import paths after SDK changes
   - Missing dependency (`ai`, `@ai-sdk/anthropic`, `@langchain/anthropic`)
   - The demo session setup (`/api/setup`) failing silently, so the chat has no agent/policies
6. Fix the root cause

**Also check:** Does the `/api/setup` endpoint work? Does it create a demo agent and policies? The chat depends on a valid session with an agent ID and API key.

### DevOps Demo (`apps/demo-devops`)

**Problem:** `POST /api/agent-action` returns 400 on all governance buttons. Buttons stuck on "Evaluating..."

**Debug steps:**
1. Check `apps/demo-devops/src/app/api/agent-action/route.ts`
2. Start locally and try clicking a governance button
3. Check what request body the frontend sends vs what the API expects
4. Common causes:
   - Request body schema mismatch (frontend sends different fields than API expects)
   - Missing `agent_id` or wrong agent ID (session setup may have failed)
   - SidClaw API returning an error that isn't being surfaced
5. Fix the root cause

### Healthcare Demo (`apps/demo-healthcare`)

**Problem:** Same as DevOps — `POST /api/agent-action` returns 400.

**Debug steps:** Same as DevOps demo. The two demos likely share the same API route pattern, so the fix may be similar.

### Verification

After fixing, test each demo:
```bash
# Start each demo locally
cd apps/demo && npm run dev          # port 3003
cd apps/demo-devops && npm run dev   # port 3004 or similar
cd apps/demo-healthcare && npm run dev # port 3005 or similar

# Test Atlas: type a message in the chat, verify response
# Test DevOps: click a governance button, verify it evaluates
# Test Healthcare: click a governance button, verify it evaluates
```

---

## CRITICAL 2: Localhost URLs Leaked into Production Demos

**Problem:** DevOps and Healthcare demos have hardcoded `http://localhost:3000/dashboard` links. In production, these should point to `https://app.sidclaw.com/dashboard`.

**Fix:** Search all demo apps for `localhost`:

```bash
grep -r "localhost" apps/demo-devops/src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
grep -r "localhost" apps/demo-healthcare/src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
grep -r "localhost" apps/demo/src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Replace all hardcoded localhost URLs with either:
- Environment variable: `process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://app.sidclaw.com'`
- Or just hardcode `https://app.sidclaw.com` (simpler, since these are always production demos)

**Specific patterns to find and fix:**
- `http://localhost:3000/dashboard` → `https://app.sidclaw.com/dashboard`
- `http://localhost:3000` → `https://app.sidclaw.com`
- `http://localhost:4000` → `https://api.sidclaw.com` (for API URLs that should be production)

**But keep:** Any `process.env.SIDCLAW_API_URL ?? 'http://localhost:4000'` patterns — those correctly default to localhost for local dev and use env vars in production. Just verify the Railway env vars are set correctly.

---

## CRITICAL 3: MCP Proxy Binary Not in Published npm Package

**Problem:** The `bin` field is missing from `packages/sdk/package.json`. Users cannot run `npx sidclaw-mcp-proxy`.

**Fix:**

1. Check if `packages/sdk/bin/sidclaw-mcp-proxy.cjs` exists:
```bash
ls -la packages/sdk/bin/
cat packages/sdk/bin/sidclaw-mcp-proxy.cjs
```

2. Check if the bin entry point is built:
```bash
ls -la packages/sdk/dist/bin/
```

3. Add `bin` field to `packages/sdk/package.json` if missing:
```json
{
  "bin": {
    "sidclaw-mcp-proxy": "./bin/sidclaw-mcp-proxy.cjs"
  }
}
```

4. Ensure `"bin"` directory is in the `files` array:
```json
{
  "files": ["dist", "bin", "README.md", "LICENSE", "CHANGELOG.md"]
}
```

5. Verify the bin entry is in `tsup.config.ts`:
```bash
grep -n "sidclaw-mcp-proxy" packages/sdk/tsup.config.ts
```
If not, add `'bin/sidclaw-mcp-proxy': 'src/bin/sidclaw-mcp-proxy.ts'` to the entry object.

6. Build and verify:
```bash
cd packages/sdk
npm run build
node bin/sidclaw-mcp-proxy.cjs 2>&1 | head -3
# Should show: "Error: SIDCLAW_API_KEY is required"

npm pack --dry-run 2>&1 | grep bin
# Should show bin/sidclaw-mcp-proxy.cjs in the file list
```

7. **Do NOT publish to npm yet** — just ensure the package is correct locally. The user will publish manually.

---

## MEDIUM 4: Trace Status Not Updated After Approval (List View)

**Problem:** After approving a request in the dashboard, the trace list still shows "In Progress" instead of updating to "Completed with Approval" or similar.

**Root cause:** The trace's `final_outcome` stays as `in_progress` after approval because the agent hasn't called `recordOutcome()` yet. This is technically correct behavior — but confusing for dashboard-only workflows where approval IS the final action.

**Fix option A (recommended):** In the approval queue, after approving, add a note to the trace list item: "Approved — awaiting agent execution" to make it clear the trace isn't stuck.

**Fix option B:** When approving from the dashboard in a demo context, automatically call `recordOutcome` to finalize the trace. This is a UX improvement specific to the dashboard.

**Check:** Look at `apps/dashboard/src/components/approvals/ApprovalReviewerAction.tsx` or wherever the approve button handler is. After the approval API call succeeds, does it trigger a trace list refresh? The trace list might just need to re-fetch.

---

## MEDIUM 5: MCP Sub-Path Crash Without Helpful Error

**Problem:** `require('@sidclaw/sdk/mcp')` crashes with raw `MODULE_NOT_FOUND` instead of a helpful message about installing `@modelcontextprotocol/sdk`.

**Fix:** In `packages/sdk/src/mcp/index.ts`, wrap the MCP SDK import in a try-catch:

```typescript
let GovernanceMCPServer: any;
try {
  // Dynamic import to provide better error message
  const module = await import('./governance-server.js');
  GovernanceMCPServer = module.GovernanceMCPServer;
} catch (error) {
  // This will be caught at runtime, not at import time
  // The better approach is to catch at the point of use
}
```

Actually, since this is a build-time issue (tsup bundles the import), the better fix is to add `@modelcontextprotocol/sdk` as an optional peer dependency AND add a runtime check in the GovernanceMCPServer constructor:

```typescript
// In governance-server.ts, at the top:
try {
  require.resolve('@modelcontextprotocol/sdk');
} catch {
  throw new Error(
    '@modelcontextprotocol/sdk is required for MCP governance. Install it: npm install @modelcontextprotocol/sdk'
  );
}
```

Or check if this is already handled and the issue is something else (check the actual error from Test 5).

---

## MEDIUM 6: FINMA Compliance Page Missing

**Problem:** Swiss market pricing (CHF) is set but no FINMA compliance mapping page exists in docs.

**Fix:** Create `apps/docs/content/docs/compliance/finma.mdx`:

```markdown
---
title: FINMA Compliance
description: How SidClaw addresses FINMA requirements for AI agent governance in Swiss financial services
---

# FINMA Compliance Mapping

Switzerland's Financial Market Supervisory Authority (FINMA) sets strict requirements for operational risk management and outsourcing that apply to AI agents in Swiss financial institutions.

## FINMA Circular 2023/1 — Operational Risk and Resilience

**FINMA requires:** Institutions must identify, assess, and manage operational risks including those from automated systems and third-party services.

**SidClaw provides:**
- **Agent Registry** — every AI agent is registered as a governed entity with defined scope and ownership
- **Policy Engine** — explicit rules governing what each agent can and cannot do
- **Audit Trails** — complete logging of every agent action and decision

## FINMA Circular 2018/3 — Outsourcing

**FINMA requires:** When delegating functions to automated systems or third parties, institutions must maintain oversight, control, and audit capability.

**SidClaw provides:**
- **Human Oversight** — the Approval primitive ensures high-risk agent actions require human review
- **Delegation Tracking** — agent authority models (self, delegated, hybrid) document the delegation chain
- **Separation of Duties** — agent owners cannot approve their own agent's requests

## FINMA Guidance on AI/ML (2024)

**FINMA guidance:** Financial institutions using AI must ensure explainability, accountability, and human oversight for material decisions.

**SidClaw provides:**
- **Explainability** — every policy decision includes a documented rationale explaining WHY the action was allowed, flagged, or denied
- **Accountability** — every approval records who approved, when, and with what justification
- **Context Cards** — reviewers see the agent's reasoning, risk classification, and relevant policy before deciding

## Cross-Border Considerations

Swiss institutions subject to both FINMA and EU AI Act requirements can use SidClaw's compliance documentation to demonstrate governance across both regulatory frameworks. See also:
- [EU AI Act Compliance](/docs/compliance/eu-ai-act)
- [FINRA 2026 Compliance](/docs/compliance/finra-2026)
- [NIST AI RMF](/docs/compliance/nist-ai-rmf)
```

Also add FINMA to the standards section on the landing page if not already there. Check `apps/landing/src/components/standards.tsx`.

---

## LOW 7: Onboarding Checklist Doesn't Track Progress

**Problem:** After completing steps (creating agent, policy, etc.), the checklist still shows "0 of 5 steps complete."

**Fix:** Check if the onboarding API endpoint (`PATCH /api/v1/tenant/onboarding`) is being called from the dashboard when steps are completed. If the endpoints exist but aren't being called:

- After creating an agent → call `PATCH /api/v1/tenant/onboarding` with `{ register_agent: true }`
- After creating a policy → `{ create_policy: true }`
- After first trace appears in audit → `{ run_evaluation: true }`
- After visiting audit page → `{ see_trace: true }`

If the auto-detection approach from the onboarding component is supposed to handle this (by checking counts), verify that the component re-fetches onboarding state after navigation.

---

## LOW 8: SDK README Missing OpenClaw References

**Fix:** Check `packages/sdk/README.md` for an OpenClaw section. If missing, add:

```markdown
### OpenClaw

Add governance to any OpenClaw MCP server with one config change:

\`\`\`json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@sidclaw/sdk", "mcp-proxy"],
      "env": {
        "SIDCLAW_API_KEY": "ai_...",
        "SIDCLAW_AGENT_ID": "agent-...",
        "SIDCLAW_UPSTREAM_CMD": "npx",
        "SIDCLAW_UPSTREAM_ARGS": "-y,@modelcontextprotocol/server-postgres,postgresql://..."
      }
    }
  }
}
\`\`\`

See the [OpenClaw integration guide](https://docs.sidclaw.com/docs/integrations/openclaw) for full setup.
```

---

## LOW 9: CHANGELOG Outdated

**Fix:** Update `packages/sdk/CHANGELOG.md`:

```markdown
# Changelog

## 0.1.1

- Add MCP governance proxy CLI (`sidclaw-mcp-proxy`)
- Add OpenClaw skill and integration
- Add framework wrappers: OpenAI Agents SDK, CrewAI
- Fix 429 retry test timeout

## 0.1.0

Initial release.

- `AgentIdentityClient` — evaluate actions, wait for approval, record outcomes
- `withGovernance()` — higher-order function wrapper
- `GovernanceMCPServer` — MCP governance proxy
- Framework wrappers: LangChain, Vercel AI
- `verifyWebhookSignature()` — webhook payload verification
```

---

## Verification After All Fixes

```bash
# 1. Build everything
turbo build

# 2. Run tests
turbo test

# 3. Start demos locally and verify each works
cd apps/demo && npm run dev           # Test chat
cd apps/demo-devops && npm run dev    # Test governance buttons
cd apps/demo-healthcare && npm run dev # Test governance buttons

# 4. Verify no localhost leaks in demo source
grep -r "localhost:3000" apps/demo*/src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v "??" | grep -v "process.env"
# Should return zero results

# 5. Verify SDK bin works
cd packages/sdk
npm run build
node bin/sidclaw-mcp-proxy.cjs 2>&1 | head -3
npm pack --dry-run 2>&1 | grep bin

# 6. Verify FINMA page
ls apps/docs/content/docs/compliance/finma.mdx

# 7. Check SDK README for OpenClaw
grep -i "openclaw" packages/sdk/README.md
```

## Acceptance Criteria

- [ ] Atlas Financial demo chat works (messages get responses, governance panel shows events)
- [ ] DevOps demo governance buttons work (evaluations succeed, approval cards appear)
- [ ] Healthcare demo governance buttons work
- [ ] No `localhost:3000` hardcoded in demo source (only env var defaults)
- [ ] SDK `bin` field present in package.json, `npm pack --dry-run` includes bin/
- [ ] `node bin/sidclaw-mcp-proxy.cjs` shows "SIDCLAW_API_KEY is required" error
- [ ] FINMA compliance page exists in docs
- [ ] SDK README mentions OpenClaw
- [ ] CHANGELOG updated
- [ ] MCP import gives helpful error when `@modelcontextprotocol/sdk` is missing
- [ ] `turbo build` succeeds
- [ ] `turbo test` passes
