# Stress Test 4: SDK Developer Experience

You are a developer who wants to integrate SidClaw into an existing AI agent project. Test the SDK against the live production API. Use terminal for SDK operations and Playwright MCP tools (mcp__playwright__*) for dashboard verification.

**Do NOT modify any code in the main repository. Work in a temporary directory.**

## Journey

### Step 1: Install the SDK

```bash
mkdir -p /tmp/sidclaw-sdk-test && cd /tmp/sidclaw-sdk-test
npm init -y
npm install @sidclaw/sdk
```

1. Does `npm install` succeed?
2. How large is the install? (`du -sh node_modules/@sidclaw`)
3. Check: `node -e "const { AgentIdentityClient } = require('@sidclaw/sdk'); console.log(typeof AgentIdentityClient);"`
4. Check all subpath exports:
```bash
node -e "const { governTool } = require('@sidclaw/sdk/langchain'); console.log('langchain:', typeof governTool);"
node -e "const { governVercelTool } = require('@sidclaw/sdk/vercel-ai'); console.log('vercel:', typeof governVercelTool);"
node -e "const { governOpenAITool } = require('@sidclaw/sdk/openai-agents'); console.log('openai:', typeof governOpenAITool);"
node -e "const { GovernanceMCPServer } = require('@sidclaw/sdk/mcp'); console.log('mcp:', typeof GovernanceMCPServer);"
node -e "const { verifyWebhookSignature } = require('@sidclaw/sdk/webhooks'); console.log('webhooks:', typeof verifyWebhookSignature);"
```

### Step 2: Sign Up and Get an API Key

1. Open `https://app.sidclaw.com/signup` in the browser via Playwright
2. Sign up with: `sdk-tester@sidclaw.com` / `SDKTest2026!`
3. Navigate to Settings > API Keys
4. Create a key with scopes: evaluate, traces:read, traces:write, approvals:read
5. Copy the raw key

### Step 3: Create an Agent and Policy via API

```bash
API_KEY="<the key from step 2>"

# Create an agent
curl -s -X POST https://api.sidclaw.com/api/v1/agents \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SDK Test Agent",
    "description": "Testing the SDK integration",
    "owner_name": "SDK Tester",
    "owner_role": "Developer",
    "team": "Engineering",
    "authority_model": "self",
    "identity_mode": "service_identity",
    "delegation_model": "self",
    "autonomy_tier": "low",
    "authorized_integrations": [
      {"name": "Test Service", "resource_scope": "test_data", "data_classification": "internal", "allowed_operations": ["read", "write"]}
    ],
    "created_by": "sdk-test"
  }'

# Note the agent ID

# Create an allow policy
curl -s -X POST https://api.sidclaw.com/api/v1/policies \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "<agent_id>",
    "policy_name": "Allow reads on test service",
    "operation": "read",
    "target_integration": "test_service",
    "resource_scope": "test_data",
    "data_classification": "internal",
    "policy_effect": "allow",
    "rationale": "Read access to test data is within the agent standard operational scope for development and testing purposes.",
    "priority": 100,
    "modified_by": "sdk-test"
  }'

# Create an approval_required policy
curl -s -X POST https://api.sidclaw.com/api/v1/policies \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "<agent_id>",
    "policy_name": "Require approval for writes",
    "operation": "write",
    "target_integration": "test_service",
    "resource_scope": "test_data",
    "data_classification": "confidential",
    "policy_effect": "approval_required",
    "rationale": "Write operations on test data require human review to verify data integrity during testing.",
    "priority": 100,
    "modified_by": "sdk-test"
  }'
```

### Step 4: Use the SDK Against Production

Create a test script:

