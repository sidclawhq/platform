import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import { expireApprovals } from '../../jobs/expire-approvals.js';
import { cleanupTraces } from '../../jobs/trace-cleanup.js';
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

/** Helper: create a policy rule, trace, and pending approval request */
async function createPendingApproval(overrides?: {
  expiresAt?: Date;
  tenantId?: string;
  agentId?: string;
}) {
  const tenantId = overrides?.tenantId ?? testData.tenant.id;
  const agentId = overrides?.agentId ?? testData.agent.id;

  const rule = await prisma.policyRule.create({
    data: {
      tenant_id: tenantId,
      agent_id: agentId,
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
      tenant_id: tenantId,
      agent_id: agentId,
      authority_model: 'self',
      requested_operation: 'send',
      target_integration: 'comms',
      resource_scope: '*',
    },
  });

  const approval = await prisma.approvalRequest.create({
    data: {
      tenant_id: tenantId,
      trace_id: trace.id,
      agent_id: agentId,
      policy_rule_id: rule.id,
      requested_operation: 'send',
      target_integration: 'comms',
      resource_scope: '*',
      data_classification: 'confidential',
      authority_model: 'self',
      policy_effect: 'approval_required',
      flag_reason: 'Needs review',
      status: 'pending',
      expires_at: overrides?.expiresAt ?? new Date(Date.now() - 60000), // default: already expired
    },
  });

  return { rule, trace, approval };
}

