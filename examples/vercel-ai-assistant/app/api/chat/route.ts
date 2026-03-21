import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { AgentIdentityClient } from '@sidclaw/sdk';
import { governVercelTools } from '@sidclaw/sdk/vercel-ai';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: process.env.SIDCLAW_API_URL ?? 'http://localhost:4000',
  agentId: process.env.AGENT_ID ?? 'assistant-agent',
});

/**
 * Tool definitions — these are mock implementations.
 * In a real app, they would call actual services.
 */
const tools = {
  check_inventory: {
    description: 'Check product inventory levels',
    parameters: z.object({
      product: z.string().describe('Product name to check'),
    }),
    execute: async ({ product }: { product: string }) => {
      // Mock inventory data
      const inventory: Record<string, number> = {
        'widget a': 142,
        'widget b': 37,
        'widget c': 0,
      };
      const count = inventory[product.toLowerCase()];
      if (count === undefined) return `Product "${product}" not found in inventory.`;
      if (count === 0) return `${product}: OUT OF STOCK`;
      return `${product}: ${count} units in stock`;
    },
  },
  send_notification: {
    description: 'Send a notification email to a customer',
    parameters: z.object({
      to: z.string().describe('Recipient email address'),
      message: z.string().describe('Notification message'),
    }),
    execute: async ({ to, message }: { to: string; message: string }) => {
      // Mock — in production this would call an email API
      return `Notification sent to ${to}: "${message.substring(0, 60)}..."`;
    },
  },
  delete_records: {
    description: 'Delete all records for a customer (destructive operation)',
    parameters: z.object({
      customerId: z.string().describe('Customer ID whose records to delete'),
    }),
    execute: async ({ customerId }: { customerId: string }) => {
      // This should never execute — policy denies it
      return `Deleted all records for ${customerId}`;
    },
  },
};

// Wrap all tools with governance
const governedTools = governVercelTools(tools, {
  client,
  data_classification: 'confidential',
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `You are a helpful assistant with access to governed tools.
Some tools may be blocked by governance policies — if a tool call fails with a policy denial,
explain to the user that the action was blocked and why. Be concise.`,
    messages,
    tools: governedTools,
    maxSteps: 3,
  });

  return result.toDataStreamResponse();
}
