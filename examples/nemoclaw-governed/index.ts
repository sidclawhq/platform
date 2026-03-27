#!/usr/bin/env tsx
/**
 * NemoClaw + SidClaw Governance Demo (TypeScript)
 *
 * Demonstrates governing tool execution inside an NVIDIA NemoClaw sandbox
 * using SidClaw policies. Three tools, three different outcomes:
 *
 *   - search_docs   -> allowed (internal docs, safe read operation)
 *   - send_email    -> approval_required (outbound communication, needs review)
 *   - export_data   -> denied (restricted data, prohibited by policy)
 *
 * Usage:
 *   SIDCLAW_API_KEY=<key> SIDCLAW_AGENT_ID=<id> npx tsx index.ts
 */

import { AgentIdentityClient, ActionDeniedError } from '@sidclaw/sdk';
import { governNemoClawTools } from '@sidclaw/sdk/nemoclaw';
import type { NemoClawToolLike } from '@sidclaw/sdk/nemoclaw';

const API_KEY = process.env.SIDCLAW_API_KEY;
const API_URL = process.env.SIDCLAW_API_URL ?? 'https://api.sidclaw.com';
const AGENT_ID = process.env.SIDCLAW_AGENT_ID;

if (!API_KEY) {
  console.error('Error: SIDCLAW_API_KEY environment variable is required.');
  console.error('Find it in deployment/.env.development (created by prisma db seed).');
  process.exit(1);
}

if (!AGENT_ID) {
  console.error('Error: SIDCLAW_AGENT_ID environment variable is required.');
  console.error('Run "npm run seed" first and set the agent ID it prints.');
  process.exit(1);
}

const SEPARATOR = '\u2500'.repeat(60);

// ---------------------------------------------------------------------------
// Mock NemoClaw tools (simulating sandbox tool execution)
// ---------------------------------------------------------------------------

const searchDocsTool: NemoClawToolLike = {
  name: 'search_docs',
  description: 'Search internal documentation',
  execute: async (args: unknown) => {
    const params = args as { query: string };
    return `Found 3 results for "${params.query}": [Getting Started, API Reference, Troubleshooting]`;
  },
};

const sendEmailTool: NemoClawToolLike = {
  name: 'send_email',
  description: 'Send an email to a recipient',
  execute: async (args: unknown) => {
    const params = args as { to: string; subject: string; body: string };
    return `Email sent to ${params.to}: "${params.subject}"`;
  },
};

const exportDataTool: NemoClawToolLike = {
  name: 'export_data',
  description: 'Export user data in bulk',
  execute: async (args: unknown) => {
    const params = args as { format: string; userId: string };
    return `Exported data for ${params.userId} as ${params.format}`;
  },
};

// ---------------------------------------------------------------------------
// Main demo
// ---------------------------------------------------------------------------

const client = new AgentIdentityClient({
  apiKey: API_KEY,
  apiUrl: API_URL,
  agentId: AGENT_ID,
});

const governedTools = governNemoClawTools(client, [searchDocsTool, sendEmailTool, exportDataTool], {
  sandboxName: 'demo-sandbox',
  dataClassification: {
    search_docs: 'internal',
    send_email: 'confidential',
    export_data: 'restricted',
  },
});

interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
  description: string;
}

const toolCalls: ToolCall[] = [
  {
    toolName: 'search_docs',
    args: { query: 'deployment guide' },
    description: 'Search internal docs (should be ALLOWED)',
  },
  {
    toolName: 'send_email',
    args: { to: 'alice@example.com', subject: 'Follow-up', body: 'Hello from the sandbox agent!' },
    description: 'Send email (should require APPROVAL)',
  },
  {
    toolName: 'export_data',
    args: { format: 'csv', userId: 'user-42' },
    description: 'Export user data (should be DENIED)',
  },
];

async function main() {
  console.log(`${SEPARATOR}`);
  console.log('  NemoClaw + SidClaw Governance Demo');
  console.log(`${SEPARATOR}`);
  console.log(`  API:      ${API_URL}`);
  console.log(`  Agent:    ${AGENT_ID}`);
  console.log(`  Sandbox:  demo-sandbox`);
  console.log('');

  for (const call of toolCalls) {
    console.log(`${SEPARATOR}`);
    console.log(`  Tool: ${call.toolName}`);
    console.log(`  ${call.description}`);
    console.log(`  Input: ${JSON.stringify(call.args)}`);
    console.log('');

    const tool = governedTools.find((t) => t.name === call.toolName);
    if (!tool) {
      console.error(`  Tool not found: ${call.toolName}`);
      continue;
    }

    try {
      console.log('  Evaluating governance policy...');
      const result = await tool.execute!(call.args);
      console.log(`  ALLOWED - Result: ${result}`);
    } catch (error) {
      if (error instanceof ActionDeniedError) {
        const isApproval = error.reason.includes('Approval required');
        if (isApproval) {
          console.log(`  APPROVAL REQUIRED - ${error.reason}`);
          console.log(`  Trace ID: ${error.traceId}`);
          console.log(`  Review in dashboard: ${API_URL.replace('api.', 'app.')}/dashboard/approvals`);
        } else {
          console.log(`  DENIED - ${error.reason}`);
          console.log(`  Trace ID: ${error.traceId}`);
        }
      } else {
        throw error;
      }
    }

    console.log('');
  }

  console.log(`${SEPARATOR}`);
  console.log('  View all traces in the dashboard:');
  console.log(`  ${API_URL.replace('api.', 'app.')}/dashboard/audit`);
  console.log(`${SEPARATOR}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
