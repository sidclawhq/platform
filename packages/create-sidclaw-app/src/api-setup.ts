/**
 * Creates an agent and 3 demo policies via the SidClaw API.
 * This gives the user a working governance setup out of the box.
 */

const REQUEST_TIMEOUT_MS = 15_000;

interface SetupResult {
  agentId: string;
  policyIds: string[];
  failedPolicies: number;
}

export async function setupSidclawResources(
  apiKey: string,
  apiUrl: string,
  projectName: string
): Promise<SetupResult> {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Create agent
  const agentRes = await fetch(`${apiUrl}/api/v1/agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `${projectName} Agent`,
      description: `AI agent for ${projectName}, created by create-sidclaw-app`,
      owner_name: 'Developer',
      owner_role: 'Engineering',
      team: 'Development',
      environment: 'dev',
      authority_model: 'self',
      identity_mode: 'service_identity',
      delegation_model: 'self',
      autonomy_tier: 'medium',
      authorized_integrations: [
        { name: 'Knowledge Base', resource_scope: 'docs', data_classification: 'internal', allowed_operations: ['search'] },
        { name: 'Email Service', resource_scope: 'emails', data_classification: 'confidential', allowed_operations: ['send'] },
        { name: 'Data Store', resource_scope: 'records', data_classification: 'restricted', allowed_operations: ['read', 'export'] },
      ],
      created_by: 'create-sidclaw-app',
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!agentRes.ok) {
    const body = await agentRes.text().catch(() => '');
    throw new Error(`Failed to create agent: ${agentRes.status} ${body}`);
  }
  const agent = await agentRes.json() as { data: { id: string } };
  const agentId = agent.data.id;

  // Create 3 demo policies
  const policies = [
    {
      policy_name: 'Allow knowledge base search',
      operation: 'search_docs',
      target_integration: 'knowledge_base',
      resource_scope: 'docs',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Searching internal documentation is a safe, read-only operation within the agent\'s standard scope.',
      priority: 100,
    },
    {
      policy_name: 'Require approval for sending emails',
      operation: 'send_email',
      target_integration: 'email_service',
      resource_scope: 'emails',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Outbound emails to customers require human review to ensure compliance with communication standards.',
      priority: 100,
      max_session_ttl: 300,
    },
    {
      policy_name: 'Block data export',
      operation: 'export_data',
      target_integration: 'data_store',
      resource_scope: 'records',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Bulk data export of restricted records is prohibited under data protection policy.',
      priority: 200,
    },
  ];

  const policyIds: string[] = [];
  let failedPolicies = 0;
  for (const policy of policies) {
    try {
      const policyRes = await fetch(`${apiUrl}/api/v1/policies`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ agent_id: agentId, ...policy, modified_by: 'create-sidclaw-app' }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (policyRes.ok) {
        const p = await policyRes.json() as { data: { id: string } };
        policyIds.push(p.data.id);
      } else {
        failedPolicies++;
      }
    } catch {
      failedPolicies++;
    }
  }

  return { agentId, policyIds, failedPolicies };
}
