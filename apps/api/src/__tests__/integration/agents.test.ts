import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let testData: Awaited<ReturnType<typeof seedTestData>>;

const VALID_AGENT_BODY = {
  name: 'New Agent',
  description: 'A new test agent',
  owner_name: 'Alice',
  owner_role: 'Engineer',
  team: 'Platform',
  environment: 'dev',
  authority_model: 'self',
  identity_mode: 'service_identity',
  delegation_model: 'self',
  autonomy_tier: 'low',
  authorized_integrations: [],
  credential_config: null,
  metadata: null,
  next_review_date: '2026-06-01T00:00:00.000Z',
  created_by: 'test-user',
};

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
  testData = await seedTestData(prisma);
});

describe('POST /api/v1/agents', () => {
  it('creates agent with lifecycle_state = active', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: VALID_AGENT_BODY,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.name).toBe('New Agent');
    expect(body.data.lifecycle_state).toBe('active');
    expect(body.data.id).toBeDefined();
  });

  it('ignores lifecycle_state in request body (always active)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { ...VALID_AGENT_BODY, lifecycle_state: 'suspended' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.lifecycle_state).toBe('active');
  });

  it('returns 400 for missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { name: 'Incomplete Agent' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('validation_error');
  });

  it('validates authorized_integrations JSON structure', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        ...VALID_AGENT_BODY,
        authorized_integrations: [{ invalid: true }],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('validation_error');
  });
});

describe('GET /api/v1/agents', () => {
  it('returns paginated list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.offset).toBe(0);
  });

  it('filters by environment', async () => {
    // Seed agent has environment 'test', create one with 'prod'
    await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { ...VALID_AGENT_BODY, environment: 'prod', name: 'Prod Agent' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents?environment=prod',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.every((a: { environment: string }) => a.environment === 'prod')).toBe(true);
    expect(body.pagination.total).toBe(1);
  });

  it('filters by lifecycle_state', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents?lifecycle_state=active',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.every((a: { lifecycle_state: string }) => a.lifecycle_state === 'active')).toBe(true);
  });

  it('filters by authority_model', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { ...VALID_AGENT_BODY, authority_model: 'delegated', name: 'Delegated Agent' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents?authority_model=delegated',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.every((a: { authority_model: string }) => a.authority_model === 'delegated')).toBe(true);
    expect(body.pagination.total).toBe(1);
  });

  it('filters by autonomy_tier', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { ...VALID_AGENT_BODY, autonomy_tier: 'high', name: 'High Autonomy Agent' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents?autonomy_tier=high',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.every((a: { autonomy_tier: string }) => a.autonomy_tier === 'high')).toBe(true);
    expect(body.pagination.total).toBe(1);
  });

  it('search by agent name (case insensitive)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents?search=test%20agent',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].name.toLowerCase()).toContain('test agent');
  });

  it('search by owner name (case insensitive)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents?search=test%20owner',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no agents match', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents?environment=prod',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it('respects limit and offset', async () => {
    // Create 3 more agents (seed has 1 already)
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { ...VALID_AGENT_BODY, name: `Agent ${i}` },
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents?limit=2&offset=1',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(4);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.offset).toBe(1);
  });
});

