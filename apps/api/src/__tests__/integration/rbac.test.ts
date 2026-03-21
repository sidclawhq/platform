import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { SessionManager } from '../../auth/session.js';
import { randomUUID } from 'node:crypto';
import * as cookie from 'cookie';

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

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Creates a user with a given role and returns session + CSRF headers */
async function createUserWithSession(
  role: 'admin' | 'reviewer' | 'viewer',
  email?: string,
): Promise<{
  userId: string;
  sessionCookie: string;
  csrfToken: string;
  headers: (method?: string) => Record<string, string>;
}> {
  const user = await prisma.user.create({
    data: {
      tenant_id: testData.tenant.id,
      email: email ?? `${role}-${randomUUID().slice(0, 8)}@test.com`,
      name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      role,
      auth_provider: 'email',
    },
  });

  const sessionManager = new SessionManager(prisma);
  const sessionId = await sessionManager.create(user.id, testData.tenant.id);
  const csrfToken = randomUUID();

  const cookieHeader = `session=${sessionId}; csrf_token=${csrfToken}`;

  return {
    userId: user.id,
    sessionCookie: sessionId,
    csrfToken,
    headers: (method?: string) => {
      const h: Record<string, string> = {
        cookie: cookieHeader,
      };
      // Add content-type for methods that send a body (not DELETE)
      if (!method || method !== 'DELETE') {
        h['content-type'] = 'application/json';
      }
      // Add CSRF token for state-changing methods
      if (method && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        h['x-csrf-token'] = csrfToken;
      }
      return h;
    },
  };
}

/** Creates the admin user session from the seeded test data */
async function createAdminSession() {
  const sessionManager = new SessionManager(prisma);
  const sessionId = await sessionManager.create(testData.user.id, testData.tenant.id);
  const csrfToken = randomUUID();
  const cookieHeader = `session=${sessionId}; csrf_token=${csrfToken}`;

  return {
    userId: testData.user.id,
    sessionCookie: sessionId,
    csrfToken,
    headers: (method?: string) => {
      const h: Record<string, string> = {
        cookie: cookieHeader,
      };
      if (!method || method !== 'DELETE') {
        h['content-type'] = 'application/json';
      }
      if (method && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        h['x-csrf-token'] = csrfToken;
      }
      return h;
    },
  };
}

