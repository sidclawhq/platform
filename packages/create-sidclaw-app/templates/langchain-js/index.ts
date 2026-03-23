/**
 * {{projectName}} — Governed AI Agent
 *
 * This agent has 3 tools, each demonstrating a different governance outcome:
 *   search_docs  → Allowed instantly (safe read operation)
 *   send_email   → Requires human approval (check the dashboard!)
 *   export_data  → Blocked by policy (data protection)
 *
 * Run: npm start
 * Dashboard: https://app.sidclaw.com/dashboard/approvals
 */

import 'dotenv/config';
import { AgentIdentityClient } from '@sidclaw/sdk';
import { governTools } from '@sidclaw/sdk/langchain';
import { searchDocs, sendEmail, exportData } from './tools.js';

if (!process.env.SIDCLAW_AGENT_ID) {
  console.error('Error: SIDCLAW_AGENT_ID is not set in .env');
  console.error('  1. Go to https://app.sidclaw.com/dashboard/agents');
  console.error('  2. Create an agent');
  console.error('  3. Copy the agent ID into .env as SIDCLAW_AGENT_ID');
  process.exit(1);
}

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: process.env.SIDCLAW_API_URL ?? 'https://api.sidclaw.com',
  agentId: process.env.SIDCLAW_AGENT_ID,
});

// Wrap tools with governance — no changes to tool code
const rawTools = [searchDocs, sendEmail, exportData];
const governedTools = governTools(rawTools, { client, data_classification: 'confidential' });

async function main() {
  console.log('{{projectName}} — Governed AI Agent');
  console.log('='.repeat(50));
  console.log();

  // Tool 1: Allowed
  console.log('1. Searching knowledge base (should be ALLOWED)...');
  try {
    const result = await governedTools[0].invoke('refund policy');
    console.log(`   Result: ${result}`);
  } catch (e) {
    console.log(`   Error: ${e instanceof Error ? e.message : e}`);
  }

  console.log();

  // Tool 2: Requires Approval
  console.log('2. Sending customer email (should REQUIRE APPROVAL)...');
  console.log('   Check your dashboard: https://app.sidclaw.com/dashboard/approvals');
  console.log('   Approve the request, then the tool will execute.');
  try {
    const result = await governedTools[1].invoke('Send follow-up to customer about their refund request');
    console.log(`   Result: ${result}`);
  } catch (e) {
    console.log(`   Pending: ${e instanceof Error ? e.message : e}`);
    console.log('   -> Go to the dashboard and approve this request!');
  }

  console.log();

  // Tool 3: Denied
  console.log('3. Exporting customer data (should be DENIED)...');
  try {
    const result = await governedTools[2].invoke('Export all customer records to CSV');
    console.log(`   Result: ${result}`);
  } catch (e) {
    console.log(`   Blocked: ${e instanceof Error ? e.message : e}`);
  }

  console.log();
  console.log('='.repeat(50));
  console.log('Done! Check the trace viewer: https://app.sidclaw.com/dashboard/audit');
}

main().catch(console.error);
