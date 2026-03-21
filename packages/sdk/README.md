# @sidclaw/sdk

[![npm version](https://img.shields.io/npm/v/@sidclaw/sdk)](https://www.npmjs.com/package/@sidclaw/sdk)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/sidclawhq/sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/sidclawhq/sdk/actions)

Governance for AI agents. Identity, policy, approval, and audit.

[Documentation](https://docs.sidclaw.com) · [Quick Start](https://docs.sidclaw.com/docs/quickstart) · [Examples](https://github.com/sidclawhq/sdk/tree/main/examples)

## Quick Start

### 1. Install

```bash
npm install @sidclaw/sdk
```

### 2. Initialize

```typescript
import { AgentIdentityClient } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.AGENT_IDENTITY_API_KEY,
  apiUrl: 'https://api.sidclaw.com',
  agentId: 'your-agent-id',
});
```

### 3. Govern your agent's actions

```typescript
import { withGovernance } from '@sidclaw/sdk';

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
import { AgentIdentityClient, GovernanceMCPServer } from '@sidclaw/sdk';

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
import { governTools } from '@sidclaw/sdk/langchain';

const governedTools = governTools(myTools, { client });
```

### Vercel AI SDK

```typescript
import { governVercelTool } from '@sidclaw/sdk/vercel-ai';

const governedTool = governVercelTool('myTool', myTool, { client });
```

### OpenAI Agents SDK

```typescript
import { governOpenAITool } from '@sidclaw/sdk/openai-agents';

const governedTool = governOpenAITool(myTool, { client });
```

### Webhook Verification

```typescript
import { verifyWebhookSignature } from '@sidclaw/sdk/webhooks';

const isValid = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
```

## Error Handling

```typescript
import { ActionDeniedError, ApprovalTimeoutError } from '@sidclaw/sdk';

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
