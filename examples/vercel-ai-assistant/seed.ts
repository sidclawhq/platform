#!/usr/bin/env tsx
/**
 * Seeds the SidClaw platform with the agent and policies for this example.
 * Run this ONCE before starting the web app.
 */
const API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';
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
    name: 'Web Assistant Agent',
    description: 'Chat assistant with inventory, notification, and data management tools',
    owner_name: 'Product Team',
    owner_role: 'Engineering',
    team: 'Product',
    environment: 'dev',
    authority_model: 'self',
    identity_mode: 'service_identity',
    delegation_model: 'self',
    autonomy_tier: 'medium',
    authorized_integrations: [
      { name: 'Inventory', resource_scope: '*', data_classification: 'internal', allowed_operations: ['read'] },
      { name: 'Notifications', resource_scope: 'customer_emails', data_classification: 'confidential', allowed_operations: ['send'] },
      { name: 'Data Management', resource_scope: 'customer_records', data_classification: 'restricted', allowed_operations: ['delete'] },
    ],
    created_by: 'example-seed',
  });
  console.log(`Created agent: ${agent.id} (${agent.name})`);

  // Policy 1: Allow inventory checks
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Allow inventory checks',
    operation: 'check_inventory',
    target_integration: 'check_inventory',
    resource_scope: '*',
    data_classification: 'internal',
    policy_effect: 'allow',
    rationale: 'Checking inventory is a safe read operation on internal data.',
    priority: 50,
    modified_by: 'example-seed',
  });

  // Policy 2: Require approval for sending notifications
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Require approval for customer notifications',
    operation: 'send_notification',
    target_integration: 'send_notification',
    resource_scope: '*',
    data_classification: 'confidential',
    policy_effect: 'approval_required',
    rationale: 'Outbound customer notifications require human review before sending.',
    priority: 100,
    max_session_ttl: 3600,
    modified_by: 'example-seed',
  });

  // Policy 3: Deny record deletion
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Block record deletion',
    operation: 'delete_records',
    target_integration: 'delete_records',
    resource_scope: '*',
    data_classification: 'restricted',
    policy_effect: 'deny',
    rationale: 'Automated record deletion is prohibited. Use the admin console for authorized deletions.',
    priority: 200,
    modified_by: 'example-seed',
  });

  console.log('Created 3 policies:');
  console.log('  - allow: inventory checks');
  console.log('  - approval_required: customer notifications');
  console.log('  - deny: record deletion');
  console.log(`\nAgent ID for your .env: ${agent.id}`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