/** Creates an approval request for testing approve/deny */
async function createPendingApproval(): Promise<string> {
  // Need a policy rule and trace first
  const policy = await prisma.policyRule.create({
    data: {
      tenant_id: testData.tenant.id,
      agent_id: testData.agent.id,
      policy_name: 'RBAC Test Policy',
      target_integration: 'database',
      operation: 'write',
      resource_scope: 'all_tables',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Needs approval',
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
      requested_operation: 'write',
      target_integration: 'database',
      resource_scope: 'all_tables',
      final_outcome: 'pending_approval',
    },
  });

  const approval = await prisma.approvalRequest.create({
    data: {
      tenant_id: testData.tenant.id,
      trace_id: trace.id,
      agent_id: testData.agent.id,
      policy_rule_id: policy.id,
      requested_operation: 'write',
      target_integration: 'database',
      resource_scope: 'all_tables',
      data_classification: 'confidential',
      risk_classification: 'high',
      authority_model: 'self',
      policy_effect: 'approval_required',
      flag_reason: 'Policy requires approval',
      status: 'pending',
    },
  });

  return approval.id;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RBAC', () => {
  describe('Viewer role', () => {
    it('can GET /agents', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: viewer.headers(),
      });
      expect(res.statusCode).toBe(200);
    });

    it('can GET /policies', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/policies',
        headers: viewer.headers(),
      });
      expect(res.statusCode).toBe(200);
    });

    it('can GET /approvals', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals',
        headers: viewer.headers(),
      });
      expect(res.statusCode).toBe(200);
    });

    it('can GET /traces', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: viewer.headers(),
      });
      expect(res.statusCode).toBe(200);
    });

    it('cannot POST /agents (403)', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: viewer.headers('POST'),
        payload: { name: 'test' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot PATCH /agents/:id (403)', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${testData.agent.id}`,
        headers: viewer.headers('PATCH'),
        payload: { name: 'updated' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot POST /agents/:id/suspend (403)', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${testData.agent.id}/suspend`,
        headers: viewer.headers('POST'),
        payload: {},
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot POST /policies (403)', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: viewer.headers('POST'),
        payload: {},
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot POST /approvals/:id/approve (403)', async () => {
      const viewer = await createUserWithSession('viewer');
      const approvalId = await createPendingApproval();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approvalId}/approve`,
        headers: viewer.headers('POST'),
        payload: { approver_name: 'Viewer' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot GET /api/v1/users (403)', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: viewer.headers(),
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot access webhook endpoints (403)', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/webhooks',
        headers: viewer.headers(),
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot GET trace export (403)', async () => {
      const viewer = await createUserWithSession('viewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/traces/export?from=2024-01-01&to=2024-12-31&format=csv',
        headers: viewer.headers(),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Reviewer role', () => {
    it('can GET all read endpoints', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const endpoints = ['/api/v1/agents', '/api/v1/policies', '/api/v1/approvals', '/api/v1/traces'];
      for (const url of endpoints) {
        const res = await app.inject({
          method: 'GET',
          url,
          headers: reviewer.headers(),
        });
        expect(res.statusCode).toBe(200);
      }
    });

    it('can POST /approvals/:id/approve', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const approvalId = await createPendingApproval();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approvalId}/approve`,
        headers: reviewer.headers('POST'),
        payload: { approver_name: 'Test Reviewer', decision_note: 'Looks good' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('can POST /approvals/:id/deny', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const approvalId = await createPendingApproval();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approvalId}/deny`,
        headers: reviewer.headers('POST'),
        payload: { approver_name: 'Test Reviewer', decision_note: 'Rejected' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('can GET trace export', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/traces/export?from=2024-01-01&to=2024-12-31&format=csv',
        headers: reviewer.headers(),
      });
      // 200 even if empty — no 403
      expect(res.statusCode).toBe(200);
    });

    it('cannot POST /agents (403)', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: reviewer.headers('POST'),
        payload: { name: 'test' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot POST /policies (403)', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/policies',
        headers: reviewer.headers('POST'),
        payload: {},
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot access webhook endpoints (403)', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/webhooks',
        headers: reviewer.headers(),
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot GET /api/v1/users (403)', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: reviewer.headers(),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Admin role', () => {
    it('can do everything — read endpoints', async () => {
      const admin = await createAdminSession();
      const endpoints = ['/api/v1/agents', '/api/v1/policies', '/api/v1/approvals', '/api/v1/traces'];
      for (const url of endpoints) {
        const res = await app.inject({
          method: 'GET',
          url,
          headers: admin.headers(),
        });
        expect(res.statusCode).toBe(200);
      }
    });

    it('can GET /api/v1/users', async () => {
      const admin = await createAdminSession();
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: admin.headers(),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('can PATCH /api/v1/users/:id to change role', async () => {
      const admin = await createAdminSession();
      const otherUser = await prisma.user.create({
        data: {
          tenant_id: testData.tenant.id,
          email: 'other@test.com',
          name: 'Other User',
          role: 'viewer',
          auth_provider: 'email',
        },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${otherUser.id}`,
        headers: admin.headers('PATCH'),
        payload: { role: 'reviewer' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.role).toBe('reviewer');

      // Verify in DB
      const updated = await prisma.user.findUnique({ where: { id: otherUser.id } });
      expect(updated?.role).toBe('reviewer');
    });

    it('cannot change own role', async () => {
      const admin = await createAdminSession();
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${admin.userId}`,
        headers: admin.headers('PATCH'),
        payload: { role: 'viewer' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().message).toContain('Cannot change your own role');
    });

    it('cannot delete self', async () => {
      const admin = await createAdminSession();
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${admin.userId}`,
        headers: admin.headers('DELETE'),
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().message).toContain('Cannot delete yourself');
    });

    it('can access webhook endpoints', async () => {
      const admin = await createAdminSession();
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/webhooks',
        headers: admin.headers(),
      });
      expect(res.statusCode).toBe(200);
    });

    it('can approve requests', async () => {
      const admin = await createAdminSession();
      const approvalId = await createPendingApproval();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approvalId}/approve`,
        headers: admin.headers('POST'),
        payload: { approver_name: 'Admin User', decision_note: 'Admin approved' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('User management', () => {
    it('PATCH /users/:id changes role', async () => {
      const admin = await createAdminSession();
      const viewer = await createUserWithSession('viewer');

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${viewer.userId}`,
        headers: admin.headers('PATCH'),
        payload: { role: 'admin' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.role).toBe('admin');
    });

    it('DELETE /users/:id removes user and invalidates sessions', async () => {
      const admin = await createAdminSession();
      const viewer = await createUserWithSession('viewer');

      // Verify viewer can access API
      const before = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: viewer.headers(),
      });
      expect(before.statusCode).toBe(200);

      // Delete the viewer
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${viewer.userId}`,
        headers: admin.headers('DELETE'),
      });
      expect(deleteRes.statusCode).toBe(204);

      // Verify viewer session is invalidated
      const after = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: viewer.headers(),
      });
      expect(after.statusCode).toBe(401);
    });

    it('role change takes effect on next API call', async () => {
      const admin = await createAdminSession();
      const reviewer = await createUserWithSession('reviewer');

      // Reviewer cannot create agents
      const before = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: reviewer.headers('POST'),
        payload: { name: 'test' },
      });
      expect(before.statusCode).toBe(403);

      // Admin promotes reviewer to admin
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${reviewer.userId}`,
        headers: admin.headers('PATCH'),
        payload: { role: 'admin' },
      });

      // Now the same user (with existing session) can create agents
      // The role is fetched fresh from DB on each request via session validation
      const after = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: reviewer.headers('POST'),
        payload: {
          name: 'New Agent',
          description: 'Created by promoted user',
          owner_name: 'Test',
          owner_role: 'Engineer',
          team: 'Test',
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
      expect(after.statusCode).toBe(201);
    });
  });

  describe('API key auth (regression)', () => {
    it('API key auth skips role check', async () => {
      // API key auth has no userRole set, so requireRole should skip
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: {
          authorization: `Bearer ${testData.rawApiKey}`,
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('SDK evaluate still works with API key', async () => {
      await prisma.policyRule.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'RBAC Regression Policy',
          target_integration: 'database',
          operation: 'read',
          resource_scope: 'public_tables',
          data_classification: 'internal',
          policy_effect: 'allow',
          rationale: 'Public data is fine',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: {
          authorization: `Bearer ${testData.rawApiKey}`,
          'content-type': 'application/json',
        },
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'database',
          resource_scope: 'public_tables',
          data_classification: 'internal',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().decision).toBe('allow');
    });
  });
});
