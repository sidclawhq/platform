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

// Helper: create approval policy and evaluate to get a pending approval
async function createApprovalPolicy(policyId = 'pol-approval-001') {
  await prisma.policyRule.create({
    data: {
      id: policyId,
      tenant_id: testData.tenant.id,
      agent_id: testData.agent.id,
      policy_name: 'Require approval for send on comms',
      target_integration: 'communications_service',
      operation: 'send',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Requires human review',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'test',
    },
  });
}

async function evaluateForApproval(): Promise<{
  trace_id: string;
  approval_request_id: string;
}> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/evaluate',
    headers: { authorization: `Bearer ${testData.rawApiKey}` },
    payload: {
      agent_id: testData.agent.id,
      operation: 'send',
      target_integration: 'communications_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
    },
  });
  const body = response.json();
  return { trace_id: body.trace_id, approval_request_id: body.approval_request_id };
}

describe('Approval Service', () => {
  describe('POST /api/v1/approvals/:id/approve', () => {
    beforeEach(async () => {
      await createApprovalPolicy();
    });

    it('approves a pending request and returns enriched context', async () => {
      const { approval_request_id } = await evaluateForApproval();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe(approval_request_id);
      expect(body.status).toBe('approved');
      expect(body.approver_name).toBe('Security Reviewer');
      expect(body.agent).toBeDefined();
      expect(body.agent.name).toBe('Test Agent');
      expect(body.policy_rule).toBeDefined();
      expect(body.policy_rule.policy_name).toBe('Require approval for send on comms');
      expect(body.trace_events).toBeDefined();
      expect(body.trace_events.length).toBeGreaterThan(0);
    });

    it('sets separation_of_duties_check to pass', async () => {
      const { approval_request_id } = await evaluateForApproval();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      const body = response.json();
      expect(body.separation_of_duties_check).toBe('pass');

      // Verify in DB too
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: approval_request_id },
      });
      expect(approval!.separation_of_duties_check).toBe('pass');
    });

    it('creates approval_granted audit event with approver name', async () => {
      const { approval_request_id, trace_id } = await evaluateForApproval();

      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      const events = await prisma.auditEvent.findMany({
        where: { trace_id, event_type: 'approval_granted' },
      });
      expect(events).toHaveLength(1);
      expect(events[0]!.actor_name).toBe('Security Reviewer');
      expect(events[0]!.actor_type).toBe('human_reviewer');
      expect(events[0]!.status).toBe('approved');
    });

    it('keeps trace in in_progress state (agent still needs to execute)', async () => {
      const { approval_request_id, trace_id } = await evaluateForApproval();

      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      const trace = await prisma.auditTrace.findUnique({ where: { id: trace_id } });
      expect(trace!.final_outcome).toBe('in_progress');
      expect(trace!.completed_at).toBeNull();
    });

    it('returns 409 when approval is already decided', async () => {
      const { approval_request_id } = await evaluateForApproval();

      // First approve
      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      // Second approve attempt
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Another Reviewer' },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error).toBe('conflict');
    });

    it('returns 403 when approver is the agent owner (separation of duties)', async () => {
      const { approval_request_id } = await evaluateForApproval();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Test Owner' }, // same as agent.owner_name
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('separation_of_duties_violation');

      // Verify separation_of_duties_check is set to fail
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: approval_request_id },
      });
      expect(approval!.separation_of_duties_check).toBe('fail');
      // Status should still be pending (not approved)
      expect(approval!.status).toBe('pending');
    });

    it('returns 404 for non-existent approval', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/approvals/non-existent-id/approve',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('includes decision_note in audit event when provided', async () => {
      const { approval_request_id, trace_id } = await evaluateForApproval();

      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          approver_name: 'Security Reviewer',
          decision_note: 'Reviewed and verified safe',
        },
      });

      const events = await prisma.auditEvent.findMany({
        where: { trace_id, event_type: 'approval_granted' },
      });
      expect(events[0]!.description).toContain('Reviewed and verified safe');

      // Also verify decision_note is saved on the approval
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: approval_request_id },
      });
      expect(approval!.decision_note).toBe('Reviewed and verified safe');
    });
  });

  describe('POST /api/v1/approvals/:id/deny', () => {
    beforeEach(async () => {
      await createApprovalPolicy();
    });

    it('denies a pending request and returns enriched context', async () => {
      const { approval_request_id } = await evaluateForApproval();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/deny`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer', decision_note: 'Too risky' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe(approval_request_id);
      expect(body.status).toBe('denied');
      expect(body.approver_name).toBe('Security Reviewer');
      expect(body.decision_note).toBe('Too risky');
      expect(body.agent).toBeDefined();
      expect(body.policy_rule).toBeDefined();
      expect(body.trace_events).toBeDefined();
    });

    it('creates approval_denied and trace_closed audit events', async () => {
      const { approval_request_id, trace_id } = await evaluateForApproval();

      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/deny`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      const events = await prisma.auditEvent.findMany({
        where: { trace_id },
        orderBy: { timestamp: 'asc' },
      });
      const eventTypes = events.map(e => e.event_type);
      expect(eventTypes).toContain('approval_denied');
      expect(eventTypes).toContain('trace_closed');

      // approval_denied should come before trace_closed
      const deniedIndex = eventTypes.indexOf('approval_denied');
      const closedIndex = eventTypes.indexOf('trace_closed');
      expect(deniedIndex).toBeLessThan(closedIndex);
    });

    it('finalizes trace with final_outcome: denied and completed_at', async () => {
      const { approval_request_id, trace_id } = await evaluateForApproval();

      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/deny`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      const trace = await prisma.auditTrace.findUnique({ where: { id: trace_id } });
      expect(trace!.final_outcome).toBe('denied');
      expect(trace!.completed_at).not.toBeNull();
    });

    it('returns 409 when approval is already decided', async () => {
      const { approval_request_id } = await evaluateForApproval();

      // First deny
      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/deny`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      // Second deny attempt
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/deny`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Another Reviewer' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('returns 404 for non-existent approval', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/approvals/non-existent-id/deny',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/approvals/:id', () => {
    beforeEach(async () => {
      await createApprovalPolicy();
    });

    it('returns approval with full context: agent, policy_rule, trace_events', async () => {
      const { approval_request_id } = await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approval_request_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Approval fields
      expect(body.id).toBe(approval_request_id);
      expect(body.status).toBe('pending');
      expect(body.requested_operation).toBe('send');
      expect(body.target_integration).toBe('communications_service');

      // Agent context
      expect(body.agent.id).toBe(testData.agent.id);
      expect(body.agent.name).toBe('Test Agent');
      expect(body.agent.owner_name).toBe('Test Owner');
      expect(body.agent.authority_model).toBe('self');

      // Policy rule context
      expect(body.policy_rule.id).toBe('pol-approval-001');
      expect(body.policy_rule.policy_name).toBe('Require approval for send on comms');
      expect(body.policy_rule.rationale).toBe('Requires human review');

      // Trace events
      expect(body.trace_events).toBeDefined();
      expect(body.trace_events.length).toBeGreaterThan(0);
    });

    it('trace_events are in chronological order', async () => {
      const { approval_request_id } = await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approval_request_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      const timestamps = body.trace_events.map((e: { timestamp: string }) => new Date(e.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it('returns 404 for non-existent approval', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals/non-existent-id',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/approvals?status=pending', () => {
    beforeEach(async () => {
      await createApprovalPolicy();
    });

    it('returns only pending approvals', async () => {
      // Create two approvals
      const { approval_request_id: id1 } = await evaluateForApproval();
      const { approval_request_id: id2 } = await evaluateForApproval();

      // Approve the first one
      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${id1}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      // Query for pending only
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals?status=pending',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(id2);
      expect(body.pagination.total).toBe(1);
    });

    it('returns paginated results with total count', async () => {
      // Create 3 approvals
      await evaluateForApproval();
      await evaluateForApproval();
      await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals?limit=2&offset=0',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.offset).toBe(0);
    });

    it('filters by agent_id', async () => {
      // Create a second agent
      const otherAgent = await prisma.agent.create({
        data: {
          id: 'other-agent',
          tenant_id: testData.tenant.id,
          name: 'Other Agent',
          description: 'Another agent',
          owner_name: 'Other Owner',
          owner_role: 'Other Role',
          team: 'Other Team',
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

      // Create a policy for the other agent
      await prisma.policyRule.create({
        data: {
          id: 'pol-other-001',
          tenant_id: testData.tenant.id,
          agent_id: otherAgent.id,
          policy_name: 'Require approval',
          target_integration: 'communications_service',
          operation: 'send',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
          policy_effect: 'approval_required',
          rationale: 'Needs review',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });

      // Create approvals for both agents
      await evaluateForApproval(); // uses testData.agent

      // Evaluate for other agent
      await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: otherAgent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      // Filter by original agent_id
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals?agent_id=${testData.agent.id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].agent_id).toBe(testData.agent.id);
    });

    it('orders by requested_at descending', async () => {
      await evaluateForApproval();
      await evaluateForApproval();
      await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      const dates = body.data.map((d: { requested_at: string }) => new Date(d.requested_at).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    it('respects limit and offset', async () => {
      await evaluateForApproval();
      await evaluateForApproval();
      await evaluateForApproval();

      // Get page 2 with limit 1
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals?limit=1&offset=1',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.limit).toBe(1);
      expect(body.pagination.offset).toBe(1);
    });
  });

  describe('Approval list metadata', () => {
    beforeEach(async () => {
      await createApprovalPolicy();
    });

    it('returns time_pending_seconds for each approval', async () => {
      await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals?status=pending',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(typeof body.data[0].time_pending_seconds).toBe('number');
      expect(body.data[0].time_pending_seconds).toBeGreaterThanOrEqual(0);
    });

    it('returns meta.count_by_risk with correct counts', async () => {
      // Create multiple approvals (all will have same risk since same operation)
      await evaluateForApproval();
      await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals?status=pending',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.meta).toBeDefined();
      expect(body.meta.count_by_risk).toBeDefined();
      expect(typeof body.meta.count_by_risk.low).toBe('number');
      expect(typeof body.meta.count_by_risk.medium).toBe('number');
      expect(typeof body.meta.count_by_risk.high).toBe('number');
      expect(typeof body.meta.count_by_risk.critical).toBe('number');

      // Sum of risk counts should match pending total
      const totalRisk =
        body.meta.count_by_risk.low +
        body.meta.count_by_risk.medium +
        body.meta.count_by_risk.high +
        body.meta.count_by_risk.critical;
      expect(totalRisk).toBe(body.pagination.total);
    });

    it('returns meta.oldest_pending_seconds', async () => {
      await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals?status=pending',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.meta.oldest_pending_seconds).not.toBeNull();
      expect(typeof body.meta.oldest_pending_seconds).toBe('number');
      expect(body.meta.oldest_pending_seconds).toBeGreaterThanOrEqual(0);
    });

    it('meta values are null/zero when no pending approvals', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals?status=pending',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.data).toHaveLength(0);
      expect(body.meta.oldest_pending_seconds).toBeNull();
      expect(body.meta.count_by_risk.low).toBe(0);
      expect(body.meta.count_by_risk.medium).toBe(0);
      expect(body.meta.count_by_risk.high).toBe(0);
      expect(body.meta.count_by_risk.critical).toBe(0);
    });
  });

  describe('GET /api/v1/approvals/count', () => {
    beforeEach(async () => {
      await createApprovalPolicy();
    });

    it('returns count of pending approvals', async () => {
      await evaluateForApproval();
      await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals/count?status=pending',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.count).toBe(2);
    });

    it('filters by status parameter', async () => {
      const { approval_request_id } = await evaluateForApproval();
      await evaluateForApproval();

      // Approve one
      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      // Count pending — should be 1
      const pendingResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals/count?status=pending',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      expect(pendingResponse.json().count).toBe(1);

      // Count approved — should be 1
      const approvedResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals/count?status=approved',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      expect(approvedResponse.json().count).toBe(1);
    });

    it('returns 0 when no matching approvals', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals/count?status=pending',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBe(0);
    });
  });

  describe('full flow: evaluate → approve → outcome', () => {
    it('SDK evaluate → API returns approval_required → approve → SDK records outcome → trace finalized', async () => {
      // 1. Create policy that requires approval
      await createApprovalPolicy();

      // 2. POST /evaluate → get approval_request_id
      const evalResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      expect(evalResponse.statusCode).toBe(200);
      const evalBody = evalResponse.json();
      expect(evalBody.decision).toBe('approval_required');
      expect(evalBody.approval_request_id).toBeDefined();
      expect(evalBody.trace_id).toBeDefined();

      const { trace_id, approval_request_id } = evalBody;

      // 3. GET /approvals/:id/status → pending
      const statusResponse1 = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approval_request_id}/status`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      expect(statusResponse1.json().status).toBe('pending');

      // 4. POST /approvals/:id/approve
      const approveResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          approver_name: 'Security Reviewer',
          decision_note: 'Approved after review',
        },
      });

      expect(approveResponse.statusCode).toBe(200);
      const approveBody = approveResponse.json();
      expect(approveBody.status).toBe('approved');
      expect(approveBody.separation_of_duties_check).toBe('pass');

      // 5. GET /approvals/:id/status → approved
      const statusResponse2 = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approval_request_id}/status`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      expect(statusResponse2.json().status).toBe('approved');

      // Verify trace is still in_progress (agent hasn't executed yet)
      const traceBeforeOutcome = await prisma.auditTrace.findUnique({ where: { id: trace_id } });
      expect(traceBeforeOutcome!.final_outcome).toBe('in_progress');

      // 6. POST /traces/:traceId/outcome → success
      const outcomeResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/traces/${trace_id}/outcome`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { status: 'success' },
      });
      expect(outcomeResponse.statusCode).toBe(204);

      // 7. Verify trace: final_outcome = completed_with_approval
      const finalTrace = await prisma.auditTrace.findUnique({ where: { id: trace_id } });
      expect(finalTrace!.final_outcome).toBe('completed_with_approval');
      expect(finalTrace!.completed_at).not.toBeNull();

      // 8. Verify all events in correct order
      const allEvents = await prisma.auditEvent.findMany({
        where: { trace_id },
        orderBy: { timestamp: 'asc' },
      });
      const eventTypes = allEvents.map(e => e.event_type);
      expect(eventTypes).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'sensitive_operation_detected',
        'approval_requested',
        'approval_granted',
        'operation_executed',
        'trace_closed',
      ]);

      // Verify approval_granted event details
      const approvalEvent = allEvents.find(e => e.event_type === 'approval_granted')!;
      expect(approvalEvent.actor_type).toBe('human_reviewer');
      expect(approvalEvent.actor_name).toBe('Security Reviewer');
      expect(approvalEvent.description).toContain('Approved after review');
      expect(approvalEvent.approval_request_id).toBe(approval_request_id);

      // Verify operation_executed event
      const executedEvent = allEvents.find(e => e.event_type === 'operation_executed')!;
      expect(executedEvent.status).toBe('success');

      // Verify trace_closed event
      const closedEvent = allEvents.find(e => e.event_type === 'trace_closed')!;
      expect(closedEvent.description).toContain('completed_with_approval');
    });
  });
});
