import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Mock knowledge base tool — searches internal documentation.
 * Policy: allow (safe read operation on internal data).
 */
export const searchKnowledgeBase = tool(
  async ({ query }) => {
    // Mock implementation — in production this would hit a vector store
    const articles: Record<string, string> = {
      refund: 'Refund Policy: Full refund within 30 days of purchase. Partial refund within 60 days.',
      shipping: 'Shipping: Standard 5-7 business days. Express 1-2 business days. Free over $50.',
      returns: 'Returns: Items must be unused and in original packaging. Contact support to initiate.',
      warranty: 'Warranty: 1-year limited warranty covers manufacturing defects. Does not cover misuse.',
    };

    const matches = Object.entries(articles)
      .filter(([key]) => query.toLowerCase().includes(key))
      .map(([, value]) => value);

    return matches.length > 0
      ? matches.join('\n\n')
      : `No articles found for "${query}". Try: refund, shipping, returns, warranty.`;
  },
  {
    name: 'search_knowledge_base',
    description: 'Search the internal knowledge base for support articles',
    schema: z.object({
      query: z.string().describe('The search query'),
    }),
  }
);

/**
 * Mock email sending tool — sends an email to a customer.
 * Policy: approval_required (outbound customer contact needs review).
 */
export const sendEmailToCustomer = tool(
  async ({ to, subject, body }) => {
    // Mock implementation — in production this would call an email API
    console.log(`    [Mock] Email sent to ${to}`);
    console.log(`    [Mock] Subject: ${subject}`);
    console.log(`    [Mock] Body: ${body.substring(0, 80)}...`);
    return `Email sent successfully to ${to} with subject "${subject}"`;
  },
  {
    name: 'send_email_to_customer',
    description: 'Send an email to a customer',
    schema: z.object({
      to: z.string().describe('Customer email address'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body'),
    }),
  }
);

/**
 * Mock data export tool — exports customer data.
 * Policy: deny (PII export is prohibited by data protection policy).
 */
export const exportCustomerData = tool(
  async ({ customerId, format }) => {
    // This should never execute — policy denies it
    return `Exported data for customer ${customerId} as ${format}`;
  },
  {
    name: 'export_customer_data',
    description: 'Export all data for a customer (PII included)',
    schema: z.object({
      customerId: z.string().describe('The customer ID'),
      format: z.enum(['csv', 'json']).describe('Export format'),
    }),
  }
);

export const allTools = [searchKnowledgeBase, sendEmailToCustomer, exportCustomerData];
