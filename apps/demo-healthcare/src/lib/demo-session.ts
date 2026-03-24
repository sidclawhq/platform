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

    // Revoke ALL active MedAssist demo agents (own type) to ensure room for the new one
    for (const agent of agents) {
      if (agent.name?.includes('MedAssist') && agent.name?.includes('(demo-') && agent.lifecycle_state === 'active') {
        await fetch(`${DEMO_API_URL}/api/v1/agents/${agent.id}/revoke`, {
          method: 'POST',
          headers,
        }).catch(() => {});
      }
    }

    // Also revoke any demo agents from other demos older than 1 hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    for (const agent of agents) {
      if (agent.name?.includes('(demo-') && agent.created_at < oneHourAgo && agent.lifecycle_state === 'active') {
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
  const agentName = `MedAssist Clinical AI (demo-${newSessionId.substring(0, 8)})`;

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
      description: 'AI clinical decision support assistant — reviews patient data, recommends diagnostic and treatment actions under physician supervision',
      owner_name: 'Dr. James Liu',
      owner_role: 'Supervising Physician',
      team: 'MedAssist Health — Clinical AI',
      environment: 'prod',
      authority_model: 'delegated',
      identity_mode: 'delegated_identity',
      delegation_model: 'on_behalf_of_owner',
      autonomy_tier: 'medium',
      authorized_integrations: [
        { name: 'EHR System', resource_scope: 'patient_records', data_classification: 'confidential', allowed_operations: ['read'] },
        { name: 'Clinical Knowledge', resource_scope: 'medical_references', data_classification: 'public', allowed_operations: ['search'] },
        { name: 'Lab System', resource_scope: 'lab_orders', data_classification: 'confidential', allowed_operations: ['order'] },
        { name: 'Patient Portal', resource_scope: 'patient_communications', data_classification: 'confidential', allowed_operations: ['send'] },
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
      policy_name: 'Allow patient chart access',
      operation: 'view_chart',
      target_integration: 'ehr_system',
      resource_scope: 'patient_records',
      data_classification: 'confidential',
      policy_effect: 'allow',
      rationale: 'Clinical AI assistant has authorized read access to patient charts under the supervising physician\'s credentials. Access is logged for HIPAA compliance and limited to the minimum necessary data for the current clinical context.',
      priority: 100,
    },
    {
      policy_name: 'Allow medical literature search',
      operation: 'search_literature',
      target_integration: 'clinical_knowledge',
      resource_scope: 'medical_references',
      data_classification: 'public',
      policy_effect: 'allow',
      rationale: 'Searching published medical literature and clinical guidelines is a read-only operation on public data. No patient information is transmitted to external systems.',
      priority: 100,
    },
    {
      policy_name: 'Require approval for lab orders',
      operation: 'order_labs',
      target_integration: 'lab_system',
      resource_scope: 'lab_orders',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Lab orders incur costs, require patient consent, and affect clinical decision-making. A licensed physician must review and confirm all lab orders before submission to the laboratory system.',
      priority: 100,
      max_session_ttl: 600,
    },
    {
      policy_name: 'Require approval for patient communications',
      operation: 'send_patient_message',
      target_integration: 'patient_portal',
      resource_scope: 'patient_communications',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Patient-facing communications must be reviewed by a clinician for medical accuracy, appropriate tone, and HIPAA compliance before delivery. Incorrect medical guidance in patient communications creates liability risk.',
      priority: 100,
      max_session_ttl: 600,
    },
    {
      policy_name: 'Block AI medication prescriptions',
      operation: 'prescribe_medication',
      target_integration: 'pharmacy_system',
      resource_scope: 'prescriptions',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Medication prescriptions require a licensed physician\'s clinical judgment, DEA authorization, and direct order entry. AI systems cannot prescribe medications under federal and state medical practice regulations. The AI may recommend, but a physician must independently evaluate and order.',
      priority: 200,
    },
    {
      policy_name: 'Block AI treatment plan modifications',
      operation: 'modify_treatment',
      target_integration: 'ehr_system',
      resource_scope: 'treatment_plans',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Treatment plan modifications directly affect patient care outcomes and require physician clinical judgment. AI-generated treatment changes must be reviewed and entered by the treating physician. Automated modifications are prohibited under clinical governance policy.',
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

  // Clean up old sessions
  for (const [id, s] of sessions) {
    if (Date.now() - s.createdAt > 3600000) {
      sessions.delete(id);
    }
  }

  return session;
}
