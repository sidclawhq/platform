import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { AgentIdentityClient } from '@sidclaw/sdk';
import { governVercelTools } from '@sidclaw/sdk/vercel-ai';

if (!process.env.SIDCLAW_AGENT_ID) {
  throw new Error(
    'SIDCLAW_AGENT_ID is not set in .env — create an agent at https://app.sidclaw.com/dashboard/agents and paste the ID into .env',
  );
}

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: process.env.SIDCLAW_API_URL ?? 'https://api.sidclaw.com',
  agentId: process.env.SIDCLAW_AGENT_ID,
});

const rawTools = {
  search_docs: {
    description: 'Search the internal knowledge base for documentation and policies.',
    parameters: z.object({ query: z.string().describe('Search query') }),
    execute: async ({ query }: { query: string }) => {
      return `Found 3 results for '${query}': 1. Refund Policy v2.1, 2. Returns FAQ, 3. Customer Guide`;
    },
  },
  send_email: {
    description: 'Send an email to a customer. Requires governance approval.',
    parameters: z.object({ message: z.string().describe('Email message') }),
    execute: async ({ message }: { message: string }) => {
      return `Email sent: ${message.slice(0, 100)}`;
    },
  },
  export_data: {
    description: 'Export customer data records. Blocked by data protection policy.',
    parameters: z.object({ query: z.string().describe('Export query') }),
    execute: async ({ query }: { query: string }) => {
      return `Exported data for: ${query}`;
    },
  },
};

const governedTools = governVercelTools(rawTools, {
  client,
  data_classification: 'confidential',
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `You are a helpful assistant with 3 governed tools.
When the user asks to search, use search_docs.
When they ask to send email, use send_email.
When they ask to export data, use export_data.
If a tool is denied, explain that the policy blocked it.
If a tool requires approval, tell the user to check the dashboard.`,
    messages,
    tools: governedTools,
    maxSteps: 3,
  });

  return result.toDataStreamResponse();
}
