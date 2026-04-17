/**
 * OpenAI Agents SDK × SidClaw Governance — minimal runnable example.
 *
 * Shows how `governOpenAITool` wraps each tool with a policy check.
 */

import 'dotenv/config';
import { Agent, tool, run } from '@openai/agents';
import { AgentIdentityClient } from '@sidclaw/sdk';
import { governOpenAITool } from '@sidclaw/sdk/openai-agents';
import { z } from 'zod';

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const client = new AgentIdentityClient({
  apiKey: assertEnv('SIDCLAW_API_KEY'),
  apiUrl: process.env.SIDCLAW_BASE_URL ?? 'https://api.sidclaw.com',
  agentId: assertEnv('SIDCLAW_AGENT_ID'),
});

// Low-risk read tool — policies likely to allow
const searchKnowledgeBase = governOpenAITool(
  client,
  {
    operation: 'search_knowledge_base',
    target_integration: 'docs',
    resource_scope: 'public_docs',
    data_classification: 'public',
  },
  tool({
    name: 'search_knowledge_base',
    description: 'Search the internal knowledge base',
    parameters: z.object({ query: z.string() }),
    execute: async (args) => {
      return `Top 3 results for "${args.query}": ...`;
    },
  }),
);

// Medium-risk write tool — likely to require approval
const sendEmail = governOpenAITool(
  client,
  {
    operation: 'send_email',
    target_integration: 'email_service',
    resource_scope: 'customer_emails',
    data_classification: 'confidential',
  },
  tool({
    name: 'send_email',
    description: 'Send an email to a customer',
    parameters: z.object({
      to: z.string(),
      subject: z.string(),
      body: z.string(),
    }),
    execute: async (args) => {
      console.log(`[mock email_service] Sent to ${args.to}: ${args.subject}`);
      return `Email sent to ${args.to}`;
    },
  }),
);

// High-risk destructive tool — almost always denied by policy
const deleteAccount = governOpenAITool(
  client,
  {
    operation: 'delete_account',
    target_integration: 'crm',
    resource_scope: 'customer_records',
    data_classification: 'restricted',
  },
  tool({
    name: 'delete_account',
    description: 'Permanently delete a customer account',
    parameters: z.object({ account_id: z.string() }),
    execute: async (args) => {
      console.log(`[mock crm] Deleted account ${args.account_id}`);
      return `Deleted ${args.account_id}`;
    },
  }),
);

const agent = new Agent({
  name: 'Customer Support',
  instructions:
    'You are a helpful customer support agent. Use the tools you have to answer questions, reply to customers, or resolve account issues. Always start with a knowledge base search.',
  tools: [searchKnowledgeBase, sendEmail, deleteAccount],
});

async function main() {
  assertEnv('OPENAI_API_KEY');

  const result = await run(
    agent,
    'The customer asked to close their account. Send them a goodbye email and then delete the account.',
  );
  console.log('Agent result:', result.finalOutput);
}

main().catch((err) => {
  console.error('Run failed:', err.message);
  process.exitCode = 1;
});
