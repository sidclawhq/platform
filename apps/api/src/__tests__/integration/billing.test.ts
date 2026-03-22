import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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
    user,
    cookieHeader,
    csrfToken,
    headers: {
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Billing', () => {
  describe('GET /api/v1/billing/status', () => {
    it('returns free status for free-plan tenant', async () => {
      // Change tenant to free plan
      await prisma.tenant.update({
        where: { id: testData.tenant.id },
        data: { plan: 'free' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/status',
        headers: {
          authorization: `Bearer ${testData.rawApiKey}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.plan).toBe('free');
      expect(body.data.status).toBeNull();
      expect(body.data.current_period_end).toBeNull();
      expect(body.data.cancel_at_period_end).toBe(false);
    });

    it('returns plan status for paying tenant without stripe', async () => {
      await prisma.tenant.update({
        where: { id: testData.tenant.id },
        data: { plan: 'business', stripe_customer_id: 'cus_fake_123' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/status',
        headers: {
          authorization: `Bearer ${testData.rawApiKey}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.plan).toBe('business');
      // Without real Stripe connection, these will be null (graceful degradation)
      expect(body.data).toHaveProperty('status');
      expect(body.data).toHaveProperty('current_period_end');
      expect(body.data).toHaveProperty('cancel_at_period_end');
    });
  });

  describe('POST /api/v1/billing/checkout', () => {
    it('returns 400 for invalid plan', async () => {
      const { headers } = await createUserWithSession('admin');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers,
        payload: { plan: 'invalid' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 501 when Stripe is not configured', async () => {
      const { headers } = await createUserWithSession('admin');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers,
        payload: { plan: 'starter' },
      });

      // Without STRIPE_SECRET_KEY env var, should return 501
      expect(response.statusCode).toBe(501);
      const body = response.json();
      expect(body.error).toBe('billing_not_configured');
    });

    it('requires admin role', async () => {
      const { headers } = await createUserWithSession('viewer');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers,
        payload: { plan: 'starter' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/billing/portal', () => {
    it('returns 501 when Stripe is not configured', async () => {
      const { headers } = await createUserWithSession('admin');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/portal',
        headers,
      });

      expect(response.statusCode).toBe(501);
      const body = response.json();
      expect(body.error).toBe('billing_not_configured');
    });

    it('requires admin role', async () => {
      const { headers } = await createUserWithSession('reviewer');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/portal',
        headers,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/billing/webhook', () => {
    it('skips auth middleware (no auth required)', async () => {
      // Sending without auth should NOT return 401
      // It should return 400 because of missing signature, not 401
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/webhook',
        payload: { type: 'test' },
      });

      // Should be 400 (missing signature) not 401 (unauthorized)
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toMatch(/Missing signature|Invalid signature/);
    });

    it('rejects requests without stripe-signature header', async () => {
      // Set the webhook secret env var temporarily
      const origSecret = process.env['STRIPE_WEBHOOK_SECRET'];
      process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_secret';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/webhook',
        payload: { type: 'checkout.session.completed' },
      });

      expect(response.statusCode).toBe(400);

      // Restore
      if (origSecret) {
        process.env['STRIPE_WEBHOOK_SECRET'] = origSecret;
      } else {
        delete process.env['STRIPE_WEBHOOK_SECRET'];
      }
    });
  });
});

describe('Admin Usage', () => {
  describe('GET /api/v1/admin/usage', () => {
    it('returns 403 without super admin key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/usage',
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 403 with wrong key', async () => {
      const origKey = process.env['SUPER_ADMIN_KEY'];
      process.env['SUPER_ADMIN_KEY'] = 'correct_key';

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/usage',
        headers: {
          authorization: 'Bearer wrong_key',
        },
      });

      expect(response.statusCode).toBe(403);

      if (origKey) {
        process.env['SUPER_ADMIN_KEY'] = origKey;
      } else {
        delete process.env['SUPER_ADMIN_KEY'];
      }
    });

    it('returns usage summary for super admin', async () => {
      const superKey = 'test_super_admin_key_' + randomUUID();
      const origKey = process.env['SUPER_ADMIN_KEY'];
      process.env['SUPER_ADMIN_KEY'] = superKey;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/usage',
        headers: {
          authorization: `Bearer ${superKey}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Summary fields
      expect(body.summary).toHaveProperty('total_tenants');
      expect(body.summary).toHaveProperty('paying_tenants');
      expect(body.summary).toHaveProperty('free_tenants');
      expect(body.summary).toHaveProperty('total_traces_today');
      expect(body.summary).toHaveProperty('total_traces_week');
      expect(body.summary).toHaveProperty('active_today');
      expect(body.summary).toHaveProperty('active_this_week');

      // Tenants array
      expect(Array.isArray(body.tenants)).toBe(true);
      expect(body.tenants.length).toBeGreaterThanOrEqual(1);

      const tenant = body.tenants[0];
      expect(tenant).toHaveProperty('id');
      expect(tenant).toHaveProperty('name');
      expect(tenant).toHaveProperty('plan');
      expect(tenant).toHaveProperty('agents');
      expect(tenant).toHaveProperty('users');
      expect(tenant).toHaveProperty('policies');
      expect(tenant).toHaveProperty('api_keys');
      expect(tenant).toHaveProperty('traces_today');
      expect(tenant).toHaveProperty('traces_this_week');
      expect(tenant).toHaveProperty('last_active');
      expect(tenant).toHaveProperty('is_paying');

      // Restore
      if (origKey) {
        process.env['SUPER_ADMIN_KEY'] = origKey;
      } else {
        delete process.env['SUPER_ADMIN_KEY'];
      }
    });

    it('includes per-tenant metrics', async () => {
      const superKey = 'test_super_admin_key_' + randomUUID();
      const origKey = process.env['SUPER_ADMIN_KEY'];
      process.env['SUPER_ADMIN_KEY'] = superKey;

      // Create a trace to verify counting works
      await prisma.auditTrace.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          authority_model: 'self',
          requested_operation: 'test:read',
          target_integration: 'test-service',
          resource_scope: '*',
          final_outcome: 'allowed',
          started_at: new Date(),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/usage',
        headers: {
          authorization: `Bearer ${superKey}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      const tenant = body.tenants.find((t: { id: string }) => t.id === testData.tenant.id);
      expect(tenant).toBeTruthy();
      expect(tenant.traces_today).toBeGreaterThanOrEqual(1);
      expect(tenant.traces_this_week).toBeGreaterThanOrEqual(1);
      expect(tenant.last_active).not.toBeNull();
      expect(tenant.agents).toBeGreaterThanOrEqual(1);

      // Restore
      if (origKey) {
        process.env['SUPER_ADMIN_KEY'] = origKey;
      } else {
        delete process.env['SUPER_ADMIN_KEY'];
      }
    });
  });
});
