#!/usr/bin/env tsx
/**
 * LangChain Customer Support Agent with SidClaw Governance
 *
 * Demonstrates governing LangChain.js tools with governTools().
 * Three tools, three different policy outcomes:
 *   - search_knowledge_base  -> allowed (internal data, safe)
 *   - send_email_to_customer -> approval_required (outbound customer contact)
 *   - export_customer_data   -> denied (PII export prohibited)
 *
 * Usage:
 *   SIDCLAW_API_KEY=<key> npx tsx index.ts "What is the refund policy?"
 *   SIDCLAW_API_KEY=<key> npx tsx index.ts "Send a follow-up email to alice@example.com"
 *   SIDCLAW_API_KEY=<key> npx tsx index.ts "Export all data for customer-123"
 */

import { AgentIdentityClient } from '@sidclaw/sdk';
import { governTools } from '@sidclaw/sdk/langchain';
import { ActionDeniedError } from '@sidclaw/sdk';
import { allTools } from './tools.js';

const API_KEY = process.env.SIDCLAW_API_KEY;
const API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';
const AGENT_ID = process.env.AGENT_ID ?? 'support-agent';

if (!API_KEY) {
  console.error('Error: SIDCLAW_API_KEY environment variable is required.');
  console.error('Find it in deployment/.env.development (created by prisma db seed).');
  process.exit(1);
}

const query = process.argv[2];
if (!query) {
  console.error('Usage: npx tsx index.ts "<query>"');
  console.error('');
  console.error('Examples:');
  console.error('  npx tsx index.ts "What is the refund policy?"');
  console.error('  npx tsx index.ts "Send a follow-up email to alice@example.com"');
  console.error('  npx tsx index.ts "Export all data for customer-123"');
  process.exit(1);
}

const SEPARATOR = '\u2500'.repeat(60);

const client = new AgentIdentityClient({
  apiKey: API_KEY,
  apiUrl: API_URL,
  agentId: AGENT_ID,
});

// Wrap all tools with governance — each tool call will be evaluated against policies
const governedTools = governTools(allTools, {
  client,
  data_classification: 'confidential',
});

/**
 * Simple routing: pick a tool based on query keywords.
 * In a real app this would be done by an LLM (e.g., ChatOpenAI with tool binding).
 */
function routeQuery(q: string): { toolName: string; input: Record<string, unknown> } {
  const lower = q.toLowerCase();

  if (lower.includes('export') || lower.includes('download')) {
    return {
      toolName: 'export_customer_data',
      input: { customerId: 'customer-123', format: 'json' },
    };
  }

  if (lower.includes('email') || lower.includes('send') || lower.includes('follow-up')) {
    const emailMatch = q.match(/[\w.-]+@[\w.-]+/);
    return {
      toolName: 'send_email_to_customer',
      input: {
        to: emailMatch?.[0] ?? 'customer@example.com',
        subject: 'Follow-up from Support',
        body: `Hello! This is a follow-up regarding your recent inquiry: "${q}"`,
      },
    };
  }

  // Default to knowledge base search
  return {
    toolName: 'search_knowledge_base',
    input: { query: q },
  };
}

async function main() {
  console.log(`${SEPARATOR}`);
  console.log('  SidClaw Governed Customer Support Agent');
  console.log(`${SEPARATOR}`);
  console.log(`  Query: "${query}"`);
  console.log('');

  const route = routeQuery(query);
  const tool = governedTools.find((t) => t.name === route.toolName);

  if (!tool) {
    console.error(`Tool not found: ${route.toolName}`);
    process.exit(1);
  }

  console.log(`  Routed to tool: ${tool.name}`);
  console.log(`  Input: ${JSON.stringify(route.input)}`);
  console.log('');

  try {
    console.log('  Evaluating governance policy...');
    const result = await tool.invoke(route.input);
    console.log('');
    console.log(`  Result: ${result}`);
    console.log('');
    console.log('  Check the dashboard at http://localhost:3000/dashboard/audit to see the trace.');
  } catch (error) {
    if (error instanceof ActionDeniedError) {
      console.log('');
      console.log(`  BLOCKED: ${error.reason}`);
      console.log(`  Trace ID: ${error.traceId}`);
      console.log('');
      console.log('  The policy engine denied this action. See the trace in the dashboard:');
      console.log('  http://localhost:3000/dashboard/audit');
    } else {
      throw error;
    }
  }

  console.log(`\n${SEPARATOR}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
