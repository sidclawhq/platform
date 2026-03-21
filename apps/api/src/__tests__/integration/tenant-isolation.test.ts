import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { createHash, randomBytes } from 'node:crypto';

let app: FastifyInstance;
let prisma: PrismaClient;

// Tenant A data
let tenantA: { id: string };
let agentA: { id: string };
let rawKeyA: string;
let policyA: { id: string };
let traceA: { id: string };
let approvalA: { id: string };
let webhookA: { id: string };

// Tenant B data
let tenantB: { id: string };
let agentB: { id: string };
let rawKeyB: string;
let policyB: { id: string };
let traceB: { id: string };
let approvalB: { id: string };
let webhookB: { id: string };

async function createTenantWithData(
  client: PrismaClient,
  tenantId: string,
  tenantName: string,
) {
  const tenant = await client.tenant.create({
    data: {
      id: tenantId,
      name: tenantName,
      slug: tenantId,
      plan: 'enterprise',
      settings: {
        default_approval_ttl_seconds: 86400,
        default_data_classification: 'internal',
      },
      onboarding_state: {},
    },
  });

  const agent = await client.agent.create({
    data: {
      tenant_id: tenant.id,
      name: `${tenantName} Agent`,
      description: 'Test agent',
      owner_name: 'Test Owner',
      owner_role: 'Engineer',
      team: 'Platform',
      environment: 'test',
      authority_model: 'self',
      identity_mode: 'service_identity',
      delegation_model: 'self',
      autonomy_tier: 'low',
      lifecycle_state: 'active',
      authorized_integrations: [],
      created_by: 'test-setup',
    },
  });

  const rawKey = 'ai_test_' + randomBytes(16).toString('hex');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  await client.apiKey.create({
    data: {
      tenant_id: tenant.id,
      name: `${tenantName} Key`,
      key_prefix: rawKey.substring(0, 12),
      key_hash: keyHash,
      scopes: ['evaluate', 'traces:read', 'traces:write', 'approvals:read', 'admin'],
    },
  });

  const policy = await client.policyRule.create({
    data: {
      tenant_id: tenant.id,
      agent_id: agent.id,
      policy_name: `${tenantName} Policy`,
      operation: 'read',
      target_integration: 'database',
      resource_scope: '*',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Requires approval for confidential data',
      priority: 100,
      policy_version: 1,
      is_active: true,
      modified_by: 'test-setup',
    },
  });

  const trace = await client.auditTrace.create({
    data: {
      tenant_id: tenant.id,
      agent_id: agent.id,
      authority_model: 'self',
      requested_operation: 'read',
      target_integration: 'database',
      resource_scope: '*',
      final_outcome: 'in_progress',
    },
  });

  const approval = await client.approvalRequest.create({
    data: {
      tenant_id: tenant.id,
      trace_id: trace.id,
      agent_id: agent.id,
      policy_rule_id: policy.id,
      requested_operation: 'read',
      target_integration: 'database',
      resource_scope: '*',
      data_classification: 'confidential',
      authority_model: 'self',
      policy_effect: 'approval_required',
      flag_reason: 'Confidential data',
      status: 'pending',
      risk_classification: 'high',
    },
  });

  await client.auditEvent.create({
    data: {
      tenant_id: tenant.id,
      trace_id: trace.id,
      agent_id: agent.id,
      event_type: 'trace_initiated',
      actor_type: 'agent',
      actor_name: `${tenantName} Agent`,
      description: 'Test trace initiated',
      status: 'started',
    },
  });

  const webhook = await client.webhookEndpoint.create({
    data: {
      tenant_id: tenant.id,
      url: 'http://localhost:9999/webhook',
      secret: randomBytes(32).toString('hex'),
      events: ['approval.requested'],
      description: `${tenantName} webhook`,
    },
  });

  return { tenant, agent, rawKey, policy, trace, approval, webhook };
}

beforeAll(async () => {
  const server = await createTestServer();
  app = server.app;
  prisma = server.prisma;
});

afterAll(async () => {
  await destroyTestServer();
});

beforeEach(async () => {
  await cleanDatabase(prisma);

  const dataA = await createTenantWithData(prisma, 'tenant-a', 'Tenant A');
  tenantA = dataA.tenant;
  agentA = dataA.agent;
  rawKeyA = dataA.rawKey;
  policyA = dataA.policy;
  traceA = dataA.trace;
  approvalA = dataA.approval;
  webhookA = dataA.webhook;

  const dataB = await createTenantWithData(prisma, 'tenant-b', 'Tenant B');
  tenantB = dataB.tenant;
  agentB = dataB.agent;
  rawKeyB = dataB.rawKey;
  policyB = dataB.policy;
  traceB = dataB.trace;
  approvalB = dataB.approval;
  webhookB = dataB.webhook;
});

function authHeaders(rawKey: string) {
  return { authorization: `Bearer ${rawKey}` };
}

