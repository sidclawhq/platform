#!/usr/bin/env tsx
/**
 * Seeds the SidClaw platform with the agent and policies for this NemoClaw example.
 * Run this ONCE before using the governed tools.
 *
 * Usage:
 *   SIDCLAW_API_KEY=<key> npx tsx seed.ts
 *   SIDCLAW_API_KEY=<key> SIDCLAW_API_URL=http://localhost:4000 npx tsx seed.ts
 */
const API_URL = process.env.SIDCLAW_API_URL ?? 'https://api.sidclaw.com';
const API_KEY = process.env.SIDCLAW_API_KEY!;

if (!API_KEY) {
  console.error('Error: SIDCLAW_API_KEY environment variable is required.');
  console.error('Find it in deployment/.env.development (created by prisma db seed).');
  process.exit(1);
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log(`Seeding SidClaw platform at ${API_URL}...\n`);

  // Create agent
  const { data: agent } = await api('POST', '/api/v1/agents', {
    name: 'NemoClaw Sandbox Agent',
    description: 'AI agent operating inside a NemoClaw sandbox with SidClaw governance',
    owner_name: 'Platform Team',
    owner_role: 'AI Infrastructure',
    team: 'Platform Engineering',
    environment: 'dev',
    authority_model: 'self',
    identity_mode: 'service_identity',
    delegation_model: 'self',
    autonomy_tier: 'medium',
    authorized_integrations: [
      { name: 'Documentation', resource_scope: '*', data_classification: 'internal', allowed_operations: ['search'] },
      { name: 'Email Service', resource_scope: 'outbound_emails', data_classification: 'confidential', allowed_operations: ['send'] },
      { name: 'Data Export', resource_scope: 'user_data', data_classification: 'restricted', allowed_operations: ['export'] },
    ],
    created_by: 'example-seed',
  });
  console.log(`Created agent: ${agent.id} (${agent.name})`);

  // Policy 1: Allow documentation searches (safe, internal data)
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Allow documentation searches',
    operation: 'search_docs',
    target_integration: 'nemoclaw',
    resource_scope: 'nemoclaw_sandbox',
    data_classification: 'internal',
    policy_effect: 'allow',
    rationale: 'Searching internal documentation is a safe read-only operation within the sandbox scope.',
    priority: 50,
    modified_by: 'example-seed',
  });

  // Policy 2: Require approval for sending emails (confidential, external comms)
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Require approval for sending emails',
    operation: 'send_email',
    target_integration: 'nemoclaw',
    resource_scope: 'nemoclaw_sandbox',
    data_classification: 'confidential',
    policy_effect: 'approval_required',
    rationale: 'Outbound emails from a sandboxed agent must be reviewed by a human before sending.',
    priority: 100,
    max_session_ttl: 3600,
    modified_by: 'example-seed',
  });

  // Policy 3: Deny data exports (restricted, PII protection)
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Block data exports',
    operation: 'export_data',
    target_integration: 'nemoclaw',
    resource_scope: 'nemoclaw_sandbox',
    data_classification: 'restricted',
    policy_effect: 'deny',
    rationale: 'Bulk data export from sandboxed agents is prohibited. Use authorized admin tools instead.',
    priority: 200,
    modified_by: 'example-seed',
  });

  console.log('Created 3 policies:');
  console.log('  - allow: documentation searches (priority 50)');
  console.log('  - approval_required: sending emails (priority 100)');
  console.log('  - deny: data exports (priority 200)');
  console.log(`\nAgent ID for your environment: ${agent.id}`);
  console.log(`\nSet it before running the demo:`);
  console.log(`  export SIDCLAW_AGENT_ID=${agent.id}`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
