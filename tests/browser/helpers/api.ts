const API_URL = 'http://localhost:4000';

export async function createAgentViaAPI(apiKey: string, data: {
  name: string;
  description: string;
  owner_name: string;
  owner_role: string;
  team: string;
  authority_model: string;
  identity_mode: string;
  delegation_model: string;
  autonomy_tier?: string;
}) {
  const res = await fetch(`${API_URL}/api/v1/agents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...data, created_by: 'e2e-test' }),
  });
  if (!res.ok) throw new Error(`Create agent failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createPolicyViaAPI(apiKey: string, data: {
  agent_id: string;
  policy_name: string;
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  policy_effect: string;
  rationale: string;
  priority?: number;
}) {
  const res = await fetch(`${API_URL}/api/v1/policies`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...data, modified_by: 'e2e-test' }),
  });
  if (!res.ok) throw new Error(`Create policy failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function evaluateViaAPI(apiKey: string, data: {
  agent_id: string;
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  context?: Record<string, unknown>;
}) {
  const res = await fetch(`${API_URL}/api/v1/evaluate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Evaluate failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listAgentsViaAPI(apiKey: string, search?: string) {
  const url = new URL(`${API_URL}/api/v1/agents`);
  if (search) url.searchParams.set('search', search);
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`List agents failed: ${res.status}`);
  return res.json();
}

export async function getDevApiKey(): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.resolve(process.cwd(), 'deployment/.env.development');
  const env = fs.readFileSync(envPath, 'utf-8');
  const match = env.match(/AGENT_IDENTITY_API_KEY=(.+)/);
  if (!match) throw new Error('Dev API key not found');
  return match[1].trim();
}
