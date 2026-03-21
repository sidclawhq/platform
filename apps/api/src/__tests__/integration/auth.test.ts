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

describe('Authentication middleware', () => {
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

  it('allows unauthenticated access to /health', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
  });

  it('rejects requests without auth header to API routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents',
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toBe('unauthorized');
    expect(body.request_id).toBeDefined();
  });

  it('accepts valid API key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents',
      headers: {
        authorization: `Bearer ${testData.rawApiKey}`,
      },
    });
    // Should NOT return 401 — the key is valid
    expect(response.statusCode).not.toBe(401);
  });

  it('rejects invalid API key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/agents',
      headers: {
        authorization: 'Bearer ai_invalid_key_000000000000000000',
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it('allows dev bypass in development mode', async () => {
    const originalNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: {
          'x-dev-bypass': 'true',
        },
      });
      // Should NOT return 401 in development mode
      expect(response.statusCode).not.toBe(401);
    } finally {
      process.env['NODE_ENV'] = originalNodeEnv;
    }
  });
});
