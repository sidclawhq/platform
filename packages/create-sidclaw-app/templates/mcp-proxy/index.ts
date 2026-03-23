/**
 * {{projectName}} — MCP Governance Proxy
 *
 * This proxy wraps an upstream MCP server and adds SidClaw governance
 * to all tool calls. Tools are mapped to governance policies:
 *
 *   search_docs  → Allowed instantly (safe read operation)
 *   send_email   → Requires human approval
 *   export_data  → Blocked by policy (data protection)
 *
 * Usage in Claude Desktop / MCP client config:
 *   {
 *     "mcpServers": {
 *       "my-governed-server": {
 *         "command": "npx",
 *         "args": ["tsx", "index.ts"],
 *         "env": { ... }
 *       }
 *     }
 *   }
 *
 * Dashboard: https://app.sidclaw.com/dashboard/approvals
 */

import 'dotenv/config';
import { AgentIdentityClient } from '@sidclaw/sdk';
import { GovernanceMCPServer } from '@sidclaw/sdk/mcp';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: process.env.SIDCLAW_API_URL ?? 'https://api.sidclaw.com',
  agentId: process.env.SIDCLAW_AGENT_ID!,
});

const server = new GovernanceMCPServer({
  client,
  upstream: {
    transport: 'stdio',
    command: process.env.UPSTREAM_MCP_COMMAND ?? 'echo',
    args: process.env.UPSTREAM_MCP_ARGS?.split(' ') ?? ['No upstream configured'],
  },
  toolMappings: [
    {
      toolName: 'search_*',
      target_integration: 'knowledge_base',
      resource_scope: 'docs',
      data_classification: 'internal',
    },
    {
      toolName: 'send_*',
      target_integration: 'email_service',
      resource_scope: 'emails',
      data_classification: 'confidential',
    },
    {
      toolName: 'export_*',
      target_integration: 'data_store',
      resource_scope: 'records',
      data_classification: 'restricted',
    },
  ],
  defaultDataClassification: 'internal',
  approvalWaitMode: 'error',
});

server.start().then(() => {
  console.error('MCP Governance Proxy started');
}).catch((err) => {
  console.error('Failed to start MCP Governance Proxy:', err);
  process.exit(1);
});
