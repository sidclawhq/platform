/**
 * Demo tools for the governed agent.
 */

import { DynamicTool } from '@langchain/core/tools';

export const searchDocs = new DynamicTool({
  name: 'search_docs',
  description: 'Search the internal knowledge base for documentation and policies.',
  func: async (query: string) => {
    // Mock implementation
    return `Found 3 results for '${query}': 1. Refund Policy v2.1, 2. Returns FAQ, 3. Customer Guide`;
  },
});

export const sendEmail = new DynamicTool({
  name: 'send_email',
  description: 'Send an email to a customer. Requires governance approval.',
  func: async (message: string) => {
    // Mock implementation — in production this would actually send
    return `Email sent: ${message.slice(0, 100)}`;
  },
});

export const exportData = new DynamicTool({
  name: 'export_data',
  description: 'Export customer data records. Blocked by data protection policy.',
  func: async (query: string) => {
    // This should never execute — the policy blocks it
    return `Exported data for: ${query}`;
  },
});
