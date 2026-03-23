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

const sessions = new Map<string, DemoSession>();

async function cleanupOldDemoAgents(headers: Record<string, string>): Promise<void> {
  try {
    const res = await fetch(`${DEMO_API_URL}/api/v1/agents?search=demo-&limit=100`, { headers });
    if (!res.ok) return;
    const body = await res.json();
    const agents = body.data ?? [];
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    for (const agent of agents) {
      if (agent.name?.includes('(demo-') && agent.created_at < twoHoursAgo && agent.lifecycle_state === 'active') {
        await fetch(`${DEMO_API_URL}/api/v1/agents/${agent.id}/revoke`, {
          method: 'POST',
          headers,
        }).catch(() => {});
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

export async function getOrCreateDemoSession(sessionId: string | null): Promise<DemoSession> {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  const newSessionId = randomBytes(16).toString('hex');
  const agentName = `Nexus Ops Agent (demo-${newSessionId.substring(0, 8)})`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEMO_ADMIN_KEY}`,
  };

  await cleanupOldDemoAgents(headers);

  const agentRes = await fetch(`${DEMO_API_URL}/api/v1/agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: agentName,
      description: 'Nexus Labs AI operations agent — monitors and manages cloud infrastructure',
      owner_name: 'Jordan Park',
      owner_role: 'VP Infrastructure',
      team: 'Platform Engineering',
      environment: 'prod',
      authority_model: 'delegated',
      identity_mode: 'delegated_identity',
      delegation_model: 'on_behalf_of_owner',
      autonomy_tier: 'high',
      authorized_integrations: [
        { name: 'Infrastructure Monitor', resource_scope: 'service_metrics', data_classification: 'internal', allowed_operations: ['read'] },
        { name: 'Log Aggregator', resource_scope: 'service_logs', data_classification: 'internal', allowed_operations: ['read'] },
        { name: 'Container Orchestrator', resource_scope: 'kubernetes', data_classification: 'confidential', allowed_operations: ['scale', 'read'] },
        { name: 'Deployment Pipeline', resource_scope: 'deployments', data_classification: 'confidential', allowed_operations: ['deploy'] },
        { name: 'Secrets Manager', resource_scope: 'service_credentials', data_classification: 'restricted', allowed_operations: ['read'] },
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

  const policies = [
    {
      policy_name: 'Allow service health checks',
      operation: 'check_health',
      target_integration: 'infrastructure_monitor',
      resource_scope: 'service_metrics',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Reading service health metrics and status is a standard monitoring operation within the agent\'s authorized scope. No data modification or access to sensitive systems.',
      priority: 100,
    },
    {
      policy_name: 'Allow log access',
      operation: 'read_logs',
      target_integration: 'log_aggregator',
      resource_scope: 'service_logs',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Accessing application logs for debugging and incident investigation is within the operations agent\'s standard permissions. Logs are already sanitized of credentials.',
      priority: 100,
    },
    {
      policy_name: 'Require approval for service scaling',
      operation: 'scale_service',
      target_integration: 'container_orchestrator',
      resource_scope: 'service_replicas',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Scaling operations affect infrastructure costs and service capacity. Scaling up increases cloud spend; scaling down risks degraded performance. An on-call engineer must verify the scaling decision.',
      priority: 100,
      max_session_ttl: 300,
    },
    {
      policy_name: 'Require approval for production deployments',
      operation: 'deploy_production',
      target_integration: 'deployment_pipeline',
      resource_scope: 'production_environment',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Production deployments directly affect customer-facing services. Every production deploy must be reviewed by an engineer who confirms: CI passed, staging validated, rollback plan is in place. This is a non-negotiable operational control.',
      priority: 200,
      max_session_ttl: 300,
    },
    {
      policy_name: 'Require approval for staging deployments',
      operation: 'deploy_staging',
      target_integration: 'deployment_pipeline',
      resource_scope: 'staging_environment',
      data_classification: 'internal',
      policy_effect: 'approval_required',
      rationale: 'Staging deployments should be reviewed to ensure they don\'t disrupt ongoing QA testing or performance benchmarks.',
      priority: 100,
      max_session_ttl: 300,
    },
    {
      policy_name: 'Block namespace deletion',
      operation: 'delete_namespace',
      target_integration: 'container_orchestrator',
      resource_scope: 'kubernetes_namespaces',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Deleting Kubernetes namespaces is an irreversible destructive operation that could destroy production services, data volumes, and running workloads. This action must be performed manually by a senior infrastructure engineer with change management approval.',
      priority: 200,
    },
    {
      policy_name: 'Block secret rotation',
      operation: 'rotate_secrets',
      target_integration: 'secrets_manager',
      resource_scope: 'service_credentials',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Automated credential rotation could break service-to-service authentication across the entire infrastructure. This requires coordinated execution with downtime windows and is handled by the security team\'s rotation playbook.',
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

  for (const [id, s] of sessions) {
    if (Date.now() - s.createdAt > 3600000) {
      sessions.delete(id);
    }
  }

  return session;
}
