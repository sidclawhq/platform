# Task: End-to-End LangChain Example Verification

## Why This Matters

This is the single most important test we haven't done. The entire product promise is: "install the SDK, wrap your LangChain tools, governance just works." If the `examples/langchain-customer-support` example doesn't actually run end-to-end against the real API, the product doesn't work as advertised.

**Test against the live production API at `api.sidclaw.com`.** Also test against the local API for development scenarios.

## What To Do

### Step 1: Set Up the Example (Fresh Install)

Simulate a real developer experience — install from npm, not from the monorepo workspace:

```bash
# Create a clean directory OUTSIDE the monorepo
mkdir -p /tmp/sidclaw-langchain-test && cd /tmp/sidclaw-langchain-test
npm init -y

# Install from npm (the published package)
npm install @sidclaw/sdk
npm install @langchain/core
npm install zod
npm install tsx --save-dev

# Verify the install
node -e "const { AgentIdentityClient } = require('@sidclaw/sdk'); console.log('SDK:', typeof AgentIdentityClient);"
node -e "const { governTools } = require('@sidclaw/sdk/langchain'); console.log('governTools:', typeof governTools);"
node -e "const { tool } = require('@langchain/core/tools'); console.log('LangChain tool:', typeof tool);"
```

If any of these fail, **stop and report the failure**. This is a critical blocker.

### Step 2: Create the Tools (Copy from Example)

Copy the tools, seed script, and main script from the example directory:

```bash
cp /Users/vlpetrov/Documents/Programming/agent-identity/examples/langchain-customer-support/tools.ts .
cp /Users/vlpetrov/Documents/Programming/agent-identity/examples/langchain-customer-support/seed.ts .
cp /Users/vlpetrov/Documents/Programming/agent-identity/examples/langchain-customer-support/index.ts .
```

### Step 3: Sign Up and Get Credentials

**Option A — Use live production:**

1. Open `https://app.sidclaw.com/signup` in a browser (or use the Playwright MCP tools)
2. Sign up with a new email: `langchain-test@sidclaw.com` / `LCTest2026!`
3. Go to Settings > API Keys and create a key with scopes: `evaluate`, `traces:read`, `traces:write`, `approvals:read`, `agents:read`
4. Copy the raw key

**Option B — Use local development:**

1. Ensure the API is running at `localhost:4000`
2. Use the dev API key from `deployment/.env.development`

Set environment variables:

```bash
export SIDCLAW_API_KEY="<the key>"
export SIDCLAW_API_URL="https://api.sidclaw.com"  # or http://localhost:4000
```

### Step 4: Seed the Agent and Policies

```bash
npx tsx seed.ts
```

**Expected output:**
```
Seeding SidClaw platform at https://api.sidclaw.com...

Created agent: <uuid> (Customer Support Agent)
Created 3 policies:
  - allow: knowledge base searches
  - approval_required: customer email sending
  - deny: customer data exports

Agent ID for your .env: <uuid>
```

**If this fails:**
- Check the error message carefully
- Common issues: API key scopes insufficient (need admin or a key that can create agents/policies), CSRF issues (SDK should use Bearer auth not session), network errors
- **Report the exact error**

Set the agent ID:

```bash
export AGENT_ID="<the uuid from output>"
```

### Step 5: Test Scenario 1 — Allow (Knowledge Base Search)

```bash
npx tsx index.ts "What is the refund policy?"
```

**Expected behavior:**
1. The governed tool calls `client.evaluate()` with operation=`search_knowledge_base`
2. The policy engine matches the "allow" rule
3. The tool executes immediately
4. The result is printed: refund policy text from the mock knowledge base
5. The outcome is recorded

**Expected output (approximately):**
```
────────────────────────────────────────────────────────────
  SidClaw Governed Customer Support Agent
────────────────────────────────────────────────────────────
  Query: "What is the refund policy?"

  Routed to tool: search_knowledge_base
  Input: {"query":"What is the refund policy?"}

  Evaluating governance policy...

  Result: Refund Policy: Full refund within 30 days of purchase...

  Check the dashboard at http://localhost:3000/dashboard/audit to see the trace.

────────────────────────────────────────────────────────────
```

**If this fails:** Report the exact error. Common issues:
- `governTools()` may not properly wrap LangChain `tool()` output
- The `invoke()` method signature may not match what LangChain expects
- The SDK may fail to connect to the API
- The policy engine may not match the rule (resource_scope or operation mismatch)

### Step 6: Test Scenario 2 — Deny (PII Export)

```bash
npx tsx index.ts "Export all data for customer-123"
```

**Expected behavior:**
1. The governed tool calls `client.evaluate()` with operation=`export_customer_data`
2. The policy engine matches the "deny" rule
3. `ActionDeniedError` is thrown BEFORE the tool executes
4. The error is caught and printed

**Expected output:**
```
  Routed to tool: export_customer_data

  Evaluating governance policy...

  BLOCKED: Bulk PII export is prohibited by data protection policy...
  Trace ID: <uuid>

  The policy engine denied this action. See the trace in the dashboard.
```

**Critical verification:** The mock export function (`"Exported data for customer..."`) must NOT execute. If you see its output, governance failed to block the action.

### Step 7: Test Scenario 3 — Approval Required (Send Email)

```bash
npx tsx index.ts "Send a follow-up email to alice@example.com"
```

**Expected behavior:**
1. The governed tool calls `client.evaluate()` with operation=`send_email_to_customer`
2. The policy engine matches the "approval_required" rule
3. `ActionDeniedError` is thrown with the approval request ID in the message
4. The tool does NOT execute (no email sent)

**Expected output:**
```
  Routed to tool: send_email_to_customer

  Evaluating governance policy...

  BLOCKED: Approval required: Outbound customer communications must be reviewed...
  Trace ID: <uuid>
```