```bash
cat > /tmp/sidclaw-sdk-test/test.mjs << 'EOF'
import { AgentIdentityClient, withGovernance, ActionDeniedError } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY,
  apiUrl: 'https://api.sidclaw.com',
  agentId: process.env.SIDCLAW_AGENT_ID,
});

console.log('=== Test 1: Allow path ===');
try {
  const result = await client.evaluate({
    operation: 'read',
    target_integration: 'test_service',
    resource_scope: 'test_data',
    data_classification: 'internal',
  });
  console.log('Decision:', result.decision);
  console.log('Trace ID:', result.trace_id);

  if (result.decision === 'allow') {
    await client.recordOutcome(result.trace_id, { status: 'success' });
    console.log('Outcome recorded ✓');
  }
} catch (e) {
  console.error('Error:', e.message);
}

console.log('\n=== Test 2: Approval required path ===');
try {
  const result = await client.evaluate({
    operation: 'write',
    target_integration: 'test_service',
    resource_scope: 'test_data',
    data_classification: 'confidential',
    context: { reason: 'Updating test records for integration test' },
  });
  console.log('Decision:', result.decision);
  console.log('Trace ID:', result.trace_id);
  console.log('Approval ID:', result.approval_request_id);

  if (result.decision === 'approval_required') {
    console.log('Approval required — check the dashboard at https://app.sidclaw.com/dashboard/approvals');
    console.log('Waiting 10 seconds for manual approval (will timeout)...');
    try {
      await client.waitForApproval(result.approval_request_id, { timeout: 10000 });
    } catch (e) {
      console.log('Timed out waiting (expected in automated test):', e.constructor.name);
    }
  }
} catch (e) {
  console.error('Error:', e.message);
}

console.log('\n=== Test 3: withGovernance wrapper ===');
const governedRead = withGovernance(client, {
  operation: 'read',
  target_integration: 'test_service',
  resource_scope: 'test_data',
  data_classification: 'internal',
}, async () => {
  console.log('  (executing governed function)');
  return { data: 'test result' };
});

try {
  const result = await governedRead();
  console.log('Governed result:', result);
  console.log('withGovernance works ✓');
} catch (e) {
  console.error('Error:', e.message);
}

console.log('\n=== Test 4: Error handling ===');
try {
  await client.evaluate({
    operation: 'invalid',
    target_integration: 'nonexistent',
    resource_scope: 'nothing',
    data_classification: 'restricted',
  });
  // This should either be denied by default or work — both are fine
  console.log('No error thrown');
} catch (e) {
  if (e instanceof ActionDeniedError) {
    console.log('ActionDeniedError caught:', e.reason);
    console.log('Trace ID:', e.traceId);
    console.log('Error handling works ✓');
  } else {
    console.log('Other error:', e.constructor.name, e.message);
  }
}

console.log('\nAll SDK tests complete!');
EOF

SIDCLAW_API_KEY="<key>" SIDCLAW_AGENT_ID="<agent_id>" node /tmp/sidclaw-sdk-test/test.mjs
```

### Step 5: Verify in Dashboard

1. Open `https://app.sidclaw.com` in the browser via Playwright (logged in as sdk-tester)
2. Navigate to Audit — verify the traces from the SDK tests appear
3. Navigate to Approvals — verify the approval request from Test 2 appears with context
4. Check the approval detail — does it show the context `{ reason: "Updating test records..." }`?
5. Approve the request from the dashboard
6. Take screenshots of: trace timeline, approval card, approved state

### Step 6: Webhook Verification

```bash
# Create a webhook endpoint (use a public webhook testing service)
curl -s -X POST https://api.sidclaw.com/api/v1/webhooks \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/<your-unique-id>",
    "events": ["approval.requested", "approval.approved"],
    "description": "SDK test webhook"
  }'
# Note the secret

# Trigger another evaluation that requires approval
# Then check webhook.site for the delivery
```

### Cleanup

```bash
rm -rf /tmp/sidclaw-sdk-test
```

## Deliverable

Write a report to `research/stress-tests/stress-test-4-sdk-developer.md` with:

1. **SDK Installation:** time, size, any issues
2. **All subpath exports:** which work, which fail
3. **API Integration:** evaluate, waitForApproval, recordOutcome, withGovernance — all working?
4. **Dashboard correlation:** do SDK-created traces/approvals appear correctly in the dashboard?
5. **Error handling:** are errors typed and informative?
6. **Developer experience grade** (A-F): how easy was it to go from `npm install` to first governed action?
7. **What would you improve** about the SDK DX?
8. **Screenshots** of: SDK test output, dashboard traces from SDK, approval card from SDK
