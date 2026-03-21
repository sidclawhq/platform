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
import { randomUUID, createHash } from 'node:crypto';

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
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function signup(data: { email: string; password: string; name: string }) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: data,
  });
}

async function login(data: { email: string; password: string }) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login/email',
    payload: data,
  });
}

async function createAdminSessionForTenant(tenantId: string, userId: string) {
  const sessionManager = new SessionManager(prisma);
  const sessionId = await sessionManager.create(userId, tenantId);
  const csrfToken = randomUUID();
  return {
    cookie: `session=${sessionId}; csrf_token=${csrfToken}`,
    csrfToken,
  };
}

function sessionHeaders(session: { cookie: string; csrfToken: string }, method?: string) {
  const h: Record<string, string> = {
    cookie: session.cookie,
    'content-type': 'application/json',
  };
  if (method && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    h['x-csrf-token'] = session.csrfToken;
  }
  return h;
}

function agentPayload(i: number) {
  return {
    name: `Agent ${i}`,
    description: 'Test agent',
    owner_name: 'Test Owner',
    owner_role: 'Engineer',
    team: 'Test',
    environment: 'dev',
    authority_model: 'self',
    identity_mode: 'service_identity',
    delegation_model: 'self',
    autonomy_tier: 'low',
    authorized_integrations: [],
    credential_config: null,
    metadata: null,
    next_review_date: new Date(Date.now() + 86400000 * 30).toISOString(),
    created_by: 'test-setup',
  };
}

