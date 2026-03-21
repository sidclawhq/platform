# @agent-identity/sdk

Governance for AI agents. Identity, policy, approval, and audit.

## Quick Start

### 1. Install

```bash
npm install @agent-identity/sdk
```

### 2. Initialize

```typescript
import { AgentIdentityClient } from '@agent-identity/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.AGENT_IDENTITY_API_KEY,
  apiUrl: 'https://api.agentidentity.dev',
  agentId: 'your-agent-id',
});
```

### 3. Govern your agent's actions

```typescript
import { withGovernance } from '@agent-identity/sdk';

const sendEmail = withGovernance(client, {
  operation: 'send_email',
  target_integration: 'email_service',
  resource_scope: 'customer_emails',
  data_classification: 'confidential',
}, async (to, subject, body) => {
  // your actual send logic
});

await sendEmail('customer@example.com', 'Follow-up', '...');
// If policy says "approval_required", this waits for a human to approve
// If policy says "deny", this throws ActionDeniedError
// If policy says "allow", this executes immediately
```

## Integrations

### MCP Governance Server

Wrap any MCP server with governance — intercepts tool calls automatically.

```typescript
import { AgentIdentityClient, GovernanceMCPServer } from '@agent-identity/sdk';

const server = new GovernanceMCPServer({
  client,
  upstream: { transport: 'stdio', command: 'npx', args: ['your-mcp-server'] },
  toolMappings: [
    { toolName: 'query', data_classification: 'confidential' },
    { toolName: 'list_tables', skip_governance: true },
  ],
});
await server.start();
```

### LangChain.js

```typescript
import { governTools } from '@agent-identity/sdk/langchain';

const governedTools = governTools(myTools, { client });
```

### Vercel AI SDK

```typescript
import { governVercelTool } from '@agent-identity/sdk/vercel-ai';

const governedTool = governVercelTool('myTool', myTool, { client });
```

### OpenAI Agents SDK

```typescript
import { governOpenAITool } from '@agent-identity/sdk/openai-agents';

const governedTool = governOpenAITool(myTool, { client });
```

### Webhook Verification

```typescript
import { verifyWebhookSignature } from '@agent-identity/sdk/webhooks';

const isValid = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
```

## Error Handling

```typescript
import { ActionDeniedError, ApprovalTimeoutError } from '@agent-identity/sdk';

try {
  await governedAction();
} catch (error) {
  if (error instanceof ActionDeniedError) {
    console.log('Denied:', error.reason, 'Trace:', error.traceId);
  }
}
```

## License

Apache 2.0
