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

async function createUserWithSession(role: 'admin' | 'reviewer' | 'viewer') {
  const user = await prisma.user.create({
    data: {
      tenant_id: testData.tenant.id,
      email: `${role}-${randomUUID().slice(0, 8)}@test.com`,
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
    headers: (method?: string) => {
      const h: Record<string, string> = { cookie: cookieHeader };
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

async function createAdminSession() {
  const sessionManager = new SessionManager(prisma);
  const sessionId = await sessionManager.create(testData.user.id, testData.tenant.id);
  const csrfToken = randomUUID();
  const cookieHeader = `session=${sessionId}; csrf_token=${csrfToken}`;

  return {
    headers: (method?: string) => {
      const h: Record<string, string> = { cookie: cookieHeader };
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Tenant Settings', () => {
  it('GET /tenant/settings returns current settings', async () => {
    const admin = await createAdminSession();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/settings',
      headers: admin.headers(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(testData.tenant.id);
    expect(body.data.name).toBe('Test Workspace');
    expect(body.data.slug).toBe('test');
    expect(body.data.plan).toBe('enterprise');
    expect(body.data.settings.default_approval_ttl_seconds).toBe(86400);
    expect(body.data.settings.default_data_classification).toBe('internal');
    expect(body.data.settings.notification_email).toBeNull();
  });

  it('PATCH /tenant/settings updates name', async () => {
    const admin = await createAdminSession();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: { name: 'Updated Workspace' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Workspace');

    // Verify persisted
    const tenant = await prisma.tenant.findUnique({ where: { id: testData.tenant.id } });
    expect(tenant?.name).toBe('Updated Workspace');
  });

  it('PATCH /tenant/settings updates default_approval_ttl_seconds', async () => {
    const admin = await createAdminSession();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { default_approval_ttl_seconds: 3600 },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.settings.default_approval_ttl_seconds).toBe(3600);
  });

  it('PATCH /tenant/settings updates notification_email', async () => {
    const admin = await createAdminSession();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { notification_email: 'alerts@company.com' },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.settings.notification_email).toBe('alerts@company.com');

    // Can clear it
    const res2 = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { notification_email: null },
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().data.settings.notification_email).toBeNull();
  });

  it('PATCH /tenant/settings updates notifications_enabled', async () => {
    const admin = await createAdminSession();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { notifications_enabled: true },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.settings.notifications_enabled).toBe(true);
  });

  it('PATCH /tenant/settings preserves unchanged settings', async () => {
    const admin = await createAdminSession();

    // Update TTL only
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { default_approval_ttl_seconds: 7200 },
      },
    });

    // Update classification only — TTL should remain at 7200
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { default_data_classification: 'confidential' },
      },
    });

    expect(res.statusCode).toBe(200);
    const settings = res.json().data.settings;
    expect(settings.default_approval_ttl_seconds).toBe(7200);
    expect(settings.default_data_classification).toBe('confidential');
  });

  it('PATCH /tenant/settings requires admin role', async () => {
    const viewer = await createUserWithSession('viewer');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: viewer.headers('PATCH'),
      payload: { name: 'Should Fail' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('viewer can GET /tenant/settings', async () => {
    const viewer = await createUserWithSession('viewer');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/settings',
      headers: viewer.headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Test Workspace');
  });

  it('reviewer cannot PATCH /tenant/settings', async () => {
    const reviewer = await createUserWithSession('reviewer');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: reviewer.headers('PATCH'),
      payload: { name: 'Should Fail' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('validates TTL range', async () => {
    const admin = await createAdminSession();

    // Too low
    const res1 = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { default_approval_ttl_seconds: 10 },
      },
    });
    expect(res1.statusCode).toBe(400);

    // Too high
    const res2 = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { default_approval_ttl_seconds: 999999 },
      },
    });
    expect(res2.statusCode).toBe(400);
  });

  it('validates data classification enum', async () => {
    const admin = await createAdminSession();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: {
        settings: { default_data_classification: 'invalid_value' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unknown fields (strict mode)', async () => {
    const admin = await createAdminSession();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/settings',
      headers: admin.headers('PATCH'),
      payload: { unknown_field: 'value' },
    });
    expect(res.statusCode).toBe(400);
  });
});
