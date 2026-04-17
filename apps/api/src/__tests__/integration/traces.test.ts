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

// Helper: create an allow policy and evaluate to generate a completed trace
async function createAllowPolicy(policyId = 'pol-allow-001') {
  await prisma.policyRule.create({
    data: {
      id: policyId,
      tenant_id: testData.tenant.id,
      agent_id: testData.agent.id,
      policy_name: 'Allow read on document_store',
      target_integration: 'document_store',
      operation: 'read',
      resource_scope: 'internal_docs',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Low-risk read access',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'test',
    },
  });
}

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

async function evaluateAllow(): Promise<{ trace_id: string }> {
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
  return { trace_id: body.trace_id };
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

async function recordOutcome(traceId: string, status: 'success' | 'error' = 'success') {
  await app.inject({
    method: 'POST',
    url: `/api/v1/traces/${traceId}/outcome`,
    headers: { authorization: `Bearer ${testData.rawApiKey}` },
    payload: { status },
  });
}

describe('Trace Endpoints (P1.6)', () => {
  describe('GET /api/v1/traces', () => {
    it('returns empty list when no traces exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
      expect(body.pagination.limit).toBe(20);
      expect(body.pagination.offset).toBe(0);
    });

    it('returns traces with agent name, event count, and duration', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(1);

      const trace = body.data[0];
      expect(trace.id).toBe(trace_id);
      expect(trace.agent_name).toBe('Test Agent');
      expect(trace.requested_operation).toBe('read');
      expect(trace.target_integration).toBe('document_store');
      expect(trace.resource_scope).toBe('internal_docs');
      expect(trace.final_outcome).toBe('executed');
      expect(trace.event_count).toBeGreaterThan(0);
      expect(trace.duration_ms).toBeGreaterThanOrEqual(0);
      expect(trace.has_approval).toBe(false);
      expect(trace.started_at).toBeDefined();
      expect(trace.completed_at).toBeDefined();
    });

    it('returns has_approval: true for traces with approval requests', async () => {
      await createApprovalPolicy();
      const { trace_id } = await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      const trace = body.data[0];
      expect(trace.has_approval).toBe(true);
      expect(trace.final_outcome).toBe('in_progress');
      expect(trace.duration_ms).toBeNull();
      expect(trace.completed_at).toBeNull();
    });

    it('orders traces by started_at descending', async () => {
      await createAllowPolicy();
      await evaluateAllow();
      await evaluateAllow();
      await evaluateAllow();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      const dates = body.data.map((d: { started_at: string }) => new Date(d.started_at).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    it('filters by agent_id', async () => {
      await createAllowPolicy();
      await evaluateAllow();

      // Create another agent with its own trace
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

      await prisma.policyRule.create({
        data: {
          id: 'pol-other-allow',
          tenant_id: testData.tenant.id,
          agent_id: otherAgent.id,
          policy_name: 'Allow read',
          target_integration: 'document_store',
          operation: 'read',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
          policy_effect: 'allow',
          rationale: 'Low-risk',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: otherAgent.id,
          operation: 'read',
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces?agent_id=${testData.agent.id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].agent_id).toBe(testData.agent.id);
      expect(body.pagination.total).toBe(1);
    });

    it('filters by outcome', async () => {
      await createAllowPolicy();
      // Allow traces are auto-closed as 'executed'
      await evaluateAllow();
      await evaluateAllow();

      // Create a deny policy and evaluate to get a 'blocked' trace
      await prisma.policyRule.create({
        data: {
          id: 'pol-deny-filter',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Deny filter test',
          target_integration: 'crm_platform',
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
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'delete',
          target_integration: 'crm_platform',
          resource_scope: '*',
          data_classification: 'restricted',
        },
      });

      // Filter by executed — should get the 2 allow traces
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces?outcome=executed',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data.every((t: { final_outcome: string }) => t.final_outcome === 'executed')).toBe(true);
      expect(body.pagination.total).toBe(2);

      // Filter by blocked — should get the deny trace
      const blockedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/traces?outcome=blocked',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      const blockedBody = blockedRes.json();
      expect(blockedBody.data).toHaveLength(1);
      expect(blockedBody.data[0].final_outcome).toBe('blocked');
    });

    it('respects limit and offset for pagination', async () => {
      await createAllowPolicy();
      await evaluateAllow();
      await evaluateAllow();
      await evaluateAllow();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces?limit=2&offset=1',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.offset).toBe(1);
    });

    it('caps limit at 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces?limit=200',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      expect(body.pagination.limit).toBe(100);
    });
  });

  describe('GET /api/v1/traces/:id', () => {
    it('returns trace with all events in chronological order', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.id).toBe(trace_id);
      expect(body.agent_name).toBe('Test Agent');
      expect(body.authority_model).toBe('self');
      expect(body.requested_operation).toBe('read');
      expect(body.target_integration).toBe('document_store');
      expect(body.resource_scope).toBe('internal_docs');
      expect(body.final_outcome).toBe('executed');
      expect(body.duration_ms).toBeGreaterThanOrEqual(0);
      expect(body.parent_trace_id).toBeNull();

      // Events should be in chronological order
      expect(body.events.length).toBeGreaterThan(0);
      const eventTypes = body.events.map((e: { event_type: string }) => e.event_type);
      expect(eventTypes[0]).toBe('trace_initiated');
      // After auto-close + recordOutcome, last event is operation_executed
      expect(eventTypes).toContain('trace_closed');
      expect(eventTypes).toContain('operation_executed');

      // Timestamps should be ascending
      const timestamps = body.events.map((e: { timestamp: string }) => new Date(e.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }

      // Each event should have required fields
      for (const event of body.events) {
        expect(event.id).toBeDefined();
        expect(event.event_type).toBeDefined();
        expect(event.actor_type).toBeDefined();
        expect(event.actor_name).toBeDefined();
        expect(event.description).toBeDefined();
        expect(event.status).toBeDefined();
        expect(event.timestamp).toBeDefined();
      }

      // No approval requests for allow traces
      expect(body.approval_requests).toHaveLength(0);
    });

    it('returns trace with approval requests when present', async () => {
      await createApprovalPolicy();
      const { trace_id, approval_request_id } = await evaluateForApproval();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.approval_requests).toHaveLength(1);
      expect(body.approval_requests[0].id).toBe(approval_request_id);
      expect(body.approval_requests[0].status).toBe('pending');
      expect(body.approval_requests[0].approver_name).toBeNull();
      expect(body.approval_requests[0].decided_at).toBeNull();
    });

    it('includes policy_version and approval_request_id on events when present', async () => {
      await createApprovalPolicy();
      const { trace_id, approval_request_id } = await evaluateForApproval();

      // Approve the request to create an event with approval_request_id
      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();

      // Find the policy_evaluated event — should have policy_version
      const policyEvent = body.events.find((e: { event_type: string }) => e.event_type === 'policy_evaluated');
      expect(policyEvent).toBeDefined();
      expect(policyEvent.policy_version).toBe(1);

      // Find the approval_granted event — should have approval_request_id
      const approvalEvent = body.events.find((e: { event_type: string }) => e.event_type === 'approval_granted');
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent.approval_request_id).toBe(approval_request_id);
    });

    it('returns 404 for non-existent trace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces/non-existent-id',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for trace belonging to another tenant', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();

      // Create a different tenant with an API key
      const otherTenant = await prisma.tenant.create({
        data: {
          id: 'other-tenant',
          name: 'Other Workspace',
          slug: 'other',
          plan: 'free',
          settings: {},
          onboarding_state: {},
        },
      });

      await prisma.user.create({
        data: {
          id: 'other-user',
          tenant_id: otherTenant.id,
          email: 'other@example.com',
          name: 'Other Admin',
          role: 'admin',
          auth_provider: 'email',
        },
      });

      const { createHash, randomBytes } = await import('node:crypto');
      const otherRawKey = 'ai_test_' + randomBytes(16).toString('hex');
      const otherKeyHash = createHash('sha256').update(otherRawKey).digest('hex');

      await prisma.apiKey.create({
        data: {
          id: 'other-apikey',
          tenant_id: otherTenant.id,
          name: 'Other Key',
          key_prefix: otherRawKey.substring(0, 12),
          key_hash: otherKeyHash,
          scopes: ['*'],
        },
      });

      // Try to access the trace with the other tenant's API key
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${otherRawKey}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('full trace lifecycle', () => {
    it('shows complete event sequence for allow flow', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      const eventTypes = body.events.map((e: { event_type: string }) => e.event_type);
      // Auto-close creates trace_closed during evaluate, then recordOutcome adds operation_executed
      expect(eventTypes).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'operation_allowed',
        'trace_closed',
        'operation_executed',
      ]);
    });

    it('shows complete event sequence for approval flow', async () => {
      await createApprovalPolicy();
      const { trace_id, approval_request_id } = await evaluateForApproval();

      // Approve
      await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Security Reviewer' },
      });

      // Record outcome
      await recordOutcome(trace_id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      const body = response.json();
      const eventTypes = body.events.map((e: { event_type: string }) => e.event_type);
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

      expect(body.final_outcome).toBe('completed_with_approval');
    });
  });

  describe('Trace Export (P2.4)', () => {
    describe('GET /api/v1/traces/:traceId/export?format=json', () => {
      it('returns complete trace as JSON with Content-Disposition header', async () => {
        await createAllowPolicy();
        const { trace_id } = await evaluateAllow();
        await recordOutcome(trace_id);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/${trace_id}/export?format=json`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['content-disposition']).toBe(
          `attachment; filename="trace-${trace_id}.json"`
        );

        const body = response.json();
        expect(body.trace).toBeDefined();
        expect(body.trace.id).toBe(trace_id);
        expect(body.trace.agent_name).toBe('Test Agent');
        expect(body.trace.duration_ms).toBeGreaterThanOrEqual(0);
      });

      it('includes all events in chronological order', async () => {
        await createAllowPolicy();
        const { trace_id } = await evaluateAllow();
        await recordOutcome(trace_id);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/${trace_id}/export?format=json`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        const body = response.json();
        expect(body.events.length).toBeGreaterThan(0);

        const timestamps = body.events.map((e: { timestamp: string }) =>
          new Date(e.timestamp).getTime()
        );
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
        }
      });

      it('includes approval requests', async () => {
        await createApprovalPolicy();
        const { trace_id, approval_request_id } = await evaluateForApproval();

        await app.inject({
          method: 'POST',
          url: `/api/v1/approvals/${approval_request_id}/approve`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
          payload: { approver_name: 'Reviewer', decision_note: 'Looks good' },
        });

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/${trace_id}/export?format=json`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        const body = response.json();
        expect(body.approval_requests).toHaveLength(1);
        expect(body.approval_requests[0].id).toBe(approval_request_id);
        expect(body.approval_requests[0].status).toBe('approved');
        expect(body.approval_requests[0].approver_name).toBe('Reviewer');
        expect(body.approval_requests[0].decision_note).toBe('Looks good');
        expect(body.approval_requests[0].flag_reason).toBeDefined();
      });

      it('includes exported_at timestamp', async () => {
        await createAllowPolicy();
        const { trace_id } = await evaluateAllow();

        const before = new Date().toISOString();
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/${trace_id}/export?format=json`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });
        const after = new Date().toISOString();

        const body = response.json();
        expect(body.exported_at).toBeDefined();
        expect(body.exported_at >= before).toBe(true);
        expect(body.exported_at <= after).toBe(true);
      });

      it('returns 404 for non-existent trace', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/traces/non-existent-id/export?format=json',
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('GET /api/v1/traces/export?format=csv', () => {
      it('returns CSV with correct headers', async () => {
        await createAllowPolicy();
        await evaluateAllow();

        const from = new Date(Date.now() - 86400000).toISOString();
        const to = new Date(Date.now() + 86400000).toISOString();

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/export?from=${from}&to=${to}&format=csv`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');

        const lines = response.body.split('\n');
        expect(lines[0]).toBe(
          'trace_id,agent_id,agent_name,operation,target_integration,resource_scope,data_classification,final_outcome,started_at,completed_at,duration_ms,approval_required,approver_name,approval_decision,approval_decided_at,policy_rule_id,policy_version'
        );
      });

      it('filters by date range', async () => {
        await createAllowPolicy();
        await evaluateAllow();

        // Range that includes no traces (far past)
        const from = '2020-01-01T00:00:00.000Z';
        const to = '2020-01-02T00:00:00.000Z';

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/export?from=${from}&to=${to}&format=csv`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        expect(response.statusCode).toBe(200);
        const lines = response.body.split('\n');
        // Only the header row
        expect(lines).toHaveLength(1);
      });

      it('filters by agent_id', async () => {
        await createAllowPolicy();
        await evaluateAllow();

        const from = new Date(Date.now() - 86400000).toISOString();
        const to = new Date(Date.now() + 86400000).toISOString();

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/export?from=${from}&to=${to}&format=csv&agent_id=non-existent`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        expect(response.statusCode).toBe(200);
        const lines = response.body.split('\n');
        expect(lines).toHaveLength(1); // header only
      });

      it('includes approval data in CSV rows', async () => {
        await createApprovalPolicy();
        const { trace_id, approval_request_id } = await evaluateForApproval();

        await app.inject({
          method: 'POST',
          url: `/api/v1/approvals/${approval_request_id}/approve`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
          payload: { approver_name: 'Reviewer' },
        });
        await recordOutcome(trace_id);

        const from = new Date(Date.now() - 86400000).toISOString();
        const to = new Date(Date.now() + 86400000).toISOString();

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/export?from=${from}&to=${to}&format=csv`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        const lines = response.body.split('\n');
        expect(lines.length).toBeGreaterThan(1);
        const dataRow = lines[1];
        expect(dataRow).toContain(trace_id);
        expect(dataRow).toContain('true'); // approval_required
        expect(dataRow).toContain('Reviewer');
        expect(dataRow).toContain('approved');
      });

      it('returns 400 when from/to missing', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/traces/export?format=csv',
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        expect(response.statusCode).toBe(400);
      });

      it('CSV escapes values with commas and quotes', async () => {
        // Create an agent with a comma in the name
        const commaAgent = await prisma.agent.create({
          data: {
            id: 'agent-comma',
            tenant_id: testData.tenant.id,
            name: 'Agent, "Quoted"',
            description: 'Test agent with special chars',
            owner_name: 'Owner',
            owner_role: 'Role',
            team: 'Team',
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

        await prisma.policyRule.create({
          data: {
            id: 'pol-comma-test',
            tenant_id: testData.tenant.id,
            agent_id: commaAgent.id,
            policy_name: 'Allow read',
            target_integration: 'document_store',
            operation: 'read',
            resource_scope: 'internal_docs',
            data_classification: 'internal',
            policy_effect: 'allow',
            rationale: 'Test',
            priority: 100,
            is_active: true,
            policy_version: 1,
            modified_by: 'test',
          },
        });

        await app.inject({
          method: 'POST',
          url: '/api/v1/evaluate',
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
          payload: {
            agent_id: commaAgent.id,
            operation: 'read',
            target_integration: 'document_store',
            resource_scope: 'internal_docs',
            data_classification: 'internal',
          },
        });

        const from = new Date(Date.now() - 86400000).toISOString();
        const to = new Date(Date.now() + 86400000).toISOString();

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/export?from=${from}&to=${to}&format=csv&agent_id=${commaAgent.id}`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        expect(response.statusCode).toBe(200);
        const lines = response.body.split('\n');
        expect(lines.length).toBeGreaterThan(1);
        // The agent name should be escaped: "Agent, ""Quoted"""
        expect(lines[1]).toContain('"Agent, ""Quoted"""');
      });

      it('Content-Disposition header has meaningful filename', async () => {
        await createAllowPolicy();
        await evaluateAllow();

        const from = '2026-03-20T00:00:00.000Z';
        const to = '2026-03-21T23:59:59.999Z';

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces/export?from=${from}&to=${to}&format=csv`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        expect(response.headers['content-disposition']).toBe(
          'attachment; filename="audit-2026-03-20-to-2026-03-21.csv"'
        );
      });
    });

    describe('Date range filtering on GET /api/v1/traces', () => {
      it('filters by from date', async () => {
        await createAllowPolicy();
        await evaluateAllow();

        // Use a future date — should return nothing
        const futureFrom = new Date(Date.now() + 86400000).toISOString();
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces?from=${futureFrom}`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        const body = response.json();
        expect(body.data).toHaveLength(0);
      });

      it('filters by to date', async () => {
        await createAllowPolicy();
        await evaluateAllow();

        // Use a past date — should return nothing
        const pastTo = '2020-01-01T00:00:00.000Z';
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces?to=${pastTo}`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        const body = response.json();
        expect(body.data).toHaveLength(0);
      });

      it('filters by both from and to', async () => {
        await createAllowPolicy();
        await evaluateAllow();

        const from = new Date(Date.now() - 86400000).toISOString();
        const to = new Date(Date.now() + 86400000).toISOString();
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/traces?from=${from}&to=${to}`,
          headers: { authorization: `Bearer ${testData.rawApiKey}` },
        });

        const body = response.json();
        expect(body.data).toHaveLength(1);
        expect(body.pagination.total).toBe(1);
      });
    });
  });

  // Outcome telemetry + token/cost attribution (Claude Code hooks, Section 1/12)
  describe('Outcome telemetry (hooks + cost attribution)', () => {
    it('persists telemetry fields when recorded alongside outcome', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/traces/${trace_id}/outcome`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          status: 'success',
          outcome_summary: 'rm -rf ./tmp — 3 files removed',
          exit_code: 0,
          tokens_in: 1200,
          tokens_out: 340,
          tokens_cache_read: 5000,
          model: 'claude-sonnet-4-6',
          cost_estimate: 0.00512,
        },
      });

      expect(response.statusCode).toBe(204);

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      const body = detail.json();
      expect(body.outcome_summary).toBe('rm -rf ./tmp — 3 files removed');
      expect(body.exit_code).toBe(0);
      expect(body.tokens_in).toBe(1200);
      expect(body.tokens_out).toBe(340);
      expect(body.tokens_cache_read).toBe(5000);
      expect(body.model).toBe('claude-sonnet-4-6');
      expect(body.cost_estimate).toBeCloseTo(0.00512, 6);
    });

    it('persists error_classification when outcome is error (runtime failure after allow)', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();

      // Allow path auto-closes the trace as 'executed'. An error outcome
      // here represents a runtime failure AFTER policy authorized the action
      // — the policy decision (executed) stays, error_classification captures
      // the runtime failure.
      await app.inject({
        method: 'POST',
        url: `/api/v1/traces/${trace_id}/outcome`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          status: 'error',
          error_classification: 'timeout',
          exit_code: 124,
          outcome_summary: 'command timed out after 30s',
        },
      });

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      const body = detail.json();
      expect(body.error_classification).toBe('timeout');
      expect(body.exit_code).toBe(124);
      expect(body.outcome_summary).toBe('command timed out after 30s');
    });

    it('rejects invalid error_classification values', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/traces/${trace_id}/outcome`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          status: 'error',
          error_classification: 'invalid_class',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/v1/traces/:traceId/telemetry', () => {
    it('appends token usage to a trace that already has an outcome', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          tokens_in: 8500,
          tokens_out: 1200,
          model: 'claude-opus-4-7',
          cost_estimate: 0.1875,
        },
      });

      expect(response.statusCode).toBe(204);

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      const body = detail.json();
      expect(body.tokens_in).toBe(8500);
      expect(body.tokens_out).toBe(1200);
      expect(body.model).toBe('claude-opus-4-7');
      expect(body.cost_estimate).toBeCloseTo(0.1875, 6);
    });

    it('tokens are additive: subsequent PATCH increments', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      // First PATCH: sets tokens to 1000.
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { tokens_in: 1000, cost_estimate: 0.01 },
      });
      // Second PATCH: adds 500 → expect 1500.
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { tokens_in: 500, cost_estimate: 0.02 },
      });

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      const body = detail.json();
      expect(body.tokens_in).toBe(1500);
      expect(body.cost_estimate).toBeCloseTo(0.03, 6);
    });

    it('model + outcome_summary are set-once (first write wins)', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { model: 'claude-sonnet-4-6', outcome_summary: 'first' },
      });
      // Attempt to overwrite — should be ignored.
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { model: 'claude-opus-4-7', outcome_summary: 'second' },
      });

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      const body = detail.json();
      expect(body.model).toBe('claude-sonnet-4-6');
      expect(body.outcome_summary).toBe('first');
    });

    it('Zod rejects token counts above INT4_MAX', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { tokens_in: 3_000_000_000 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('Zod rejects unknown fields via strict schema', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { tokens_in: 100, token_in_typo: 500 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects empty telemetry payloads', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for a trace owned by another tenant', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();

      // Spin up a second tenant with its own API key
      const { randomBytes, createHash } = await import('crypto');
      await prisma.tenant.create({
        data: {
          id: 'other-tenant',
          name: 'Other Workspace',
          slug: 'other',
          plan: 'free',
          settings: {},
          onboarding_state: {},
        },
      });
      const otherRawKey = 'ai_test_' + randomBytes(16).toString('hex');
      await prisma.apiKey.create({
        data: {
          id: 'other-apikey',
          tenant_id: 'other-tenant',
          name: 'Other Key',
          key_prefix: otherRawKey.substring(0, 12),
          key_hash: createHash('sha256').update(otherRawKey).digest('hex'),
          scopes: ['*'],
        },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${trace_id}/telemetry`,
        headers: { authorization: `Bearer ${otherRawKey}` },
        payload: { tokens_in: 100 },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // Regression coverage for Round 2 review findings.
  describe('drift_sentinel traces are excluded from user-facing queries', () => {
    async function createDriftSentinel(): Promise<string> {
      const trace = await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'self',
          requested_operation: 'drift_sentinel',
          target_integration: 'sidclaw_internal',
          resource_scope: 'agent.drift',
          final_outcome: 'drift_sentinel',
        },
      });
      return trace.id;
    }

    it('GET /traces hides sentinel traces from the default list', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      const sentinelId = await createDriftSentinel();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      const ids = response.json().data.map((t: { id: string }) => t.id);
      expect(ids).toContain(trace_id);
      expect(ids).not.toContain(sentinelId);
    });

    it('GET /traces/:id returns 404 for a drift_sentinel trace', async () => {
      const sentinelId = await createDriftSentinel();
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${sentinelId}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it('CSV export excludes sentinel traces', async () => {
      await createAllowPolicy();
      await evaluateAllow();
      await createDriftSentinel();
      const from = new Date(Date.now() - 86400000).toISOString();
      const to = new Date(Date.now() + 86400000).toISOString();
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/export?from=${from}&to=${to}&format=csv`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain('drift_sentinel');
    });
  });

  describe('PATCH /telemetry handles concurrent parallel writes', () => {
    it('sums all tokens from parallel PATCHes (FOR UPDATE serializes)', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();
      await recordOutcome(trace_id);

      // Five parallel PATCHes of 100 tokens each — if the FOR UPDATE lock
      // isn't taken before the null-check read, concurrent writers both see
      // null and both SET, losing 400 of the 500 expected tokens.
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          app.inject({
            method: 'PATCH',
            url: `/api/v1/traces/${trace_id}/telemetry`,
            headers: { authorization: `Bearer ${testData.rawApiKey}` },
            payload: { tokens_in: 100 },
          }),
        ),
      );
      for (const r of responses) expect(r.statusCode).toBe(204);

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      expect(detail.json().tokens_in).toBe(500);
    });
  });

  describe('POST /outcome preserves set-once forensic fields on retry', () => {
    it('does not overwrite outcome_summary or model on re-POST', async () => {
      await createAllowPolicy();
      const { trace_id } = await evaluateAllow();

      // First POST finalises the trace with forensic summary + model.
      await app.inject({
        method: 'POST',
        url: `/api/v1/traces/${trace_id}/outcome`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          status: 'success',
          outcome_summary: 'OK: processed 3 files',
          model: 'claude-sonnet-4-6',
        },
      });

      // Crash-recovery retry with conflicting summary + model — must be ignored.
      const retry = await app.inject({
        method: 'POST',
        url: `/api/v1/traces/${trace_id}/outcome`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          status: 'error',
          outcome_summary: 'Process crashed mid-write',
          model: 'gpt-4o',
          error_classification: 'runtime',
        },
      });
      expect(retry.statusCode).toBe(204);

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/traces/${trace_id}`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      const body = detail.json();
      expect(body.outcome_summary).toBe('OK: processed 3 files');
      expect(body.model).toBe('claude-sonnet-4-6');
      // error_classification is not set-once — the later failure classification wins.
      expect(body.error_classification).toBe('runtime');
    });
  });

  describe('PATCH /telemetry rejects terminally-finalized traces', () => {
    async function createDriftSentinel(): Promise<string> {
      const trace = await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'self',
          requested_operation: 'drift_sentinel',
          target_integration: 'sidclaw_internal',
          resource_scope: 'agent.drift',
          final_outcome: 'drift_sentinel',
        },
      });
      return trace.id;
    }

    it('returns 409 for a denied trace', async () => {
      const deniedTrace = await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'delegated',
          requested_operation: 'read',
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          final_outcome: 'denied',
        },
      });

      const patch = await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${deniedTrace.id}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { tokens_in: 5000, cost_estimate: 0.5 },
      });
      expect(patch.statusCode).toBe(409);

      const row = await prisma.auditTrace.findUnique({ where: { id: deniedTrace.id } });
      expect(row?.tokens_in).toBeNull();
      expect(row?.cost_estimate).toBeNull();
    });

    it('returns 409 for a drift_sentinel trace', async () => {
      const sentinelId = await createDriftSentinel();
      const patch = await app.inject({
        method: 'PATCH',
        url: `/api/v1/traces/${sentinelId}/telemetry`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { tokens_in: 1 },
      });
      expect(patch.statusCode).toBe(409);
    });
  });

  describe('drift_sentinel exclusion is not bypassable via ?outcome=', () => {
    it('GET /traces?outcome=drift_sentinel returns no sentinel rows', async () => {
      await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'self',
          requested_operation: 'drift_sentinel',
          target_integration: 'sidclaw_internal',
          resource_scope: 'agent.drift',
          final_outcome: 'drift_sentinel',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/traces?outcome=drift_sentinel',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveLength(0);
    });

    it('POST /outcome returns 409 for a drift_sentinel trace', async () => {
      const trace = await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'self',
          requested_operation: 'drift_sentinel',
          target_integration: 'sidclaw_internal',
          resource_scope: 'agent.drift',
          final_outcome: 'drift_sentinel',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/traces/${trace.id}/outcome`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { status: 'success' },
      });
      expect(response.statusCode).toBe(409);
    });
  });
});