describe('Tenant Isolation', () => {
  describe('Agent isolation', () => {
    it('tenant A can see its own agents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(agentA.id);
    });

    it('tenant A cannot see tenant B agents via GET /agents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: authHeaders(rawKeyA),
      });
      const body = response.json();
      const ids = body.data.map((a: { id: string }) => a.id);
      expect(ids).not.toContain(agentB.id);
    });

    it('tenant A cannot see tenant B agent detail (returns 404)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentB.id}`,
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(404);
    });

    it('creating an agent automatically sets tenant_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: authHeaders(rawKeyA),
        payload: {
          name: 'Auto Tenant Agent',
          description: 'Should get tenant A id',
          owner_name: 'Owner',
          owner_role: 'Engineer',
          team: 'Platform',
          environment: 'test',
          authority_model: 'self',
          identity_mode: 'service_identity',
          delegation_model: 'self',
          autonomy_tier: 'low',
          authorized_integrations: [],
          credential_config: null,
          metadata: null,
          next_review_date: '2026-06-01T00:00:00.000Z',
          created_by: 'test',
        },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json();

      // Verify in DB that it has tenant A's id
      const dbAgent = await prisma.agent.findUnique({
        where: { id: body.data.id },
      });
      expect(dbAgent?.tenant_id).toBe(tenantA.id);
    });

    it('tenant A cannot update tenant B agent (returns 404)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentB.id}`,
        headers: authHeaders(rawKeyA),
        payload: { description: 'hacked' },
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A cannot suspend tenant B agent (returns 404)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentB.id}/suspend`,
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Policy isolation', () => {
    it('tenant A cannot see tenant B policies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: authHeaders(rawKeyA),
      });
      const body = response.json();
      const ids = body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(policyA.id);
      expect(ids).not.toContain(policyB.id);
    });

    it('tenant A cannot view tenant B policy detail (returns 404)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/policies/${policyB.id}`,
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A cannot update tenant B policy (returns 404)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policyB.id}`,
        headers: authHeaders(rawKeyA),
        payload: { policy_name: 'hacked' },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Approval isolation', () => {
    it('tenant A cannot see tenant B approvals', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals',
        headers: authHeaders(rawKeyA),
      });
      const body = response.json();
      const ids = body.data.map((a: { id: string }) => a.id);
      expect(ids).toContain(approvalA.id);
      expect(ids).not.toContain(approvalB.id);
    });

    it('tenant A cannot view tenant B approval detail (returns 404)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approvalB.id}`,
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A cannot approve tenant B request (returns 404)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approvalB.id}/approve`,
        headers: authHeaders(rawKeyA),
        payload: { approver_name: 'Attacker' },
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A cannot deny tenant B request (returns 404)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approvalB.id}/deny`,
        headers: authHeaders(rawKeyA),
        payload: { approver_name: 'Attacker' },
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A cannot poll tenant B approval status (returns 404)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approvalB.id}/status`,
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Trace isolation', () => {
    it('tenant A cannot see tenant B traces', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: authHeaders(rawKeyA),
      });
      const body = response.json();
      const ids = body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(traceA.id);
      expect(ids).not.toContain(traceB.id);
    });

    it('tenant A cannot view tenant B trace detail (returns 404)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${traceB.id}`,
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A cannot record outcome on tenant B trace (returns 404)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/traces/${traceB.id}/outcome`,
        headers: authHeaders(rawKeyA),
        payload: { status: 'success' },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Webhook isolation', () => {
    it('tenant A cannot see tenant B webhooks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/webhooks',
        headers: authHeaders(rawKeyA),
      });
      const body = response.json();
      const ids = body.data.map((w: { id: string }) => w.id);
      expect(ids).toContain(webhookA.id);
      expect(ids).not.toContain(webhookB.id);
    });

    it('tenant A cannot view tenant B webhook detail (returns 404)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/webhooks/${webhookB.id}`,
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A cannot delete tenant B webhook (returns 404)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/webhooks/${webhookB.id}`,
        headers: authHeaders(rawKeyA),
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A cannot update tenant B webhook (returns 404)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/webhooks/${webhookB.id}`,
        headers: authHeaders(rawKeyA),
        payload: { url: 'https://evil.com/steal' },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Search isolation', () => {
    it('search results only include current tenant data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search?q=Agent',
        headers: authHeaders(rawKeyA),
      });
      const body = response.json();
      // Should find Tenant A's agent, not Tenant B's
      const agentNames = body.results.agents.map((a: { name: string }) => a.name);
      expect(agentNames).toContain('Tenant A Agent');
      expect(agentNames).not.toContain('Tenant B Agent');
    });
  });

  describe('Overview isolation', () => {
    it('overview stats only reflect current tenant data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/overview',
        headers: authHeaders(rawKeyA),
      });
      const body = response.json();
      // Should only count tenant A's agents and approvals
      expect(body.stats.total_agents).toBe(1);
      expect(body.stats.pending_approvals).toBe(1);
    });
  });

  describe('Evaluate isolation', () => {
    it('tenant A cannot evaluate with tenant B agent', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: authHeaders(rawKeyA),
        payload: {
          agent_id: agentB.id,
          operation: 'read',
          target_integration: 'database',
          resource_scope: '*',
          data_classification: 'internal',
        },
      });
      expect(response.statusCode).toBe(404);
    });

    it('tenant A can evaluate with its own agent', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: authHeaders(rawKeyA),
        payload: {
          agent_id: agentA.id,
          operation: 'read',
          target_integration: 'database',
          resource_scope: '*',
          data_classification: 'internal',
        },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Cross-tenant response format', () => {
    it('all cross-tenant access returns 404 (not 403)', async () => {
      // Test multiple endpoints to ensure consistent 404 behavior
      const endpoints = [
        { method: 'GET' as const, url: `/api/v1/agents/${agentB.id}` },
        { method: 'GET' as const, url: `/api/v1/policies/${policyB.id}` },
        { method: 'GET' as const, url: `/api/v1/approvals/${approvalB.id}` },
        { method: 'GET' as const, url: `/api/v1/traces/${traceB.id}` },
        { method: 'GET' as const, url: `/api/v1/webhooks/${webhookB.id}` },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: authHeaders(rawKeyA),
        });
        expect(response.statusCode).toBe(404);
        const body = response.json();
        expect(body.error).toBe('not_found');
      }
    });
  });
});
