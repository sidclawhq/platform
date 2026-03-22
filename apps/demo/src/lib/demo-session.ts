import { randomBytes } from 'crypto';

const DEMO_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';
const DEMO_ADMIN_KEY = process.env.DEMO_ADMIN_API_KEY!;

interface DemoSession {
  sessionId: string;
  tenantId: string;
  agentId: string;
  apiKey: string;
  createdAt: number;
}

// In-memory store — fine for demo (not production)
const sessions = new Map<string, DemoSession>();

export async function getOrCreateDemoSession(sessionId: string | null): Promise<DemoSession> {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  const newSessionId = randomBytes(16).toString('hex');
  const agentName = `Atlas Support Agent (demo-${newSessionId.substring(0, 8)})`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEMO_ADMIN_KEY}`,
  };

  // Create demo agent via API
  const agentRes = await fetch(`${DEMO_API_URL}/api/v1/agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: agentName,
      description: 'Atlas Financial customer support AI agent — interactive demo',
      owner_name: 'Maria Chen',
      owner_role: 'VP Customer Support',
      team: 'Atlas Financial — Customer Operations',
      environment: 'prod',
      authority_model: 'delegated',
      identity_mode: 'delegated_identity',
      delegation_model: 'on_behalf_of_owner',
      autonomy_tier: 'medium',
      authorized_integrations: [
        { name: 'Knowledge Base', resource_scope: 'internal_docs', data_classification: 'internal', allowed_operations: ['search'] },
        { name: 'Customer CRM', resource_scope: 'customer_records', data_classification: 'confidential', allowed_operations: ['read'] },
        { name: 'Email Service', resource_scope: 'customer_emails', data_classification: 'confidential', allowed_operations: ['send'] },
        { name: 'Case Management', resource_scope: 'support_cases', data_classification: 'confidential', allowed_operations: ['read', 'update'] },
      ],
      created_by: 'demo-setup',
    }),
  });

  if (!agentRes.ok) {
    const err = await agentRes.text();
    throw new Error(`Failed to create demo agent: ${agentRes.status} ${err}`);
  }

  const agent = await agentRes.json();
  const agentId = agent.data.id;

  // Create 6 policies for the demo agent
  const policies = [
    {
      policy_name: 'Allow knowledge base search',
      operation: 'search',
      target_integration: 'knowledge_base',
      resource_scope: 'internal_docs',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Read-only access to internal documentation is within the agent\'s standard operational scope and poses no compliance risk.',
      priority: 100,
    },
    {
      policy_name: 'Allow customer account lookup',
      operation: 'lookup',
      target_integration: 'customer_crm',
      resource_scope: 'customer_records',
      data_classification: 'confidential',
      policy_effect: 'allow',
      rationale: 'Reading customer account details for support context is permitted under the agent\'s delegated authority with existing access controls.',
      priority: 100,
    },
    {
      policy_name: 'Require approval for outbound customer emails',
      operation: 'send_email',
      target_integration: 'email_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Outbound customer communications require human review before sending to ensure compliance with FINRA communication standards and data handling policies.',
      priority: 100,
      max_session_ttl: 300,
    },
    {
      policy_name: 'Require approval for case updates',
      operation: 'update_case',
      target_integration: 'case_management',
      resource_scope: 'support_cases',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Modifying support case records requires human review under operational risk policy to ensure proper documentation and financial reconciliation.',
      priority: 100,
      max_session_ttl: 300,
    },
    {
      policy_name: 'Block customer data export',
      operation: 'export_data',
      target_integration: 'customer_crm',
      resource_scope: 'customer_pii',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Bulk export of customer personally identifiable information is prohibited under data protection policy, regardless of delegated authority or stated business justification.',
      priority: 200,
    },
    {
      policy_name: 'Block account closure',
      operation: 'close_account',
      target_integration: 'customer_crm',
      resource_scope: 'customer_accounts',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Account closure is an irreversible financial action that exceeds the operational authority of automated agents and requires direct human processing.',
      priority: 200,
    },
  ];

  for (const policy of policies) {
    const policyRes = await fetch(`${DEMO_API_URL}/api/v1/policies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agent_id: agentId,
        ...policy,
        conditions: null,
        max_session_ttl: policy.max_session_ttl ?? null,
        modified_by: 'demo-setup',
        modified_at: new Date().toISOString(),
      }),
    });
    if (!policyRes.ok) {
      const errBody = await policyRes.text().catch(() => '');
      console.warn(`Failed to create policy "${policy.policy_name}": ${policyRes.status} ${errBody}`);
    }
  }

  const session: DemoSession = {
    sessionId: newSessionId,
    tenantId: 'demo-tenant',
    agentId,
    apiKey: DEMO_ADMIN_KEY,
    createdAt: Date.now(),
  };

  sessions.set(newSessionId, session);

  // Clean up old sessions (>1 hour)
  for (const [id, s] of sessions) {
    if (Date.now() - s.createdAt > 3600000) {
      sessions.delete(id);
    }
  }

  return session;
}
