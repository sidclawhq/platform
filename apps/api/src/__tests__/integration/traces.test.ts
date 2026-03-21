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
});
