import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, destroyTestServer } from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

describe('Health endpoint', () => {
  beforeAll(async () => {
    const server = await createTestServer();
    app = server.app;
  });

  afterAll(async () => {
    await destroyTestServer();
  });

  it('returns healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('healthy');
    expect(body.version).toBe('0.1.0');
    expect(body.checks.database.status).toBe('healthy');
  });
});
