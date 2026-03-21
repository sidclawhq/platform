#!/usr/bin/env tsx

/**
 * Demo script for the Agent Identity & Approval Layer.
 *
 * Usage:
 *   1. Start the full stack: docker compose up db && cd apps/api && npm run dev
 *   2. Seed the database: cd apps/api && npx prisma db seed
 *   3. Run: npx tsx scripts/demo.ts
 *
 * This script demonstrates:
 *   - Auto-allow: agent reads internal documents (no approval needed)
 *   - Auto-block: agent tries to export PII (denied by policy)
 *   - Approval flow: agent sends customer email (requires approval)
 *   - The complete audit trail for each scenario
 */

import { AgentIdentityClient } from '@sidclaw/sdk';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
// Read the dev API key from deployment/.env.development or use the env var
const API_KEY = process.env.AGENT_IDENTITY_API_KEY ?? '';

if (!API_KEY) {
  console.error('Set AGENT_IDENTITY_API_KEY environment variable');
  console.error('Find it in deployment/.env.development (created by prisma db seed)');
  process.exit(1);
}

const SEPARATOR = '\u2500'.repeat(70);
const SECTION = '\u2550'.repeat(70);

function log(msg: string) { console.log(msg); }
function header(msg: string) { log(`\n${SECTION}\n  ${msg}\n${SECTION}`); }
function section(msg: string) { log(`\n${SEPARATOR}\n  ${msg}\n${SEPARATOR}`); }

async function printTraceTimeline(traceId: string) {
  const response = await fetch(`${API_URL}/api/v1/traces/${traceId}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  const trace = await response.json();

  log(`\n  Trace: ${trace.id}`);
  log(`  Agent: ${trace.agent_name}`);
  log(`  Operation: ${trace.requested_operation} \u2192 ${trace.target_integration}`);
  log(`  Outcome: ${trace.final_outcome}`);
  if (trace.duration_ms !== null) log(`  Duration: ${trace.duration_ms}ms`);
  log('');
  log('  Event Timeline:');

  for (const event of trace.events) {
    const time = new Date(event.timestamp).toISOString().split('T')[1];
    const icon = eventIcon(event.event_type);
    log(`    ${icon} ${time}  ${event.event_type}`);
    log(`      ${event.description}`);
    log(`      Actor: ${event.actor_name} (${event.actor_type})`);
  }
}

function eventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    trace_initiated: '\u25cf',
    identity_resolved: '\u25c6',
    policy_evaluated: '\u25a0',
    sensitive_operation_detected: '\u25b2',
    approval_requested: '\u25c9',
    approval_granted: '\u2713',
    approval_denied: '\u2717',
    operation_allowed: '\u2192',
    operation_executed: '\u2713',
    operation_denied: '\u2717',
    operation_blocked: '\u2298',
    trace_closed: '\u25fc',
  };
  return icons[eventType] ?? '\u25cb';
}

async function main() {
  header('Agent Identity & Approval Layer \u2014 Demo');
  log(`  API: ${API_URL}`);

  // Scenario 1: Auto-allow
  section('Scenario 1: Auto-Allow \u2014 Read Internal Documents');
  log('  Knowledge Retrieval Agent reads internal docs. Policy: allow.');

  const client1 = new AgentIdentityClient({
    apiKey: API_KEY,
    apiUrl: API_URL,
    agentId: 'agent-002', // Knowledge Retrieval
  });

  const decision1 = await client1.evaluate({
    operation: 'read',
    target_integration: 'document_store',
    resource_scope: 'internal_docs',
    data_classification: 'internal',
  });

  log(`\n  Decision: ${decision1.decision}`);
  log(`  Reason: ${decision1.reason}`);

  await client1.recordOutcome(decision1.trace_id, { status: 'success' });
  log('  Outcome recorded: success');

  await printTraceTimeline(decision1.trace_id);

  // Scenario 2: Auto-block
  section('Scenario 2: Auto-Block \u2014 Export Customer PII');
  log('  Customer Communications Agent tries to export PII. Policy: deny.');

  const client2 = new AgentIdentityClient({
    apiKey: API_KEY,
    apiUrl: API_URL,
    agentId: 'agent-001', // Customer Communications
  });

  const decision2 = await client2.evaluate({
    operation: 'export',
    target_integration: 'crm_platform',
    resource_scope: 'customer_pii_records',
    data_classification: 'restricted',
  });

  log(`\n  Decision: ${decision2.decision}`);
  log(`  Reason: ${decision2.reason}`);

  await printTraceTimeline(decision2.trace_id);

  // Scenario 3: Approval flow
  section('Scenario 3: Approval Flow \u2014 Send Customer Email');
  log('  Customer Communications Agent wants to send email. Policy: approval_required.');

  const client3 = new AgentIdentityClient({
    apiKey: API_KEY,
    apiUrl: API_URL,
    agentId: 'agent-001',
  });

  const decision3 = await client3.evaluate({
    operation: 'send',
    target_integration: 'communications_service',
    resource_scope: 'customer_emails',
    data_classification: 'confidential',
    context: {
      recipient: 'customer-1234',
      template: 'service-follow-up',
      reasoning: 'Customer requested follow-up during last interaction',
    },
  });

  log(`\n  Decision: ${decision3.decision}`);
  log(`  Reason: ${decision3.reason}`);
  log(`  Approval Request: ${decision3.approval_request_id}`);
  log('\n  \u23f3 Waiting for approval...');

  // Auto-approve via API (in a real scenario, a human would do this in the dashboard)
  const approveResponse = await fetch(`${API_URL}/api/v1/approvals/${decision3.approval_request_id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      approver_name: 'Demo Reviewer',
      decision_note: 'Customer context verified \u2014 approved for sending',
    }),
  });

  if (approveResponse.ok) {
    log('  \u2713 Approved by Demo Reviewer');
  }

  await client3.recordOutcome(decision3.trace_id, {
    status: 'success',
    metadata: { emails_sent: 1 },
  });
  log('  Outcome recorded: success');

  await printTraceTimeline(decision3.trace_id);

  // Summary
  header('Demo Complete');
  log('  3 scenarios demonstrated:');
  log('    \u2713 Auto-allow: read internal docs (no human needed)');
  log('    \u2298 Auto-block: PII export denied by policy');
  log('    \u2713 Approval flow: email sent after human review');
  log('');
  log('  Open the dashboard to see these traces:');
  log('    http://localhost:3000/dashboard/audit');
  log('    http://localhost:3000/dashboard/approvals');
  log('');
}

main().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
