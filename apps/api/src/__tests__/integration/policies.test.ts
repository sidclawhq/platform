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

function headers() {
  return { authorization: `Bearer ${testData.rawApiKey}` };
}

const validPolicy = () => ({
  agent_id: testData.agent.id,
  policy_name: 'Allow read on analytics',
  target_integration: 'analytics_service',
  operation: 'read',
  resource_scope: 'dashboards',
  data_classification: 'internal',
  policy_effect: 'allow',
  rationale: 'Analytics dashboards are safe for all agents to read',
  priority: 100,
  conditions: null,
  max_session_ttl: null,
  modified_by: 'Test Admin',
  modified_at: new Date().toISOString(),
});

describe('Policy CRUD API', () => {
  describe('POST /api/v1/policies', () => {
    it('creates policy with version 1 and is_active true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload: validPolicy(),
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.policy_name).toBe('Allow read on analytics');
      expect(body.data.policy_version).toBe(1);
      expect(body.data.is_active).toBe(true);
      expect(body.data.tenant_id).toBe(testData.tenant.id);
    });

    it('returns 400 when rationale is missing', async () => {
      const payload = validPolicy();
      delete (payload as any).rationale;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('validation_error');
    });

    it('returns 400 when rationale is less than 10 chars', async () => {
      const payload = { ...validPolicy(), rationale: 'short' };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('validation_error');
    });

    it('validates data_classification enum', async () => {
      const payload = { ...validPolicy(), data_classification: 'top_secret' };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('validation_error');
    });

    it('validates policy_effect enum', async () => {
      const payload = { ...validPolicy(), policy_effect: 'block' };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('validation_error');
    });
  });

  describe('GET /api/v1/policies', () => {
    async function createPolicy(overrides: Record<string, unknown> = {}) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload: { ...validPolicy(), ...overrides },
      });
      return response.json().data;
    }

    it('returns policies for tenant', async () => {
      await createPolicy();
      await createPolicy({ policy_name: 'Second policy', rationale: 'Another valid rationale for testing' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: headers(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
    });

    it('filters by agent_id', async () => {
      const otherAgent = await prisma.agent.create({
        data: {
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

      await createPolicy();
      await createPolicy({
        agent_id: otherAgent.id,
        policy_name: 'Other agent policy',
        rationale: 'Policy for a different agent',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/policies?agent_id=${testData.agent.id}`,
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].agent_id).toBe(testData.agent.id);
    });

    it('filters by effect', async () => {
      await createPolicy({ policy_effect: 'allow' });
      await createPolicy({
        policy_name: 'Deny policy',
        policy_effect: 'deny',
        rationale: 'This operation is always denied for safety',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies?effect=deny',
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].policy_effect).toBe('deny');
    });

    it('filters by data_classification', async () => {
      await createPolicy({ data_classification: 'internal' });
      await createPolicy({
        policy_name: 'Restricted policy',
        data_classification: 'restricted',
        rationale: 'Restricted data needs extra protection',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies?data_classification=restricted',
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].data_classification).toBe('restricted');
    });

    it('defaults to is_active = true', async () => {
      const policy = await createPolicy();
      // Soft-delete it
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
      });
      // Create another active one
      await createPolicy({ policy_name: 'Active policy', rationale: 'This one is still active' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].is_active).toBe(true);
    });

    it('can include inactive policies with is_active=false', async () => {
      const policy = await createPolicy();
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies?is_active=false',
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].is_active).toBe(false);
    });

    it('search by policy_name', async () => {
      await createPolicy({ policy_name: 'Allow analytics read' });
      await createPolicy({
        policy_name: 'Deny email send',
        rationale: 'Email sending is restricted for safety',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies?search=analytics',
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].policy_name).toContain('analytics');
    });

    it('search by rationale text', async () => {
      await createPolicy({ rationale: 'This involves customer PII data' });
      await createPolicy({
        policy_name: 'Other policy',
        rationale: 'General purpose analytics access',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies?search=PII',
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].rationale).toContain('PII');
    });

    it('includes agent name in response', async () => {
      await createPolicy();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: headers(),
      });

      const body = response.json();
      expect(body.data[0].agent).toBeDefined();
      expect(body.data[0].agent.id).toBe(testData.agent.id);
      expect(body.data[0].agent.name).toBe('Test Agent');
    });

    it('orders by agent_id then priority desc', async () => {
      await createPolicy({ priority: 50 });
      await createPolicy({
        policy_name: 'High priority',
        priority: 200,
        rationale: 'Higher priority policy for testing',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: headers(),
      });

      const body = response.json();
      // Same agent_id, so ordered by priority desc
      expect(body.data[0].priority).toBe(200);
      expect(body.data[1].priority).toBe(50);
    });
  });

  describe('GET /api/v1/policies/:id', () => {
    it('returns policy by id', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload: validPolicy(),
      });
      const policyId = createRes.json().data.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/policies/${policyId}`,
        headers: headers(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.id).toBe(policyId);
      expect(body.data.agent).toBeDefined();
      expect(body.data.agent.name).toBe('Test Agent');
    });

    it('returns 404 for non-existent policy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies/non-existent-id',
        headers: headers(),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/policies/:id', () => {
    async function createAndGetPolicy() {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload: validPolicy(),
      });
      return response.json().data;
    }

    it('updates policy and increments version', async () => {
      const policy = await createAndGetPolicy();

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
        payload: { policy_name: 'Updated policy name' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.policy_name).toBe('Updated policy name');
      expect(body.data.policy_version).toBe(2);
    });

    it('creates a PolicyRuleVersion snapshot', async () => {
      const policy = await createAndGetPolicy();

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
        payload: { policy_name: 'Updated name' },
      });

      const versions = await prisma.policyRuleVersion.findMany({
        where: { policy_rule_id: policy.id },
      });
      expect(versions).toHaveLength(1);
      expect(versions[0]!.version).toBe(1);
      expect(versions[0]!.policy_name).toBe('Allow read on analytics');
    });

    it('generates human-readable change_summary', async () => {
      const policy = await createAndGetPolicy();

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
        payload: { policy_effect: 'deny' },
      });

      const versions = await prisma.policyRuleVersion.findMany({
        where: { policy_rule_id: policy.id },
      });
      expect(versions[0]!.change_summary).toContain('policy_effect');
      expect(versions[0]!.change_summary).toContain('allow');
      expect(versions[0]!.change_summary).toContain('deny');
    });

    it('creates audit event for the change', async () => {
      const policy = await createAndGetPolicy();

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
        payload: { priority: 200 },
      });

      const events = await prisma.auditEvent.findMany({
        where: { agent_id: testData.agent.id, event_type: 'policy_evaluated' },
      });
      expect(events).toHaveLength(1);
      expect(events[0]!.actor_name).toBe('Dashboard User');
      expect(events[0]!.description).toContain('updated');
      expect(events[0]!.description).toContain('v1');
      expect(events[0]!.description).toContain('v2');
    });

    it('updated policy immediately affects evaluations', async () => {
      // Create an allow policy
      const policy = await createAndGetPolicy();

      // Test evaluate — should allow
      const evalBefore = await app.inject({
        method: 'POST',
        url: '/api/v1/policies/test',
        headers: headers(),
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'analytics_service',
          resource_scope: 'dashboards',
          data_classification: 'internal',
        },
      });
      expect(evalBefore.json().effect).toBe('allow');

      // Update to deny
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
        payload: { policy_effect: 'deny' },
      });

      // Test evaluate — should deny now
      const evalAfter = await app.inject({
        method: 'POST',
        url: '/api/v1/policies/test',
        headers: headers(),
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'analytics_service',
          resource_scope: 'dashboards',
          data_classification: 'internal',
        },
      });
      expect(evalAfter.json().effect).toBe('deny');
    });

    it('returns 404 for non-existent policy', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/policies/non-existent-id',
        headers: headers(),
        payload: { priority: 200 },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/policies/:id', () => {
    async function createAndGetPolicy() {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload: validPolicy(),
      });
      return response.json().data;
    }

    it('soft-deletes by setting is_active = false', async () => {
      const policy = await createAndGetPolicy();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.is_active).toBe(false);

      // Verify in DB
      const dbPolicy = await prisma.policyRule.findUnique({ where: { id: policy.id } });
      expect(dbPolicy!.is_active).toBe(false);
    });

    it('soft-deleted policy no longer affects evaluations', async () => {
      const policy = await createAndGetPolicy();

      // Evaluate — should allow
      const evalBefore = await app.inject({
        method: 'POST',
        url: '/api/v1/policies/test',
        headers: headers(),
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'analytics_service',
          resource_scope: 'dashboards',
          data_classification: 'internal',
        },
      });
      expect(evalBefore.json().effect).toBe('allow');

      // Soft delete
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
      });

      // Evaluate — should deny (no matching active rule)
      const evalAfter = await app.inject({
        method: 'POST',
        url: '/api/v1/policies/test',
        headers: headers(),
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'analytics_service',
          resource_scope: 'dashboards',
          data_classification: 'internal',
        },
      });
      expect(evalAfter.json().effect).toBe('deny');
    });

    it('soft-deleted policy excluded from default list', async () => {
      const policy = await createAndGetPolicy();

      await app.inject({
        method: 'DELETE',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/policies/:id/versions', () => {
    async function createAndGetPolicy() {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload: validPolicy(),
      });
      return response.json().data;
    }

    it('returns empty array for policy with no updates', async () => {
      const policy = await createAndGetPolicy();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/policies/${policy.id}/versions`,
        headers: headers(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });

    it('returns version history ordered by version desc', async () => {
      const policy = await createAndGetPolicy();

      // Make two updates
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
        payload: { priority: 200 },
      });

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
        payload: { priority: 300 },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/policies/${policy.id}/versions`,
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].version).toBe(2); // most recent first
      expect(body.data[1].version).toBe(1);
      expect(body.pagination.total).toBe(2);
    });

    it('each version contains the snapshot of the policy at that point', async () => {
      const policy = await createAndGetPolicy();

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/policies/${policy.id}`,
        headers: headers(),
        payload: { policy_name: 'Renamed policy' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/policies/${policy.id}/versions`,
        headers: headers(),
      });

      const body = response.json();
      expect(body.data).toHaveLength(1);
      const version = body.data[0];
      expect(version.version).toBe(1);
      expect(version.policy_name).toBe('Allow read on analytics'); // original name
      expect(version.policy_rule_id).toBe(policy.id);
      expect(version.change_summary).toContain('policy_name');
    });
  });

  describe('POST /api/v1/policies/test', () => {
    async function createAndGetPolicy(overrides: Record<string, unknown> = {}) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: headers(),
        payload: { ...validPolicy(), ...overrides },
      });
      return response.json().data;
    }

    it('returns correct decision without creating a trace', async () => {
      await createAndGetPolicy();

      const traceCountBefore = await prisma.auditTrace.count();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies/test',
        headers: headers(),
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'analytics_service',
          resource_scope: 'dashboards',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.effect).toBe('allow');

      const traceCountAfter = await prisma.auditTrace.count();
      expect(traceCountAfter).toBe(traceCountBefore);
    });

    it('no AuditTrace or AuditEvent records created', async () => {
      await createAndGetPolicy();

      await app.inject({
        method: 'POST',
        url: '/api/v1/policies/test',
        headers: headers(),
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'analytics_service',
          resource_scope: 'dashboards',
          data_classification: 'internal',
        },
      });

      const traces = await prisma.auditTrace.count();
      const events = await prisma.auditEvent.count();
      expect(traces).toBe(0);
      expect(events).toBe(0);
    });

    it('returns matched rule details', async () => {
      const policy = await createAndGetPolicy();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies/test',
        headers: headers(),
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'analytics_service',
          resource_scope: 'dashboards',
          data_classification: 'internal',
        },
      });

      const body = response.json();
      expect(body.effect).toBe('allow');
      expect(body.rule_id).toBe(policy.id);
      expect(body.rationale).toBe('Analytics dashboards are safe for all agents to read');
      expect(body.policy_version).toBe(1);
    });

    it('returns default deny when no rule matches', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/policies/test',
        headers: headers(),
        payload: {
          agent_id: testData.agent.id,
          operation: 'write',
          target_integration: 'nonexistent_service',
          resource_scope: 'anything',
          data_classification: 'public',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.effect).toBe('deny');
      expect(body.rule_id).toBeNull();
    });
  });
});