**Then — verify the approval appears in the dashboard:**
1. Open `https://app.sidclaw.com/dashboard/approvals` (or `localhost:3000`) using Playwright
2. Verify a pending approval card exists for `send_email_to_customer`
3. Click the card — verify the detail shows:
   - Operation: send_email_to_customer
   - "Why This Was Flagged": the policy rationale
   - Context: the input data (to, subject, body)
4. Take a screenshot of the approval card

### Step 8: Approve and Retry

1. In the dashboard, approve the pending request with note: "Verified email content is appropriate"
2. Run the same command again:

```bash
npx tsx index.ts "Send a follow-up email to alice@example.com"
```

**Expected:** This creates a NEW evaluation. Since the policy is still `approval_required`, it will be blocked again (each evaluation is independent). This is correct behavior — approval is per-action, not per-policy.

**Note:** The example uses a simple keyword router, not a real LLM. The `governTools()` wrapper works the same way regardless — it intercepts `invoke()` calls. In a real LLM-driven agent, the LLM would choose which tool to call, and governance would intercept it identically.

### Step 9: Verify Traces in Dashboard

1. Open the trace viewer at `https://app.sidclaw.com/dashboard/audit` (or localhost)
2. Verify you see 3 traces (one for each scenario):
   - search_knowledge_base → outcome: executed (or completed)
   - export_customer_data → outcome: blocked
   - send_email_to_customer → outcome: in_progress (or denied if the approval was denied)
3. Click the "allow" trace — verify the event timeline shows:
   - trace_initiated → identity_resolved → policy_evaluated → operation_allowed → operation_executed → trace_closed
4. Click the "deny" trace — verify:
   - trace_initiated → identity_resolved → policy_evaluated → sensitive_operation_detected → operation_denied → trace_closed
5. Take screenshots of each trace timeline

### Step 10: Test Against Local API (If Step 5-9 Used Production)

If you tested against `api.sidclaw.com`, also test against `localhost:4000` to verify the local development workflow:

```bash
export SIDCLAW_API_URL="http://localhost:4000"
# Use the local dev API key
export SIDCLAW_API_KEY="<key from deployment/.env.development>"

# You'll need to seed again against the local API
npx tsx seed.ts
export AGENT_ID="<new agent id>"

npx tsx index.ts "What is the refund policy?"
npx tsx index.ts "Export all data for customer-123"
npx tsx index.ts "Send a follow-up email to alice@example.com"
```

All 3 should produce the same behavior as against production.

### Step 11: Test the MCP Example Too (If Time Allows)

The MCP postgres example (`examples/mcp-postgres-governed`) is the other critical example. If time allows:

```bash
cd /Users/vlpetrov/Documents/Programming/agent-identity/examples/mcp-postgres-governed
docker compose up -d  # start the example postgres
SIDCLAW_API_KEY=<key> npx tsx seed.ts  # seed agent + policies
SIDCLAW_API_KEY=<key> DATABASE_URL=postgresql://example:example@localhost:5434/example npx tsx index.ts
```

This should start the governance MCP server. You can't easily test the MCP protocol without an MCP client, but verify:
- The server starts without errors
- It connects to the upstream MCP server
- Console output indicates it's ready

### Step 12: Fix Any Issues Found

If any of the above fails, **fix the issue**. Common problems to look for:

1. **`governTools()` wrapper breaks LangChain `tool()` output** — the `Object.create(Object.getPrototypeOf(tool))` pattern in `langchain.ts` may not correctly clone LangChain's tool objects. May need to use `DynamicTool` or `DynamicStructuredTool` instead.

2. **Schema/type mismatch** — LangChain tools expect `invoke(input)` where input matches the Zod schema. The governance wrapper passes the input to `client.evaluate()` as context — but the original `invoke()` must receive the correctly-typed input.

3. **Import path issues** — `@sidclaw/sdk/langchain` may not resolve correctly from the npm-installed package (CJS vs ESM, subpath exports).

4. **API response shape mismatch** — the SDK expects `{ decision, trace_id, ... }` but the API may return a slightly different shape.

5. **Policy matching** — the seed script sets `target_integration` to the tool name (e.g., `search_knowledge_base`). The `governTools()` wrapper also uses `tool.name` as `target_integration`. If these don't match exactly, no policy will match and the default deny kicks in.

**If you fix something in the SDK (`packages/sdk/`) or example code, also update the npm-published package if needed.** Run `npm run build` in `packages/sdk/` after any changes.

## Deliverable

Write a report to `research/stress-tests/e2e-langchain-verification.md` with:

1. **npm install test**: Did `@sidclaw/sdk` and `@sidclaw/sdk/langchain` install and import correctly from npm?
2. **Seed script**: Did agent + 3 policies create successfully?
3. **Scenario 1 (allow)**: Did the knowledge base search execute and return results? Full output.
4. **Scenario 2 (deny)**: Was the export blocked? Did `ActionDeniedError` fire BEFORE the tool executed?
5. **Scenario 3 (approval_required)**: Was the email blocked? Did the approval appear in the dashboard? Screenshot.
6. **Dashboard verification**: Did traces appear with correct event timelines? Screenshots.
7. **Local vs production**: Did both work?
8. **Bugs fixed**: What broke and how was it fixed?
9. **Developer experience grade** (A-F): How smooth was the npm install → seed → run → see results flow?
10. **Verdict**: Does the product work as advertised? Can we honestly tell developers "install the SDK, wrap your tools, governance just works"?

Save screenshots to `research/screenshots/langchain-verification/`.

## Cleanup

```bash
rm -rf /tmp/sidclaw-langchain-test
```
