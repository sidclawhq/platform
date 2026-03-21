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

describe('POST /api/v1/evaluate', () => {
  describe('allow decision', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-allow-001',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Allow read on document_store',
          target_integration: 'document_store',
          operation: 'read',
          resource_scope: '*',
          data_classification: 'internal',
          policy_effect: 'allow',
          rationale: 'Read access permitted',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });
    });

    it('returns decision: allow with trace_id', async () => {
      const response = await app.inject({
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

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.decision).toBe('allow');
      expect(body.trace_id).toBeDefined();
      expect(body.approval_request_id).toBeNull();
      expect(body.reason).toBe('Read access permitted');
      expect(body.policy_rule_id).toBe('pol-allow-001');
    });

    it('creates AuditTrace with final_outcome: in_progress', async () => {
      const response = await app.inject({
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

      const body = response.json();
      const trace = await prisma.auditTrace.findUnique({ where: { id: body.trace_id } });
      expect(trace).toBeDefined();
      // Allow traces are auto-closed with 'executed' outcome
      expect(trace!.final_outcome).toBe('executed');
      expect(trace!.completed_at).not.toBeNull();
    });

    it('creates audit events: trace_initiated -> identity_resolved -> policy_evaluated -> operation_allowed', async () => {
      const response = await app.inject({
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

      const body = response.json();
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: body.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      // Allow traces now include auto-close trace_closed event
      expect(events.map(e => e.event_type)).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'operation_allowed',
        'trace_closed',
      ]);
    });

    it('does not create an ApprovalRequest', async () => {
      const response = await app.inject({
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

      const body = response.json();
      const approvals = await prisma.approvalRequest.findMany({
        where: { trace_id: body.trace_id },
      });
      expect(approvals).toHaveLength(0);
    });
  });

  describe('approval_required decision', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-approval-001',
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
    });

    it('returns decision: approval_required with trace_id and approval_request_id', async () => {
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

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.decision).toBe('approval_required');
      expect(body.trace_id).toBeDefined();
      expect(body.approval_request_id).toBeDefined();
      expect(body.reason).toBe('Requires human review');
      expect(body.policy_rule_id).toBe('pol-approval-001');
    });

    it('creates AuditTrace with final_outcome: in_progress', async () => {
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
      const trace = await prisma.auditTrace.findUnique({ where: { id: body.trace_id } });
      expect(trace!.final_outcome).toBe('in_progress');
    });

    it('creates ApprovalRequest with status: pending', async () => {
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
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval).toBeDefined();
      expect(approval!.status).toBe('pending');
    });

    it('sets policy_rule_id on the ApprovalRequest', async () => {
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
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval!.policy_rule_id).toBe('pol-approval-001');
    });

    it('creates audit events: trace_initiated -> identity_resolved -> policy_evaluated -> sensitive_operation_detected -> approval_requested', async () => {
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
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: body.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      expect(events.map(e => e.event_type)).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'sensitive_operation_detected',
        'approval_requested',
      ]);
    });

    it('sets flag_reason from policy rationale', async () => {
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
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval!.flag_reason).toBe('Requires human review');
    });

    it('sets delegated_from when agent delegation_model is not self', async () => {
      await prisma.agent.update({
        where: { id: testData.agent.id },
        data: { delegation_model: 'on_behalf_of_user', owner_name: 'Jane Smith' },
      });

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
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval!.delegated_from).toBe('Jane Smith');
    });
  });

  describe('deny decision', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-deny-001',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Deny export on crm_platform',
          target_integration: 'crm_platform',
          operation: 'export',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
          policy_effect: 'deny',
          rationale: 'PII export prohibited',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });
    });

    it('returns decision: deny with trace_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'export',
          target_integration: 'crm_platform',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.decision).toBe('deny');
      expect(body.trace_id).toBeDefined();
      expect(body.approval_request_id).toBeNull();
    });

    it('creates AuditTrace with final_outcome: blocked and completed_at set', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'export',
          target_integration: 'crm_platform',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
        },
      });

      const body = response.json();
      const trace = await prisma.auditTrace.findUnique({ where: { id: body.trace_id } });
      expect(trace!.final_outcome).toBe('blocked');
      expect(trace!.completed_at).not.toBeNull();
    });

    it('does not create an ApprovalRequest', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'export',
          target_integration: 'crm_platform',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
        },
      });

      const body = response.json();
      const approvals = await prisma.approvalRequest.findMany({
        where: { trace_id: body.trace_id },
      });
      expect(approvals).toHaveLength(0);
    });

    it('creates audit events: trace_initiated -> identity_resolved -> policy_evaluated -> sensitive_operation_detected -> operation_denied -> trace_closed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'export',
          target_integration: 'crm_platform',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
        },
      });

      const body = response.json();
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: body.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      expect(events.map(e => e.event_type)).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'sensitive_operation_detected',
        'operation_denied',
        'trace_closed',
      ]);
    });
  });

  describe('risk classification on approval requests', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-risk-001',
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
    });

    it('sets risk_classification on approval request creation', async () => {
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
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      // confidential (3) * destructive send (2) = 6 → high
      expect(approval!.risk_classification).toBe('high');
    });

    it('captures context_snapshot from SDK evaluate call', async () => {
      const context = { reason: 'User requested export', plan: 'Send quarterly report' };
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
          context,
        },
      });

      const body = response.json();
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval!.context_snapshot).toEqual(context);
    });

    it('sets context_snapshot to null when no context provided', async () => {
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
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval!.context_snapshot).toBeNull();
    });

    it('risk_classification appears in approval list response', async () => {
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
      expect(response.statusCode).toBe(200);

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(listResponse.statusCode).toBe(200);
      const listBody = listResponse.json();
      expect(listBody.data[0].risk_classification).toBe('high');
    });

    it('risk_classification appears in approval detail response', async () => {
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

      const approvalId = evalResponse.json().approval_request_id;
      const detailResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approvalId}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(detailResponse.statusCode).toBe(200);
      const detail = detailResponse.json();
      expect(detail.risk_classification).toBe('high');
    });

    it('context_snapshot appears in approval detail response', async () => {
      const context = { task: 'Send report', urgency: 'high' };
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
          context,
        },
      });

      const approvalId = evalResponse.json().approval_request_id;
      const detailResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/approvals/${approvalId}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(detailResponse.statusCode).toBe(200);
      const detail = detailResponse.json();
      expect(detail.context_snapshot).toEqual(context);
    });
  });

  describe('error cases', () => {
    it('returns 400 for invalid request body (missing operation)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for non-existent agent_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: 'non-existent-agent',
          operation: 'read',
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('transaction rolls back on internal error (no partial state)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: 'non-existent-agent',
          operation: 'read',
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(404);

      const traces = await prisma.auditTrace.findMany();
      expect(traces).toHaveLength(0);
      const events = await prisma.auditEvent.findMany();
      expect(events).toHaveLength(0);
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-perf-001',
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
    });

    it('completes within 100ms', async () => {
      const start = Date.now();
      await app.inject({
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
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });
});

describe('POST /api/v1/traces/:traceId/outcome', () => {
  beforeEach(async () => {
    await prisma.policyRule.create({
      data: {
        id: 'pol-outcome-001',
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
  });

  async function evaluateAndGetTraceId(): Promise<string> {
    const response = await app.inject({
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
    return response.json().trace_id;
  }

  it('returns 204 on success', async () => {
    const traceId = await evaluateAndGetTraceId();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    expect(response.statusCode).toBe(204);
  });

  it('records success outcome and finalizes trace', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    const trace = await prisma.auditTrace.findUnique({ where: { id: traceId } });
    expect(trace!.final_outcome).toBe('executed');
    expect(trace!.completed_at).not.toBeNull();
  });

  it('records error outcome on auto-closed allow trace without changing outcome', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'error' },
    });

    // Auto-closed allow traces stay 'executed' — the error event is recorded but
    // the governance outcome (policy allowed it) doesn't change
    const trace = await prisma.auditTrace.findUnique({ where: { id: traceId } });
    expect(trace!.final_outcome).toBe('executed');
    expect(trace!.completed_at).not.toBeNull();
  });

  it('creates operation_executed event for success', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: traceId, event_type: 'operation_executed' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.status).toBe('success');
  });

  it('creates operation_failed event for error', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'error' },
    });

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: traceId, event_type: 'operation_failed' },
    });
    expect(events).toHaveLength(1);
  });

  it('creates trace_closed event', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: traceId, event_type: 'trace_closed' },
    });
    expect(events).toHaveLength(1);
  });

  it('returns 404 for non-existent trace', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/traces/non-existent-trace/outcome',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /api/v1/approvals/:id/status', () => {
  it('returns pending status for new approval', async () => {
    await prisma.policyRule.create({
      data: {
        id: 'pol-status-001',
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
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

    const approvalId = evalResponse.json().approval_request_id;

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/approvals/${approvalId}/status`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(approvalId);
    expect(body.status).toBe('pending');
    expect(body.decided_at).toBeNull();
    expect(body.approver_name).toBeNull();
    expect(body.decision_note).toBeNull();
  });

  it('returns 404 for non-existent approval', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/approvals/non-existent-id/status',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns correct fields: id, status, decided_at, approver_name, decision_note', async () => {
    await prisma.policyRule.create({
      data: {
        id: 'pol-fields-001',
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
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

    const approvalId = evalResponse.json().approval_request_id;

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/approvals/${approvalId}/status`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(Object.keys(body).sort()).toEqual([
      'approver_name',
      'decided_at',
      'decision_note',
      'id',
      'status',
    ]);
  });
});
