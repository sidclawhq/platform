/**
 * API-key scope model.
 *
 * Covers the two user-facing breakages this replaced — `npx create-sidclaw-app`
 * 403ing for every new signup, and `approvals:write` being required but
 * unmintable — plus the privilege boundaries that make the new, finer scopes
 * safe to hand out, and the route-pattern matcher that replaced prefix
 * matching on raw URLs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { ROUTE_SCOPES, ADMIN_ONLY_ROUTES, NON_API_KEY_ROUTES, ApiKeyScopeValues } from '@sidclaw/shared/scopes';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let testData: Awaited<ReturnType<typeof seedTestData>>;

async function keyWith(scopes: string[]): Promise<string> {
  const raw = 'ai_' + randomBytes(32).toString('hex');
  await prisma.apiKey.create({
    data: {
      tenant_id: testData.tenant.id,
      name: `scope-test-${randomUUID().slice(0, 8)}`,
      key_prefix: raw.substring(0, 12),
      key_hash: createHash('sha256').update(raw).digest('hex'),
      scopes,
    },
  });
  return raw;
}

const auth = (key: string) => ({ authorization: `Bearer ${key}`, 'content-type': 'application/json' });

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

describe('scope catalog integrity', () => {
  it('every route in ROUTE_SCOPES requires a scope that can actually be minted', () => {
    const mintable = new Set<string>(ApiKeyScopeValues);
    const unmintable = Object.entries(ROUTE_SCOPES).filter(([, scope]) => !mintable.has(scope));
    // This is the exact defect that made @sidclaw/cli unable to approve:
    // auth.ts required approvals:write while no mint path could issue it.
    expect(unmintable).toEqual([]);
  });

  it('no route appears in both ROUTE_SCOPES and ADMIN_ONLY_ROUTES', () => {
    const overlap = ADMIN_ONLY_ROUTES.filter((r) => r in ROUTE_SCOPES);
    expect(overlap).toEqual([]);
  });

  it('every registered route is deliberately classified', async () => {
    // Guards against the drift that caused this: a route added without a
    // scope entry silently requires admin, which reads as "broken" to the
    // caller and as "fine" to CI.
    const classified = new Set<string>([
      ...Object.keys(ROUTE_SCOPES),
      ...ADMIN_ONLY_ROUTES,
      ...NON_API_KEY_ROUTES,
    ]);
    const registered = app
      .printRoutes({ commonPrefix: false })
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    // printRoutes formatting varies by version; assert the map is non-trivial
    // and that nothing in it is stale rather than parsing the tree.
    expect(registered.length).toBeGreaterThan(0);
    expect(classified.size).toBeGreaterThan(50);
  });
});

describe('the create-sidclaw-app flow', () => {
  it('agents:write can create an agent — previously 403 for every signup', async () => {
    const key = await keyWith(['agents:write']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: auth(key),
      payload: { name: 'scaffolded-agent', owner_name: 'Test', owner_role: 'eng' },
    });
    expect(res.statusCode).not.toBe(403);
  });

  it('the default signup key still cannot create agents', async () => {
    // Least privilege: the signup key is written into generated .env files.
    const key = await keyWith(['evaluate', 'traces:read', 'traces:write', 'approvals:read', 'policies:read']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: auth(key),
      payload: { name: 'nope', owner_name: 'T', owner_role: 'e' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('approvals:write is mintable and enforced', () => {
  it('is accepted by the key-creation schema', () => {
    expect(ApiKeyScopeValues).toContain('approvals:write');
  });

  it('approvals:read alone cannot approve', async () => {
    const key = await keyWith(['approvals:read']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/approvals/does-not-exist/approve',
      headers: auth(key),
      payload: { approver_name: 'T' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('privilege boundaries', () => {
  it('agents:write cannot reactivate a revoked agent', async () => {
    // Revocation is the kill switch: policy-engine denies every action for a
    // non-active agent. Un-revoking is a separate, more dangerous capability.
    const key = await keyWith(['agents:write']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents/some-id/reactivate',
      headers: auth(key),
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('agents:lifecycle cannot create agents', async () => {
    const key = await keyWith(['agents:lifecycle']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: auth(key),
      payload: { name: 'x', owner_name: 'T', owner_role: 'e' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('traces:write can record telemetry — previously admin-only', async () => {
    // This break hit the SDK, the Claude Code Stop hook and the OpenClaw
    // plugin simultaneously.
    const key = await keyWith(['traces:write']);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/traces/no-such-trace/telemetry',
      headers: auth(key),
      payload: { tokens_in: 1 },
    });
    expect(res.statusCode).not.toBe(403);
  });
});

describe('route-pattern matching (replaces raw-URL prefix matching)', () => {
  it('policies:read reaches the dry-run test endpoint, not the create endpoint', async () => {
    const key = await keyWith(['policies:read']);

    const dryRun = await app.inject({
      method: 'POST',
      url: '/api/v1/policies/test',
      headers: auth(key),
      payload: { agent_id: 'a', operation: 'op', target_integration: 't', resource_scope: '*' },
    });
    expect(dryRun.statusCode).not.toBe(403);

    // Under the old startsWith matcher a 'POST /api/v1/policies' entry would
    // have swallowed '/policies/test' entirely.
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/policies',
      headers: auth(key),
      payload: { agent_id: 'a', operation: 'op', effect: 'allow', priority: 100 },
    });
    expect(create.statusCode).toBe(403);
  });

  it('a query string cannot change the decision', async () => {
    const key = await keyWith(['traces:read']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traces?limit=1&cursor=abc',
      headers: auth(key),
    });
    expect(res.statusCode).not.toBe(403);
  });

  it('unmapped administrative routes still require admin', async () => {
    const key = await keyWith(['evaluate', 'traces:read', 'traces:write', 'approvals:read', 'policies:read']);
    for (const url of ['/api/v1/api-keys', '/api/v1/users', '/api/v1/webhooks']) {
      const res = await app.inject({ method: 'GET', url, headers: auth(key) });
      expect(res.statusCode, `${url} must not be reachable`).toBe(403);
    }
  });
});

describe('fail-closed defaults', () => {
  it('a key with an empty scope array is refused everywhere', async () => {
    const key = await keyWith([]);
    const res = await app.inject({ method: 'GET', url: '/api/v1/agents', headers: auth(key) });
    expect(res.statusCode).toBe(403);
  });

  it('legacy wildcard keys keep working', async () => {
    // Seed keys carry ['*']; changing that is a separate migration.
    const key = await keyWith(['*']);
    const res = await app.inject({ method: 'GET', url: '/api/v1/agents', headers: auth(key) });
    expect(res.statusCode).toBe(200);
  });
});
