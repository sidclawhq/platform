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

describe('GET /api/v1/dashboard/overview', () => {
  it('returns overview stats with defaults', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.stats).toBeDefined();
    expect(body.stats.total_agents).toBe(1);
    expect(body.stats.active_agents).toBe(1);
    expect(body.stats.total_policies).toBe(0);
    expect(body.stats.pending_approvals).toBe(0);
    expect(body.stats.traces_today).toBe(0);
    expect(body.stats.traces_this_week).toBe(0);
    expect(body.stats.avg_approval_time_minutes).toBeNull();
    expect(body.pending_approvals).toEqual([]);
    expect(body.recent_traces).toEqual([]);
    expect(body.system_health).toBeDefined();
    expect(body.system_health.api).toBe('healthy');
    expect(body.system_health.database).toBe('healthy');
  });

  it('counts active agents correctly', async () => {
    // Create a suspended agent
    const agent2 = await prisma.agent.create({
      data: {
        tenant_id: testData.tenant.id,
        name: 'Suspended Agent',
        description: 'Test',
        owner_name: 'Owner',
        owner_role: 'Admin',
        team: 'Team',
        environment: 'test',
        authority_model: 'self',
        identity_mode: 'service_identity',
        delegation_model: 'self',
        autonomy_tier: 'low',
        lifecycle_state: 'suspended',
        authorized_integrations: [],
        created_by: 'test',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.stats.total_agents).toBe(2);
    expect(body.stats.active_agents).toBe(1);
  });

  it('counts policies and pending approvals', async () => {
    // Create active policy
    const rule = await prisma.policyRule.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Test Policy',
        target_integration: 'comms',
        operation: 'send',
        resource_scope: '*',
        data_classification: 'internal',
        policy_effect: 'approval_required',
        rationale: 'Needs review',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    // Create trace and pending approval
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
        data_classification: 'internal',
        authority_model: 'self',
        policy_effect: 'approval_required',
        flag_reason: 'Needs review',
        status: 'pending',
        risk_classification: 'high',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.stats.total_policies).toBe(1);
    expect(body.stats.pending_approvals).toBe(1);
    expect(body.pending_approvals).toHaveLength(1);
    expect(body.pending_approvals[0].agent_name).toBe('Test Agent');
    expect(body.pending_approvals[0].operation).toBe('send');
    expect(body.pending_approvals[0].risk_classification).toBe('high');
  });

  it('returns recent traces', async () => {
    // Create traces
    for (let i = 0; i < 12; i++) {
      await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'self',
          requested_operation: `op-${i}`,
          target_integration: 'doc_store',
          resource_scope: '*',
          started_at: new Date(Date.now() - i * 60000),
        },
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.recent_traces).toHaveLength(10);
    expect(body.recent_traces[0].operation).toBe('op-0');
  });

  it('system_health.background_jobs is stale when no jobs have run', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.system_health.background_jobs).toBe('stale');
  });

  it('system_health.background_jobs is healthy when job ran recently', async () => {
    await prisma.backgroundJob.create({
      data: {
        type: 'test_job',
        status: 'idle',
        last_run_at: new Date(),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.system_health.background_jobs).toBe('healthy');
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/v1/search', () => {
  it('returns empty results for short query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=a',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(0);
    expect(body.results.agents).toEqual([]);
    expect(body.results.traces).toEqual([]);
    expect(body.results.policies).toEqual([]);
    expect(body.results.approvals).toEqual([]);
  });

  it('returns empty results when q is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(0);
  });

  it('searches agents by name', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=Test%20Agent',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.results.agents.length).toBeGreaterThanOrEqual(1);
    expect(body.results.agents[0].name).toBe('Test Agent');
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('searches agents by owner name (case insensitive)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=test%20owner',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.results.agents.length).toBeGreaterThanOrEqual(1);
  });

  it('searches traces by operation', async () => {
    await prisma.auditTrace.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        authority_model: 'self',
        requested_operation: 'send_email',
        target_integration: 'comms',
        resource_scope: '*',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=send_email',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.results.traces.length).toBeGreaterThanOrEqual(1);
    expect(body.results.traces[0].operation).toBe('send_email');
  });

  it('searches policies by name', async () => {
    await prisma.policyRule.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Email Security Policy',
        target_integration: 'comms',
        operation: 'send',
        resource_scope: '*',
        data_classification: 'internal',
        policy_effect: 'allow',
        rationale: 'Allowed',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=Email%20Security',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.results.policies.length).toBeGreaterThanOrEqual(1);
    expect(body.results.policies[0].policy_name).toBe('Email Security Policy');
  });

  it('searches approvals by operation', async () => {
    const rule = await prisma.policyRule.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Test',
        target_integration: 'comms',
        operation: 'send',
        resource_scope: '*',
        data_classification: 'internal',
        policy_effect: 'approval_required',
        rationale: 'Review',
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
        requested_operation: 'deploy_production',
        target_integration: 'ci_cd',
        resource_scope: '*',
      },
    });

    await prisma.approvalRequest.create({
      data: {
        tenant_id: testData.tenant.id,
        trace_id: trace.id,
        agent_id: testData.agent.id,
        policy_rule_id: rule.id,
        requested_operation: 'deploy_production',
        target_integration: 'ci_cd',
        resource_scope: '*',
        data_classification: 'internal',
        authority_model: 'self',
        policy_effect: 'approval_required',
        flag_reason: 'Review',
        status: 'pending',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=deploy_production',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.results.approvals.length).toBeGreaterThanOrEqual(1);
    expect(body.results.approvals[0].operation).toBe('deploy_production');
  });

  it('limits results to 5 per category', async () => {
    // Create 7 agents
    for (let i = 0; i < 7; i++) {
      await prisma.agent.create({
        data: {
          tenant_id: testData.tenant.id,
          name: `Searchable Agent ${i}`,
          description: 'Test',
          owner_name: 'Owner',
          owner_role: 'Admin',
          team: 'Team',
          environment: 'test',
          authority_model: 'self',
          identity_mode: 'service_identity',
          delegation_model: 'self',
          autonomy_tier: 'low',
          lifecycle_state: 'active',
          authorized_integrations: [],
          created_by: 'test',
        },
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=Searchable',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.results.agents).toHaveLength(5);
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=test',
    });

    expect(response.statusCode).toBe(401);
  });
});
