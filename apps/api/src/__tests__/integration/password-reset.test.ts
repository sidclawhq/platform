import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { createHash } from 'node:crypto';
import { rateLimiter } from '../../middleware/rate-limit.js';

let app: FastifyInstance;
let prisma: PrismaClient;

const EMAIL = 'reset-me@example.com';
const OLD_PASSWORD = 'old-password-123';
const NEW_PASSWORD = 'new-password-456';

beforeAll(async () => {
  const server = await createTestServer();
  app = server.app;
  prisma = server.prisma;
});

afterAll(async () => {
  await destroyTestServer(app, prisma);
});

async function signupUser() {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email: EMAIL, password: OLD_PASSWORD, name: 'Reset Tester' },
  });
  expect([200, 201]).toContain(response.statusCode);
}

async function requestReset(email = EMAIL) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/password-reset/request',
    payload: { email },
  });
}

/** The raw token only exists in the email — tests recover it via the DB hash row + a re-issued token. */
async function latestTokenRowFor(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  return prisma.passwordResetToken.findFirst({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
  });
}

async function login(password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login/email',
    payload: { email: EMAIL, password },
  });
}

beforeEach(async () => {
  await cleanDatabase(prisma);
  await seedTestData(prisma);
  rateLimiter.reset();
  await signupUser();
});

describe('POST /auth/password-reset/request', () => {
  it('returns the same 200 body for existing and unknown accounts', async () => {
    const known = await requestReset(EMAIL);
    const unknown = await requestReset('nobody@example.com');
    expect(known.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(known.json()).toEqual(unknown.json());
  });

  it('creates a hashed token row for a real account and none for unknown', async () => {
    await requestReset(EMAIL);
    const row = await latestTokenRowFor(EMAIL);
    expect(row).not.toBeNull();
    expect(row!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.used_at).toBeNull();

    const count = await prisma.passwordResetToken.count();
    await requestReset('nobody@example.com');
    expect(await prisma.passwordResetToken.count()).toBe(count);
  });

  it('a new request invalidates the previous outstanding token', async () => {
    await requestReset(EMAIL);
    const first = await latestTokenRowFor(EMAIL);
    await requestReset(EMAIL);
    const rows = await prisma.passwordResetToken.findMany({});
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).not.toBe(first!.id);
  });

  it('throttles per IP', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await requestReset(EMAIL)).statusCode).toBe(200);
    }
    expect((await requestReset(EMAIL)).statusCode).toBe(429);
  });
});

describe('POST /auth/password-reset/confirm', () => {
  /** Plants a token with a known raw value directly, mirroring what the route stores. */
  async function plantToken(raw: string, opts: { expired?: boolean; used?: boolean } = {}) {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    await prisma.passwordResetToken.deleteMany({});
    return prisma.passwordResetToken.create({
      data: {
        user_id: user!.id,
        tenant_id: user!.tenant_id,
        token_hash: createHash('sha256').update(raw).digest('hex'),
        expires_at: new Date(Date.now() + (opts.expired ? -1000 : 3_600_000)),
        used_at: opts.used ? new Date() : null,
      },
    });
  }

  const RAW = 'a'.repeat(64);

  async function confirm(token: string, password = NEW_PASSWORD) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/confirm',
      payload: { token, password },
    });
  }

  it('resets the password: old stops working, new works, token is single-use', async () => {
    await plantToken(RAW);
    const response = await confirm(RAW);
    expect(response.statusCode).toBe(200);

    expect((await login(OLD_PASSWORD)).statusCode).toBe(401);
    expect((await login(NEW_PASSWORD)).statusCode).toBe(200);

    // Replay the same token — must fail
    expect((await confirm(RAW, 'yet-another-pass-789')).statusCode).toBe(401);
  });

  it('rejects expired tokens', async () => {
    await plantToken(RAW, { expired: true });
    expect((await confirm(RAW)).statusCode).toBe(401);
  });

  it('rejects used tokens', async () => {
    await plantToken(RAW, { used: true });
    expect((await confirm(RAW)).statusCode).toBe(401);
  });

  it('rejects unknown tokens', async () => {
    await plantToken(RAW);
    expect((await confirm('b'.repeat(64))).statusCode).toBe(401);
  });

  it('enforces the password policy', async () => {
    await plantToken(RAW);
    expect((await confirm(RAW, 'short')).statusCode).toBe(400);
  });

  it('revokes all sessions on reset', async () => {
    const loginResponse = await login(OLD_PASSWORD);
    expect(loginResponse.statusCode).toBe(200);
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(await prisma.session.count({ where: { user_id: user!.id } })).toBeGreaterThan(0);

    await plantToken(RAW);
    await confirm(RAW);
    expect(await prisma.session.count({ where: { user_id: user!.id } })).toBe(0);
  });
});
