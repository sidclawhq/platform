import type { SidClawClient } from './client.js';

/**
 * MCP resources — read-only data that MCP clients can enumerate and fetch.
 * Exposes the policy set, per-agent trace history, and instance health.
 */

export const RESOURCE_DEFINITIONS = [
  {
    uri: 'sidclaw://policies',
    name: 'Active policy rules',
    description: 'All active policies for the current tenant (JSON).',
    mimeType: 'application/json',
  },
  {
    uri: 'sidclaw://status',
    name: 'SidClaw instance status',
    description: 'Health + basic statistics for the SidClaw instance.',
    mimeType: 'application/json',
  },
  {
    // Dynamic templated URI is discoverable but read requires a concrete agent_id.
    uri: 'sidclaw://agent/{agent_id}/history',
    name: 'Agent action history',
    description: 'Last 50 action records for the given agent.',
    mimeType: 'application/json',
  },
] as const;


export async function readResource(
  client: SidClawClient,
  uri: string,
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  if (uri === 'sidclaw://policies') {
    const data = await client.listPolicies();
    return json(uri, data);
  }

  if (uri === 'sidclaw://status') {
    const health = await client.health().catch((e) => ({ status: 'unreachable', error: String(e) }));
    return json(uri, health);
  }

  // sidclaw://agent/{agent_id}/history
  const match = uri.match(/^sidclaw:\/\/agent\/([^/]+)\/history$/);
  if (match) {
    const agentId = decodeURIComponent(match[1]);
    const traces = await client.listTraces(agentId, 50);
    return json(uri, traces);
  }

  throw new Error(`unknown resource URI: ${uri}`);
}


function json(uri: string, payload: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