const VALID_SIGNUP = {
  email: 'alice@example.com',
  password: 'StrongP@ss123',
  name: 'Alice Test',
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Email/password signup', () => {
  it('creates tenant + user + API key atomically', async () => {
    const res = await signup(VALID_SIGNUP);
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.data.user).toBeDefined();
    expect(body.data.tenant).toBeDefined();
    expect(body.data.api_key).toBeDefined();

    expect(body.data.user.email).toBe('alice@example.com');
    expect(body.data.user.name).toBe('Alice Test');
    expect(body.data.tenant.name).toContain('workspace');

    // Verify in DB
    const dbUser = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.tenant_id).toBe(body.data.tenant.id);

    const dbTenant = await prisma.tenant.findUnique({ where: { id: body.data.tenant.id } });
    expect(dbTenant).not.toBeNull();

    const dbKeys = await prisma.apiKey.findMany({ where: { tenant_id: body.data.tenant.id } });
    expect(dbKeys.length).toBe(1);
  });

  it('user role is admin', async () => {
    const res = await signup(VALID_SIGNUP);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.user.role).toBe('admin');
  });

  it('tenant plan is free', async () => {
    const res = await signup(VALID_SIGNUP);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.tenant.plan).toBe('free');
  });

  it('API key has default scopes', async () => {
    const res = await signup(VALID_SIGNUP);
    expect(res.statusCode).toBe(201);
    const body = res.json();

    // Find the API key in DB and check scopes
    const dbKeys = await prisma.apiKey.findMany({ where: { tenant_id: body.data.tenant.id } });
    expect(dbKeys.length).toBe(1);
    expect(dbKeys[0]!.scopes).toEqual(['evaluate', 'traces:read', 'traces:write', 'approvals:read']);
  });

  it('returns raw API key in response (once)', async () => {
    const res = await signup(VALID_SIGNUP);
    expect(res.statusCode).toBe(201);
    const body = res.json();

    const rawKey = body.data.api_key;
    expect(rawKey).toBeDefined();
    expect(typeof rawKey).toBe('string');
    expect(rawKey).toMatch(/^ai_/);

    // Verify the hash matches what is in DB
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const dbKey = await prisma.apiKey.findMany({ where: { tenant_id: body.data.tenant.id } });
    expect(dbKey[0]!.key_hash).toBe(keyHash);
  });

  it('rejects duplicate email (409)', async () => {
    const first = await signup(VALID_SIGNUP);
    expect(first.statusCode).toBe(201);

    const second = await signup(VALID_SIGNUP);
    expect(second.statusCode).toBe(409);
    const body = second.json();
    expect(body.error).toBe('conflict');
  });

  it('rejects weak password (400)', async () => {
    const res = await signup({
      email: 'weak@example.com',
      password: 'short',
      name: 'Weak Pass',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('validation_error');
  });

  it('rejects invalid email format (400)', async () => {
    const res = await signup({
      email: 'not-an-email',
      password: 'StrongP@ss123',
      name: 'Bad Email',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('validation_error');
  });
});

describe('Email/password login', () => {
  it('logs in existing email user', async () => {
    // First signup
    await signup(VALID_SIGNUP);

    // Then login
    const res = await login({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.data.user.email).toBe(VALID_SIGNUP.email);
    expect(body.data.tenant).toBeDefined();

    // Check set-cookie header
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    // Should contain session and csrf_token cookies
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).toContain('session=');
    expect(cookieStr).toContain('csrf_token=');
  });

  it('rejects wrong password', async () => {
    await signup(VALID_SIGNUP);

    const res = await login({ email: VALID_SIGNUP.email, password: 'WrongP@ss999' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects nonexistent user', async () => {
    const res = await login({ email: 'nobody@example.com', password: 'StrongP@ss123' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Plan limits', () => {
  it('free plan: 6th agent returns 402', async () => {
    // Signup creates a free-plan tenant
    const signupRes = await signup(VALID_SIGNUP);
    expect(signupRes.statusCode).toBe(201);
    const { user, tenant } = signupRes.json().data;

    const session = await createAdminSessionForTenant(tenant.id, user.id);

    // Create 5 agents (free limit)
    for (let i = 1; i <= 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: sessionHeaders(session, 'POST'),
        payload: agentPayload(i),
      });
      expect(res.statusCode).toBe(201);
    }

    // 6th should fail
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: sessionHeaders(session, 'POST'),
      payload: agentPayload(6),
    });
    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.error).toBe('plan_limit_reached');
    expect(body.details.limit).toBe('max_agents');
  });

  it('free plan: 3rd API key returns 402', async () => {
    // Signup creates 1 API key already
    const signupRes = await signup(VALID_SIGNUP);
    expect(signupRes.statusCode).toBe(201);
    const { user, tenant } = signupRes.json().data;

    const session = await createAdminSessionForTenant(tenant.id, user.id);

    // Create 1 more (total 2 = free limit)
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      headers: sessionHeaders(session, 'POST'),
      payload: { name: 'Key 2', scopes: ['evaluate'] },
    });
    expect(res1.statusCode).toBe(201);

    // 3rd should fail (total would be 3, limit is 2)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      headers: sessionHeaders(session, 'POST'),
      payload: { name: 'Key 3', scopes: ['evaluate'] },
    });
    expect(res2.statusCode).toBe(402);
    const body = res2.json();
    expect(body.error).toBe('plan_limit_reached');
    expect(body.details.limit).toBe('max_api_keys');
  });

  it('free plan: 2nd webhook returns 402', async () => {
    const signupRes = await signup(VALID_SIGNUP);
    expect(signupRes.statusCode).toBe(201);
    const { user, tenant } = signupRes.json().data;

    const session = await createAdminSessionForTenant(tenant.id, user.id);

    // Create 1 webhook (free limit)
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: sessionHeaders(session, 'POST'),
      payload: { url: 'http://localhost:9999/hook1', events: ['approval.requested'] },
    });
    expect(res1.statusCode).toBe(201);

    // 2nd should fail
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: sessionHeaders(session, 'POST'),
      payload: { url: 'http://localhost:9999/hook2', events: ['approval.requested'] },
    });
    expect(res2.statusCode).toBe(402);
    const body = res2.json();
    expect(body.error).toBe('plan_limit_reached');
    expect(body.details.limit).toBe('max_webhook_endpoints');
  });

  it('enterprise plan: no limits enforced', async () => {
    // seedTestData creates an enterprise tenant
    testData = await seedTestData(prisma);

    // Create 6 agents via API key auth (no limit on enterprise)
    for (let i = 1; i <= 6; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: {
          authorization: `Bearer ${testData.rawApiKey}`,
          'content-type': 'application/json',
        },
        payload: agentPayload(i),
      });
      expect(res.statusCode).toBe(201);
    }
  });

  it('402 response includes limit name, current count, max', async () => {
    const signupRes = await signup(VALID_SIGNUP);
    expect(signupRes.statusCode).toBe(201);
    const { user, tenant } = signupRes.json().data;

    const session = await createAdminSessionForTenant(tenant.id, user.id);

    // Fill up to 5 agents
    for (let i = 1; i <= 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: sessionHeaders(session, 'POST'),
        payload: agentPayload(i),
      });
    }

    // Trigger limit
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: sessionHeaders(session, 'POST'),
      payload: agentPayload(6),
    });

    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.details).toBeDefined();
    expect(body.details.limit).toBe('max_agents');
    expect(body.details.current).toBe(5);
    expect(body.details.max).toBe(5);
  });
});

describe('Onboarding', () => {
  it('GET /tenant/onboarding returns all steps as false initially', async () => {
    const signupRes = await signup(VALID_SIGNUP);
    expect(signupRes.statusCode).toBe(201);
    const { user, tenant } = signupRes.json().data;

    const session = await createAdminSessionForTenant(tenant.id, user.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/onboarding',
      headers: sessionHeaders(session),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toEqual({
      copy_api_key: false,
      register_agent: false,
      create_policy: false,
      run_evaluation: false,
      see_trace: false,
    });
  });

  it('PATCH /tenant/onboarding updates step completion', async () => {
    const signupRes = await signup(VALID_SIGNUP);
    expect(signupRes.statusCode).toBe(201);
    const { user, tenant } = signupRes.json().data;

    const session = await createAdminSessionForTenant(tenant.id, user.id);

    // Update copy_api_key step
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/onboarding',
      headers: sessionHeaders(session, 'PATCH'),
      payload: { copy_api_key: true },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = patchRes.json();
    expect(patchBody.data.copy_api_key).toBe(true);

    // Verify via GET
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/onboarding',
      headers: sessionHeaders(session),
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.data.copy_api_key).toBe(true);
    // Other steps remain false
    expect(getBody.data.register_agent).toBe(false);
    expect(getBody.data.create_policy).toBe(false);
    expect(getBody.data.run_evaluation).toBe(false);
    expect(getBody.data.see_trace).toBe(false);
  });
});
