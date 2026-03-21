import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
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

/** Creates a session via dev-login and returns cookies */
async function devLogin(): Promise<{ sessionCookie: string; csrfToken: string }> {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/dev-login?redirect_uri=/dashboard',
  });

  expect(response.statusCode).toBe(302);

  const setCookieHeaders = response.headers['set-cookie'];
  const rawCookies = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders!];

  let sessionCookie = '';
  let csrfToken = '';

  for (const c of rawCookies) {
    const parsed = cookie.parse(c);
    if (parsed['session']) sessionCookie = parsed['session'];
    if (parsed['csrf_token']) csrfToken = parsed['csrf_token'];
  }

  return { sessionCookie, csrfToken };
}

/** Builds cookie header from session and CSRF values */
function cookieHeader(sessionCookie: string, csrfToken: string): string {
  return `session=${sessionCookie}; csrf_token=${csrfToken}`;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Authentication', () => {
  describe('Development mode', () => {
    it('dev-login creates session and sets cookies', async () => {
      const { sessionCookie, csrfToken } = await devLogin();
      expect(sessionCookie).toBeTruthy();
      expect(csrfToken).toBeTruthy();

      // Verify session was created in DB
      const sessions = await prisma.session.findMany();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.user_id).toBe(testData.user.id);
      expect(sessions[0]!.tenant_id).toBe(testData.tenant.id);
    });

    it('session cookie authenticates subsequent requests', async () => {
      const { sessionCookie, csrfToken } = await devLogin();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: {
          cookie: cookieHeader(sessionCookie, csrfToken),
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /auth/me returns user info', async () => {
      const { sessionCookie, csrfToken } = await devLogin();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          cookie: cookieHeader(sessionCookie, csrfToken),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toMatchObject({
        id: testData.user.id,
        email: testData.user.email,
        name: testData.user.name,
        role: 'admin',
        tenant_id: testData.tenant.id,
        tenant_name: testData.tenant.name,
      });
    });

    it('POST /auth/logout clears session', async () => {
      const { sessionCookie, csrfToken } = await devLogin();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          cookie: cookieHeader(sessionCookie, csrfToken),
        },
      });

      expect(response.statusCode).toBe(200);

      // Session should be removed from DB
      const sessions = await prisma.session.findMany();
      expect(sessions).toHaveLength(0);

      // Verify session cookie was cleared (Max-Age=0)
      const setCookieHeaders = response.headers['set-cookie'];
      const rawCookies = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : [setCookieHeaders!];
      const sessionCookieHeader = rawCookies.find((c) => c.startsWith('session='));
      expect(sessionCookieHeader).toContain('Max-Age=0');
    });

    it('expired session returns 401', async () => {
      const { sessionCookie, csrfToken } = await devLogin();

      // Manually expire the session
      await prisma.session.updateMany({
        data: { expires_at: new Date(Date.now() - 1000) },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: {
          cookie: cookieHeader(sessionCookie, csrfToken),
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('CSRF protection', () => {
    it('POST without CSRF token returns 403 for session auth', async () => {
      const { sessionCookie } = await devLogin();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/agents/test-agent/suspend',
        headers: {
          cookie: `session=${sessionCookie}`,
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('forbidden');
    });

    it('POST with valid CSRF token succeeds for session auth', async () => {
      const { sessionCookie, csrfToken } = await devLogin();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/agents/test-agent/suspend',
        headers: {
          cookie: cookieHeader(sessionCookie, csrfToken),
          'x-csrf-token': csrfToken,
          'content-type': 'application/json',
        },
        payload: {},
      });

      // Should succeed — not blocked by CSRF
      expect(response.statusCode).toBe(200);
    });

    it('API key auth does not require CSRF token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/agents/test-agent/suspend',
        headers: {
          authorization: `Bearer ${testData.rawApiKey}`,
          'content-type': 'application/json',
        },
        payload: {},
      });

      // Should succeed without CSRF
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Session management', () => {
    it('expired sessions are rejected', async () => {
      const { sessionCookie, csrfToken } = await devLogin();

      await prisma.session.updateMany({
        data: { expires_at: new Date(Date.now() - 1000) },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          cookie: cookieHeader(sessionCookie, csrfToken),
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('destroyed sessions are rejected', async () => {
      const { sessionCookie, csrfToken } = await devLogin();

      await prisma.session.deleteMany();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          cookie: cookieHeader(sessionCookie, csrfToken),
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('destroying all sessions for a user invalidates all', async () => {
      const login1 = await devLogin();
      const login2 = await devLogin();

      await prisma.session.deleteMany({
        where: { user_id: testData.user.id },
      });

      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { cookie: cookieHeader(login1.sessionCookie, login1.csrfToken) },
      });

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { cookie: cookieHeader(login2.sessionCookie, login2.csrfToken) },
      });

      expect(res1.statusCode).toBe(401);
      expect(res2.statusCode).toBe(401);
    });
  });

  describe('API key auth (regression)', () => {
    it('API key auth still works after session auth is added', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: {
          authorization: `Bearer ${testData.rawApiKey}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('SDK evaluate with API key still works', async () => {
      await prisma.policyRule.create({
        data: {
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Allow reads',
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

      const response = await app.inject({
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

      expect(response.statusCode).toBe(200);
      expect(response.json().decision).toBe('allow');
    });

    it('no auth at all returns 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
      });

      expect(response.statusCode).toBe(401);
    });

    it('invalid API key returns 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: {
          authorization: 'Bearer ai_invalid_key_000000000000000000',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Auth endpoints skip auth middleware', () => {
    it('GET /auth/me without session returns 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /auth/logout without session succeeds', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(response.statusCode).toBe(200);
    });

    it('allows unauthenticated access to /health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
