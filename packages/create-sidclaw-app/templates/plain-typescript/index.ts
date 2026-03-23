/**
 * {{projectName}} — Governed AI Agent
 *
 * This agent has 3 functions, each demonstrating a different governance outcome:
 *   searchDocs   → Allowed instantly (safe read operation)
 *   sendEmail    → Requires human approval (check the dashboard!)
 *   exportData   → Blocked by policy (data protection)
 *
 * Run: npm start
 * Dashboard: https://app.sidclaw.com/dashboard/approvals
 */

import 'dotenv/config';
import { AgentIdentityClient, withGovernance } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: process.env.SIDCLAW_API_URL ?? 'https://api.sidclaw.com',
  agentId: process.env.SIDCLAW_AGENT_ID!,
});

// Raw functions — no governance logic inside
async function searchDocsRaw(query: string): Promise<string> {
  return `Found 3 results for '${query}': 1. Refund Policy v2.1, 2. Returns FAQ, 3. Customer Guide`;
}

async function sendEmailRaw(message: string): Promise<string> {
  return `Email sent: ${message.slice(0, 100)}`;
}

async function exportDataRaw(query: string): Promise<string> {
  return `Exported data for: ${query}`;
}

// Wrap with governance
const searchDocs = withGovernance(client, {
  operation: 'search_docs',
  target_integration: 'knowledge_base',
  resource_scope: 'docs',
  data_classification: 'internal',
}, searchDocsRaw);

const sendEmail = withGovernance(client, {
  operation: 'send_email',
  target_integration: 'email_service',
  resource_scope: 'emails',
  data_classification: 'confidential',
}, sendEmailRaw);

const exportData = withGovernance(client, {
  operation: 'export_data',
  target_integration: 'data_store',
  resource_scope: 'records',
  data_classification: 'restricted',
}, exportDataRaw);

async function main() {
  console.log('{{projectName}} — Governed AI Agent');
  console.log('='.repeat(50));
  console.log();

  // Tool 1: Allowed
  console.log('1. Searching knowledge base (should be ALLOWED)...');
  try {
    const result = await searchDocs('refund policy');
    console.log(`   Result: ${result}`);
  } catch (e) {
    console.log(`   Error: ${e instanceof Error ? e.message : e}`);
  }

  console.log();

  // Tool 2: Requires Approval
  console.log('2. Sending customer email (should REQUIRE APPROVAL)...');
  console.log('   Check your dashboard: https://app.sidclaw.com/dashboard/approvals');
  console.log('   Approve the request, then the function will execute.');
  try {
    const result = await sendEmail('Send follow-up to customer about their refund request');
    console.log(`   Result: ${result}`);
  } catch (e) {
    console.log(`   Pending: ${e instanceof Error ? e.message : e}`);
    console.log('   -> Go to the dashboard and approve this request!');
  }

  console.log();

  // Tool 3: Denied
  console.log('3. Exporting customer data (should be DENIED)...');
  try {
    const result = await exportData('Export all customer records to CSV');
    console.log(`   Result: ${result}`);
  } catch (e) {
    console.log(`   Blocked: ${e instanceof Error ? e.message : e}`);
  }

  console.log();
  console.log('='.repeat(50));
  console.log('Done! Check the trace viewer: https://app.sidclaw.com/dashboard/audit');
}

main().catch(console.error);
