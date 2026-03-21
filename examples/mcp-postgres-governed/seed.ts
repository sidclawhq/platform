#!/usr/bin/env tsx
/**
 * Seeds the SidClaw platform with the agent and policies for this example.
 * Run this ONCE before starting the governance server.
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
    name: 'PostgreSQL Query Agent',
    description: 'Queries a PostgreSQL database via MCP',
    owner_name: 'Platform Team',
    owner_role: 'Data Engineering',
    team: 'Data Platform',
    environment: 'dev',
    authority_model: 'self',
    identity_mode: 'service_identity',
    delegation_model: 'self',
    autonomy_tier: 'medium',
    authorized_integrations: [
      { name: 'PostgreSQL', resource_scope: '*', data_classification: 'confidential', allowed_operations: ['query'] },
    ],
    created_by: 'example-seed',
  });
  console.log(`Created agent: ${agent.id} (${agent.name})`);

  // Policy 1: Allow general read queries
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Allow general database reads',
    operation: 'database_query',
    target_integration: 'postgres',
    resource_scope: '*',
    data_classification: 'internal',
    policy_effect: 'allow',
    rationale: 'General read queries on non-sensitive tables are within the agent standard operational scope.',
    priority: 50,
    modified_by: 'example-seed',
  });

  // Policy 2: Require approval for customer table queries
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Require approval for customer data queries',
    operation: 'database_query',
    target_integration: 'postgres',
    resource_scope: 'customers',
    data_classification: 'confidential',
    policy_effect: 'approval_required',
    rationale: 'Queries touching customer PII require human review to ensure data protection compliance.',
    priority: 100,
    max_session_ttl: 3600,
    modified_by: 'example-seed',
  });

  // Policy 3: Deny destructive operations
  await api('POST', '/api/v1/policies', {
    agent_id: agent.id,
    policy_name: 'Block destructive database operations',
    operation: 'database_query',
    target_integration: 'postgres',
    resource_scope: 'destructive',
    data_classification: 'restricted',
    policy_effect: 'deny',
    rationale: 'DROP, DELETE, and TRUNCATE operations are prohibited for automated agents under data protection policy.',
    priority: 200,
    modified_by: 'example-seed',
  });

  console.log('Created 3 policies:');
  console.log('  - allow: general database reads');
  console.log('  - approval_required: customer data queries');
  console.log('  - deny: destructive operations (DROP/DELETE/TRUNCATE)');
  console.log(`\nAgent ID for your .env: ${agent.id}`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