describe('Approval Expiration', () => {
  it('expires approval past its TTL when job runs', async () => {
    const { approval } = await createPendingApproval({
      expiresAt: new Date(Date.now() - 60000), // 1 minute ago
    });

    await expireApprovals();

    const updated = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    expect(updated!.status).toBe('expired');
    expect(updated!.decided_at).toBeDefined();
  });

  it('creates approval_expired and trace_closed audit events', async () => {
    const { approval, trace } = await createPendingApproval();

    await expireApprovals();

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: trace.id },
      orderBy: { timestamp: 'asc' },
    });

    const expiredEvent = events.find(e => e.event_type === 'approval_expired');
    expect(expiredEvent).toBeDefined();
    expect(expiredEvent!.approval_request_id).toBe(approval.id);
    expect(expiredEvent!.actor_type).toBe('system');
    expect(expiredEvent!.actor_name).toBe('Approval Expiry Job');
    expect(expiredEvent!.status).toBe('expired');

    const closedEvent = events.find(e => e.event_type === 'trace_closed');
    expect(closedEvent).toBeDefined();
    expect(closedEvent!.status).toBe('closed');
  });

  it('sets trace final_outcome to expired', async () => {
    const { trace } = await createPendingApproval();

    await expireApprovals();

    const updated = await prisma.auditTrace.findUnique({ where: { id: trace.id } });
    expect(updated!.final_outcome).toBe('expired');
    expect(updated!.completed_at).toBeDefined();
  });

  it('expired approval returns 409 on approve attempt', async () => {
    const { approval } = await createPendingApproval();
    await expireApprovals();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${approval.id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Reviewer' },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.message).toContain('expired');
  });

  it('expired approval returns 409 on deny attempt', async () => {
    const { approval } = await createPendingApproval();
    await expireApprovals();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${approval.id}/deny`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Reviewer' },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.message).toContain('expired');
  });

  it('does not expire approvals that have not reached TTL', async () => {
    const { approval } = await createPendingApproval({
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    });

    await expireApprovals();

    const updated = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    expect(updated!.status).toBe('pending');
  });

  it('processes in batches (test with >100 expired)', async () => {
    // Create 105 expired approvals
    const rule = await prisma.policyRule.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Batch test policy',
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

    for (let i = 0; i < 105; i++) {
      const trace = await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'self',
          requested_operation: `send-${i}`,
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
          requested_operation: `send-${i}`,
          target_integration: 'comms',
          resource_scope: '*',
          data_classification: 'confidential',
          authority_model: 'self',
          policy_effect: 'approval_required',
          flag_reason: 'Needs review',
          status: 'pending',
          expires_at: new Date(Date.now() - 60000),
        },
      });
    }

    // First run processes up to 100
    await expireApprovals();

    const expiredCount = await prisma.approvalRequest.count({
      where: { status: 'expired' },
    });
    expect(expiredCount).toBe(100);

    // Second run processes remaining 5
    await expireApprovals();

    const finalCount = await prisma.approvalRequest.count({
      where: { status: 'expired' },
    });
    expect(finalCount).toBe(105);
  });
});

describe('Trace Retention', () => {
  it('soft-deletes old traces for free-plan tenants', async () => {
    // Create a free-plan tenant
    const freeTenant = await prisma.tenant.create({
      data: {
        name: 'Free Workspace',
        slug: 'free-test',
        plan: 'free',
        settings: { trace_retention_days: 7 },
      },
    });

    const agent = await prisma.agent.create({
      data: {
        tenant_id: freeTenant.id,
        name: 'Free Agent',
        description: 'Test',
        owner_name: 'Owner',
        owner_role: 'Role',
        team: 'Team',
        authority_model: 'self',
        identity_mode: 'service_identity',
        delegation_model: 'self',
        created_by: 'test',
      },
    });

    // Create an old trace (10 days ago)
    const oldTrace = await prisma.auditTrace.create({
      data: {
        tenant_id: freeTenant.id,
        agent_id: agent.id,
        authority_model: 'self',
        requested_operation: 'read',
        target_integration: 'docs',
        resource_scope: '*',
        started_at: new Date(Date.now() - 10 * 86400000),
        final_outcome: 'executed',
        completed_at: new Date(Date.now() - 10 * 86400000 + 1000),
      },
    });

    await prisma.auditEvent.create({
      data: {
        tenant_id: freeTenant.id,
        trace_id: oldTrace.id,
        agent_id: agent.id,
        event_type: 'trace_initiated',
        actor_type: 'agent',
        actor_name: 'Free Agent',
        description: 'Test event',
        status: 'started',
      },
    });

    await cleanupTraces();

    const trace = await prisma.auditTrace.findUnique({ where: { id: oldTrace.id } });
    expect(trace!.deleted_at).not.toBeNull();

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: oldTrace.id },
    });
    expect(events.every(e => e.deleted_at !== null)).toBe(true);
  });

  it('does not delete traces for enterprise-plan tenants', async () => {
    // Default test tenant is enterprise plan
    // Create an old trace
    const oldTrace = await prisma.auditTrace.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        authority_model: 'self',
        requested_operation: 'read',
        target_integration: 'docs',
        resource_scope: '*',
        started_at: new Date(Date.now() - 30 * 86400000),
        final_outcome: 'executed',
        completed_at: new Date(Date.now() - 30 * 86400000 + 1000),
      },
    });

    await cleanupTraces();

    const trace = await prisma.auditTrace.findUnique({ where: { id: oldTrace.id } });
    expect(trace!.deleted_at).toBeNull();
  });

  it('does not delete traces with pending approvals', async () => {
    const freeTenant = await prisma.tenant.create({
      data: {
        name: 'Free Workspace 2',
        slug: 'free-test-2',
        plan: 'free',
        settings: { trace_retention_days: 7 },
      },
    });

    const agent = await prisma.agent.create({
      data: {
        tenant_id: freeTenant.id,
        name: 'Free Agent 2',
        description: 'Test',
        owner_name: 'Owner',
        owner_role: 'Role',
        team: 'Team',
        authority_model: 'self',
        identity_mode: 'service_identity',
        delegation_model: 'self',
        created_by: 'test',
      },
    });

    const rule = await prisma.policyRule.create({
      data: {
        tenant_id: freeTenant.id,
        agent_id: agent.id,
        policy_name: 'Test',
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

    // Old trace with pending approval
    const oldTrace = await prisma.auditTrace.create({
      data: {
        tenant_id: freeTenant.id,
        agent_id: agent.id,
        authority_model: 'self',
        requested_operation: 'send',
        target_integration: 'comms',
        resource_scope: '*',
        started_at: new Date(Date.now() - 10 * 86400000),
        final_outcome: 'in_progress', // still in progress because pending approval
      },
    });

    await prisma.approvalRequest.create({
      data: {
        tenant_id: freeTenant.id,
        trace_id: oldTrace.id,
        agent_id: agent.id,
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

    await cleanupTraces();

    // The trace with in_progress outcome is excluded by the notIn filter,
    // but even if it had a different outcome, it should be protected by
    // the pending approval check.
    const trace = await prisma.auditTrace.findUnique({ where: { id: oldTrace.id } });
    expect(trace!.deleted_at).toBeNull();
  });

  it('soft-deleted traces excluded from API queries', async () => {
    // Create a trace and soft-delete it
    const trace = await prisma.auditTrace.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        authority_model: 'self',
        requested_operation: 'read',
        target_integration: 'docs',
        resource_scope: '*',
        final_outcome: 'executed',
        completed_at: new Date(),
        deleted_at: new Date(), // soft-deleted
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/traces',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const traceIds = body.data.map((t: { id: string }) => t.id);
    expect(traceIds).not.toContain(trace.id);
  });

  it('soft-deleted events excluded from API queries', async () => {
    // Create a trace with a soft-deleted event
    const trace = await prisma.auditTrace.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        authority_model: 'self',
        requested_operation: 'read',
        target_integration: 'docs',
        resource_scope: '*',
        final_outcome: 'executed',
        completed_at: new Date(),
      },
    });

    const event = await prisma.auditEvent.create({
      data: {
        tenant_id: testData.tenant.id,
        trace_id: trace.id,
        agent_id: testData.agent.id,
        event_type: 'trace_initiated',
        actor_type: 'agent',
        actor_name: 'Test Agent',
        description: 'Should be hidden',
        status: 'started',
        deleted_at: new Date(), // soft-deleted
      },
    });

    // Also create a visible event
    await prisma.auditEvent.create({
      data: {
        tenant_id: testData.tenant.id,
        trace_id: trace.id,
        agent_id: testData.agent.id,
        event_type: 'trace_closed',
        actor_type: 'system',
        actor_name: 'Trace Service',
        description: 'Should be visible',
        status: 'closed',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${trace.id}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const eventIds = body.events.map((e: { id: string }) => e.id);
    expect(eventIds).not.toContain(event.id);
    expect(body.events).toHaveLength(1);
  });
});
