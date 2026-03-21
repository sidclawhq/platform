#!/usr/bin/env tsx
/**
 * Seeds the SidClaw platform with the agent and policies for this example.
 * Run this ONCE before using the governed tools.
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
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries using knowledge base, email, and data tools',
    owner_name: 'Support Team',
    owner_role: 'Customer Success',
    team: 'Support',
    environment: 'dev',
    authority_model: 'self',
    identity_mode: 'service_identity',
    delegation_model: 'self',
    autonomy_tier: 'medium',
    authorized_integrations: [
      { name: 'Knowledge Base', resource_scope: '*', data_classification: 'internal', allowed_operations: ['search'] },
      { name: 'Email Service', resource_scope: 'customer_emails', data_classification: 'confidential', allowed_operations: ['send'] },
      { name: 'Data Export', resource_scope: 'customer_data', data_classification: 'restricted', allowed_operations: ['export'] },
    ],
    created_by: 'example-seed',
  });
  console.log(`Created agent: ${agent.id} (${agent.name})`);

  // Policy 1: Allow knowledge base searches
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Allow knowledge base searches',
    operation: 'search_knowledge_base',
    target_integration: 'search_knowledge_base',
    resource_scope: '*',
    data_classification: 'internal',
    policy_effect: 'allow',
    rationale: 'Searching internal documentation is a safe read operation within the agent scope.',
    priority: 50,
    modified_by: 'example-seed',
  });

  // Policy 2: Require approval for sending emails
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Require approval for customer emails',
    operation: 'send_email_to_customer',
    target_integration: 'send_email_to_customer',
    resource_scope: '*',
    data_classification: 'confidential',
    policy_effect: 'approval_required',
    rationale: 'Outbound customer communications must be reviewed by a human to ensure accuracy and tone.',
    priority: 100,
    max_session_ttl: 3600,
    modified_by: 'example-seed',
  });

  // Policy 3: Deny customer data exports
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Block customer data exports',
    operation: 'export_customer_data',
    target_integration: 'export_customer_data',
    resource_scope: '*',
    data_classification: 'restricted',
    policy_effect: 'deny',
    rationale: 'Bulk PII export is prohibited by data protection policy. Use the admin console for authorized exports.',
    priority: 200,
    modified_by: 'example-seed',
  });

  console.log('Created 3 policies:');
  console.log('  - allow: knowledge base searches');
  console.log('  - approval_required: customer email sending');
  console.log('  - deny: customer data exports');
  console.log(`\nAgent ID for your .env: ${agent.id}`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
