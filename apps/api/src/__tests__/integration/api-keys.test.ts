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
import { createHash, randomBytes, randomUUID } from 'node:crypto';

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

async function createAdminSession() {
  const sessionManager = new SessionManager(prisma);
  const sessionId = await sessionManager.create(testData.user.id, testData.tenant.id);
  const csrfToken = randomUUID();
  const cookieHeader = `session=${sessionId}; csrf_token=${csrfToken}`;

  return {
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

async function createUserWithSession(role: 'admin' | 'reviewer' | 'viewer') {
  const user = await prisma.user.create({
    data: {
      tenant_id: testData.tenant.id,
      email: `${role}-${randomUUID().slice(0, 8)}@test.com`,
      name: `Test ${role}`,
      role,
      auth_provider: 'email',
    },
  });

  const sessionManager = new SessionManager(prisma);
  const sessionId = await sessionManager.create(user.id, testData.tenant.id);
  const csrfToken = randomUUID();
  const cookieHeader = `session=${sessionId}; csrf_token=${csrfToken}`;

  return {
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

/** Creates an API key with specific scopes and returns the raw key */
async function createApiKeyWithScopes(scopes: string[]): Promise<string> {
  const rawKey = 'ai_' + randomBytes(32).toString('hex');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  await prisma.apiKey.create({
    data: {
      tenant_id: testData.tenant.id,
      name: `Test key ${randomUUID().slice(0, 8)}`,
      key_prefix: rawKey.substring(0, 12),
      key_hash: keyHash,
      scopes,
    },
  });
  return rawKey;
}

/** Creates a policy so evaluate has something to match */
async function createAllowPolicy() {
  await prisma.policyRule.create({
    data: {
      tenant_id: testData.tenant.id,
      agent_id: testData.agent.id,
      policy_name: 'API Key Test Policy',
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
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('API Key Management', () => {
  describe('CRUD', () => {
    it('creates key and returns raw key exactly once', async () => {
      const admin = await createAdminSession();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: admin.headers('POST'),
        payload: {
          name: 'My New Key',
          scopes: ['evaluate', 'traces:read'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.key).toBeDefined();
      expect(body.data.key).toMatch(/^ai_/);
      expect(body.data.name).toBe('My New Key');
      expect(body.data.scopes).toEqual(['evaluate', 'traces:read']);
      expect(body.data.key_prefix).toBe(body.data.key.substring(0, 12));
    });

    it('list shows key_prefix but NOT raw key', async () => {
      const admin = await createAdminSession();

      // Create a key first
      await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: admin.headers('POST'),
        payload: { name: 'List Test', scopes: ['evaluate'] },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/api-keys',
        headers: admin.headers(),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      // Should include the seeded key + the new one
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      for (const key of body.data) {
        expect(key.key_prefix).toBeDefined();
        expect(key.key).toBeUndefined();
        expect(key.key_hash).toBeUndefined();
      }
    });

    it('delete removes key', async () => {
      const admin = await createAdminSession();

      // Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: admin.headers('POST'),
        payload: { name: 'Delete Test', scopes: ['evaluate'] },
      });
      const keyId = createRes.json().data.id;

      // Delete
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/api-keys/${keyId}`,
        headers: admin.headers('DELETE'),
      });
      expect(deleteRes.statusCode).toBe(204);

      // Verify gone from list
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/api-keys',
        headers: admin.headers(),
      });
      const ids = listRes.json().data.map((k: { id: string }) => k.id);
      expect(ids).not.toContain(keyId);
    });

    it('deleted key returns 401 on next use', async () => {
      const admin = await createAdminSession();

      // Create and get the raw key
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: admin.headers('POST'),
        payload: { name: 'Delete Auth Test', scopes: ['admin'] },
      });
      const { id: keyId, key: rawKey } = createRes.json().data;

      // Verify it works
      const beforeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${rawKey}` },
      });
      expect(beforeRes.statusCode).toBe(200);

      // Delete it
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/api-keys/${keyId}`,
        headers: admin.headers('DELETE'),
      });

      // Verify rejected
      const afterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${rawKey}` },
      });
      expect(afterRes.statusCode).toBe(401);
    });

    it('rotate generates new key and invalidates old', async () => {
      const admin = await createAdminSession();

      // Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: admin.headers('POST'),
        payload: { name: 'Rotate Test', scopes: ['admin'] },
      });
      const { id: keyId, key: oldKey } = createRes.json().data;

      // Rotate
      const rotateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/api-keys/${keyId}/rotate`,
        headers: admin.headers('POST'),
        payload: {},
      });
      expect(rotateRes.statusCode).toBe(200);
      const { key: newKey } = rotateRes.json().data;
      expect(newKey).toBeDefined();
      expect(newKey).toMatch(/^ai_/);
      expect(newKey).not.toBe(oldKey);
    });

    it('rotated old key returns 401', async () => {
      const admin = await createAdminSession();

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: admin.headers('POST'),
        payload: { name: 'Rotate Old Test', scopes: ['admin'] },
      });
      const { id: keyId, key: oldKey } = createRes.json().data;

      // Rotate
      await app.inject({
        method: 'POST',
        url: `/api/v1/api-keys/${keyId}/rotate`,
        headers: admin.headers('POST'),
        payload: {},
      });

      // Old key should fail
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${oldKey}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rotated new key works', async () => {
      const admin = await createAdminSession();

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: admin.headers('POST'),
        payload: { name: 'Rotate New Test', scopes: ['admin'] },
      });
      const { id: keyId } = createRes.json().data;

      // Rotate
      const rotateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/api-keys/${keyId}/rotate`,
        headers: admin.headers('POST'),
        payload: {},
      });
      const { key: newKey } = rotateRes.json().data;

      // New key should work
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${newKey}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('only admins can manage keys (403 for reviewer/viewer)', async () => {
      const reviewer = await createUserWithSession('reviewer');
      const viewer = await createUserWithSession('viewer');

      for (const user of [reviewer, viewer]) {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/api-keys',
          headers: user.headers(),
        });
        expect(res.statusCode).toBe(403);

        const createRes = await app.inject({
          method: 'POST',
          url: '/api/v1/api-keys',
          headers: user.headers('POST'),
          payload: { name: 'Nope', scopes: ['evaluate'] },
        });
        expect(createRes.statusCode).toBe(403);
      }
    });
  });

  describe('Scope enforcement', () => {
    it('key with [evaluate] can POST /evaluate', async () => {
      await createAllowPolicy();
      const key = await createApiKeyWithScopes(['evaluate']);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: {
          authorization: `Bearer ${key}`,
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
    });

    it('key with [evaluate] cannot GET /agents (403)', async () => {
      const key = await createApiKeyWithScopes(['evaluate']);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('key with [traces:read] can GET /traces', async () => {
      const key = await createApiKeyWithScopes(['traces:read']);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('key with [traces:read] cannot POST /evaluate (403)', async () => {
      const key = await createApiKeyWithScopes(['traces:read']);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: {
          authorization: `Bearer ${key}`,
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
      expect(res.statusCode).toBe(403);
    });

    it('key with [admin] can access everything', async () => {
      const key = await createApiKeyWithScopes(['admin']);

      const agentsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(agentsRes.statusCode).toBe(200);

      const tracesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(tracesRes.statusCode).toBe(200);
    });

    it('key with [*] can access everything (legacy seed key)', async () => {
      const key = await createApiKeyWithScopes(['*']);

      const agentsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(agentsRes.statusCode).toBe(200);

      const tracesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/traces',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(tracesRes.statusCode).toBe(200);

      const approvalsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(approvalsRes.statusCode).toBe(200);
    });

    it('key with [agents:read] can GET /agents but not POST /agents', async () => {
      const key = await createApiKeyWithScopes(['agents:read']);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(getRes.statusCode).toBe(200);

      // POST /agents is not in the scope mapping, requires admin
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        payload: { name: 'test' },
      });
      expect(postRes.statusCode).toBe(403);
    });
  });

  describe('Expiry', () => {
    it('expired key returns 401', async () => {
      const rawKey = 'ai_' + randomBytes(32).toString('hex');
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      await prisma.apiKey.create({
        data: {
          tenant_id: testData.tenant.id,
          name: 'Expired Key',
          key_prefix: rawKey.substring(0, 12),
          key_hash: keyHash,
          scopes: ['*'],
          expires_at: new Date(Date.now() - 60000), // expired 1 min ago
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${rawKey}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('non-expired key works', async () => {
      const rawKey = 'ai_' + randomBytes(32).toString('hex');
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      await prisma.apiKey.create({
        data: {
          tenant_id: testData.tenant.id,
          name: 'Future Key',
          key_prefix: rawKey.substring(0, 12),
          key_hash: keyHash,
          scopes: ['*'],
          expires_at: new Date(Date.now() + 3600000), // expires in 1 hour
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${rawKey}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('last_used_at', () => {
    it('updates on first use', async () => {
      const rawKey = 'ai_' + randomBytes(32).toString('hex');
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const apiKey = await prisma.apiKey.create({
        data: {
          tenant_id: testData.tenant.id,
          name: 'Last Used Test',
          key_prefix: rawKey.substring(0, 12),
          key_hash: keyHash,
          scopes: ['*'],
        },
      });

      expect(apiKey.last_used_at).toBeNull();

      await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${rawKey}` },
      });

      // Wait briefly for fire-and-forget update
      await new Promise((r) => setTimeout(r, 100));

      const updated = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
      expect(updated!.last_used_at).not.toBeNull();
    });

    it('debounced (does not update on every request)', async () => {
      const rawKey = 'ai_' + randomBytes(32).toString('hex');
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const recentTime = new Date(Date.now() - 10000); // 10 seconds ago (within 1 min window)
      const apiKey = await prisma.apiKey.create({
        data: {
          tenant_id: testData.tenant.id,
          name: 'Debounce Test',
          key_prefix: rawKey.substring(0, 12),
          key_hash: keyHash,
          scopes: ['*'],
          last_used_at: recentTime,
        },
      });

      await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${rawKey}` },
      });

      await new Promise((r) => setTimeout(r, 100));

      const updated = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
      // Should NOT have been updated since it was used within the last minute
      expect(updated!.last_used_at!.getTime()).toBe(recentTime.getTime());
    });
  });
});