describe('GET /api/v1/agents/:id', () => {
  it('returns agent with stats and recent activity', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${testData.agent.id}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.id).toBe(testData.agent.id);
    expect(body.data.stats).toBeDefined();
    expect(body.data.stats.policy_count).toBeDefined();
    expect(body.data.stats.pending_approvals).toBeDefined();
    expect(body.data.stats.traces_last_7_days).toBeDefined();
    expect(body.data.stats.last_activity_at).toBeDefined();
    expect(body.data.recent_traces).toBeInstanceOf(Array);
    expect(body.data.recent_approvals).toBeInstanceOf(Array);
  });

  it('stats.policy_count shows correct counts by effect', async () => {
    // Create policies of different effects
    await prisma.policyRule.createMany({
      data: [
        {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Allow 1',
          target_integration: 'doc_store',
          operation: 'read',
          resource_scope: '*',
          data_classification: 'internal',
          policy_effect: 'allow',
          rationale: 'Allowed',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
        {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Allow 2',
          target_integration: 'doc_store',
          operation: 'write',
          resource_scope: '*',
          data_classification: 'internal',
          policy_effect: 'allow',
          rationale: 'Allowed',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
        {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Deny 1',
          target_integration: 'crm',
          operation: 'delete',
          resource_scope: '*',
          data_classification: 'restricted',
          policy_effect: 'deny',
          rationale: 'Denied',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${testData.agent.id}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.stats.policy_count.allow).toBe(2);
    expect(body.data.stats.policy_count.deny).toBe(1);
    expect(body.data.stats.policy_count.approval_required).toBe(0);
  });

  it('stats.pending_approvals is accurate', async () => {
    // Create a policy rule, trace, and pending approval
    const rule = await prisma.policyRule.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Require approval',
        target_integration: 'comms',
        operation: 'send',
        resource_scope: '*',
        data_classification: 'confidential',
        policy_effect: 'approval_required',
        rationale: 'Needs review',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    const trace = await prisma.auditTrace.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        authority_model: 'self',
        requested_operation: 'send',
        target_integration: 'comms',
        resource_scope: '*',
      },
    });

    await prisma.approvalRequest.create({
      data: {
        tenant_id: testData.tenant.id,
        trace_id: trace.id,
        agent_id: testData.agent.id,
        policy_rule_id: rule.id,
        requested_operation: 'send',
        target_integration: 'comms',
        resource_scope: '*',
        data_classification: 'confidential',
        authority_model: 'self',
        policy_effect: 'approval_required',
        flag_reason: 'Needs review',
        status: 'pending',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${testData.agent.id}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.stats.pending_approvals).toBe(1);
  });

  it('recent_traces returns last 10 ordered by date', async () => {
    // Create 12 traces
    for (let i = 0; i < 12; i++) {
      await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'self',
          requested_operation: `op-${i}`,
          target_integration: 'doc_store',
          resource_scope: '*',
          started_at: new Date(Date.now() - i * 60000), // each 1 min apart
        },
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${testData.agent.id}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.data.recent_traces).toHaveLength(10);
    // Should be ordered by date descending (most recent first)
    const dates = body.data.recent_traces.map((t: { started_at: string }) => new Date(t.started_at).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it('returns 404 for non-existent agent', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents/non-existent-id',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error).toBe('not_found');
  });
});

describe('PATCH /api/v1/agents/:id', () => {
  it('updates agent metadata', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/agents/${testData.agent.id}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { description: 'Updated description' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.description).toBe('Updated description');
    expect(body.data.id).toBe(testData.agent.id);
  });

  it('cannot change lifecycle_state via PATCH', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/agents/${testData.agent.id}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { lifecycle_state: 'revoked', description: 'Sneaky update' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // lifecycle_state should remain unchanged
    expect(body.data.lifecycle_state).toBe('active');
    // but description should be updated
    expect(body.data.description).toBe('Sneaky update');
  });

  it('returns 404 for non-existent agent', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/agents/non-existent-id',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { description: 'Update' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Lifecycle transitions', () => {
  it('active → suspended (via POST /suspend)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/suspend`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.lifecycle_state).toBe('suspended');
  });

  it('suspended → active (via POST /reactivate)', async () => {
    // First suspend
    await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/suspend`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    // Then reactivate
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/reactivate`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.lifecycle_state).toBe('active');
  });

  it('active → revoked (via POST /revoke)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/revoke`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.lifecycle_state).toBe('revoked');
  });

  it('suspended → revoked (via POST /revoke)', async () => {
    // First suspend
    await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/suspend`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    // Then revoke
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/revoke`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.lifecycle_state).toBe('revoked');
  });

  it('revoked → anything returns 400 invalid_lifecycle_transition', async () => {
    // Revoke first
    await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/revoke`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    // Try to reactivate
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/reactivate`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.details.error).toBe('invalid_lifecycle_transition');
    expect(body.details.current_state).toBe('revoked');
    expect(body.details.valid_transitions).toEqual([]);
  });

  it('active → reactivate returns 400 (already active)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/reactivate`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.details.error).toBe('invalid_lifecycle_transition');
  });

  it('each transition creates an audit event', async () => {
    // Suspend
    const suspendResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/suspend`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const suspendBody = suspendResponse.json();
    expect(suspendBody.event).toBeDefined();
    expect(suspendBody.event.event_type).toBe('lifecycle_changed');
    expect(suspendBody.event.status).toBe('suspended');

    // Verify the audit event is persisted
    const events = await prisma.auditEvent.findMany({
      where: {
        agent_id: testData.agent.id,
        event_type: 'lifecycle_changed',
      },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const metadata = events[0]!.metadata as Record<string, unknown>;
    expect(metadata.previous_state).toBe('active');
    expect(metadata.new_state).toBe('suspended');
    expect(metadata.action).toBe('suspend');
  });

  it('revoked agent is denied by policy engine', async () => {
    // Create a policy that would normally allow the action
    await prisma.policyRule.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Allow read',
        target_integration: 'document_store',
        operation: 'read',
        resource_scope: '*',
        data_classification: 'internal',
        policy_effect: 'allow',
        rationale: 'Read allowed',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    // Revoke the agent
    await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/revoke`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    // Try to evaluate — should be denied
    const evalResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'read',
        target_integration: 'document_store',
        resource_scope: 'internal_docs',
        data_classification: 'internal',
      },
    });

    expect(evalResponse.statusCode).toBe(200);
    const body = evalResponse.json();
    expect(body.decision).toBe('deny');
    expect(body.reason).toContain('revoked');
  });
});
