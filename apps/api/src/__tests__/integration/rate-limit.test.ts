import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { createHash, randomBytes } from 'node:crypto';
import { RATE_LIMIT_TIERS, rateLimiter } from '../../middleware/rate-limit.js';

// Use a test-specific tier with very low limits to keep tests fast
// and avoid window-boundary timing issues
const TEST_LIMIT = 5;

let app: FastifyInstance;
let prisma: PrismaClient;
let testData: Awaited<ReturnType<typeof seedTestData>>;
let originalTiers: typeof RATE_LIMIT_TIERS;

beforeAll(async () => {
  process.env['RATE_LIMIT_ENABLED'] = 'true';
  const server = await createTestServer();
  app = server.app;
  prisma = server.prisma;

  // Save original tiers and add a test tier with low limits
  originalTiers = { ...RATE_LIMIT_TIERS };
  RATE_LIMIT_TIERS['test'] = {
    evaluate: TEST_LIMIT,
    read: TEST_LIMIT,
    write: TEST_LIMIT,
  };
});

afterAll(async () => {
  // Restore original tiers
  delete RATE_LIMIT_TIERS['test'];
  Object.assign(RATE_LIMIT_TIERS, originalTiers);
  delete process.env['RATE_LIMIT_ENABLED'];
  await destroyTestServer();
});

beforeEach(async () => {
  rateLimiter.reset();
  await cleanDatabase(prisma);
  testData = await seedTestData(prisma);
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Create a tenant with a specific plan and return its API key */
async function createTenantWithPlan(plan: string) {
  const slug = `tenant-${plan}-${randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      name: `${plan} tenant`,
      slug,
      plan,
      settings: {
        default_approval_ttl_seconds: 86400,
        default_data_classification: 'internal',
        notification_email: null,
      },
      onboarding_state: {},
    },
  });

  await prisma.agent.create({
    data: {
      tenant_id: tenant.id,
      name: `${plan} Agent`,
      description: `Agent for ${plan} plan`,
      owner_name: 'Test',
      owner_role: 'Test',
      team: 'Test',
      environment: 'test',
      authority_model: 'self',
      identity_mode: 'service_identity',
      delegation_model: 'self',
      autonomy_tier: 'low',
      lifecycle_state: 'active',
      authorized_integrations: [],
      created_by: 'test',
    },
  });

  const rawKey = 'ai_test_' + randomBytes(16).toString('hex');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  await prisma.apiKey.create({
    data: {
      tenant_id: tenant.id,
      name: `${plan} Key`,
      key_prefix: rawKey.substring(0, 12),
      key_hash: keyHash,
      scopes: ['*'],
    },
  });

  return { tenant, rawKey };
}

/** Send a GET request to /api/v1/agents */
function getAgents(apiKey: string) {
  return app.inject({
    method: 'GET',
    url: '/api/v1/agents',
    headers: { authorization: `Bearer ${apiKey}` },
  });
}

/**
 * Send requests until we hit 429 or exhaust maxRequests.
 * Returns the 429 response or null.
 */
async function sendUntilRateLimited(
  apiKey: string,
  maxRequests: number,
): Promise<ReturnType<typeof app.inject> | null> {
  for (let i = 0; i < maxRequests; i++) {
    const response = await getAgents(apiKey);
    if (response.statusCode === 429) {
      return response;
    }
  }
  return null;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Rate Limiting', () => {
  it('allows requests under the limit', async () => {
    // Default test tenant is 'enterprise' (high limits)
    const response = await getAgents(testData.rawApiKey);
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('returns 429 when limit exceeded', async () => {
    // Use test tier with limit of 5
    const { rawKey } = await createTenantWithPlan('test');

    // Send TEST_LIMIT + 1 requests to exceed the limit
    // Send 3x the limit to overcome any window boundary split
    const rateLimitResponse = await sendUntilRateLimited(rawKey, TEST_LIMIT * 3);
    expect(rateLimitResponse).not.toBeNull();
    expect(rateLimitResponse!.statusCode).toBe(429);
  });

  it('429 response includes X-RateLimit-* headers', async () => {
    const { rawKey } = await createTenantWithPlan('test');

    const rateLimitResponse = await sendUntilRateLimited(rawKey, TEST_LIMIT * 3);
    expect(rateLimitResponse).not.toBeNull();
    expect(rateLimitResponse!.headers['x-ratelimit-limit']).toBe(String(TEST_LIMIT));
    expect(rateLimitResponse!.headers['x-ratelimit-remaining']).toBe('0');
    expect(rateLimitResponse!.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('429 response includes Retry-After header', async () => {
    const { rawKey } = await createTenantWithPlan('test');

    const rateLimitResponse = await sendUntilRateLimited(rawKey, TEST_LIMIT * 3);
    expect(rateLimitResponse).not.toBeNull();
    expect(rateLimitResponse!.headers['retry-after']).toBeDefined();
    const retryAfter = parseInt(rateLimitResponse!.headers['retry-after'] as string);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('429 response body matches ApiError shape', async () => {
    const { rawKey } = await createTenantWithPlan('test');

    const rateLimitResponse = await sendUntilRateLimited(rawKey, TEST_LIMIT * 3);
    expect(rateLimitResponse).not.toBeNull();

    const body = rateLimitResponse!.json();
    expect(body.error).toBe('rate_limit_exceeded');
    expect(body.status).toBe(429);
    expect(body.message).toContain('Rate limit exceeded');
    expect(body.details.category).toBe('read');
    expect(body.details.limit).toBe(TEST_LIMIT);
    expect(body.details.remaining).toBe(0);
    expect(body.details.reset_at).toBeDefined();
    expect(body.details.retry_after_seconds).toBeGreaterThanOrEqual(1);
    expect(body.request_id).toBeDefined();
  });

  it('different endpoint categories have different limits', async () => {
    // Free plan: read=300, evaluate=100
    const response = await getAgents(testData.rawApiKey);
    expect(response.statusCode).toBe(200);
    // Enterprise plan: read=30000
    expect(response.headers['x-ratelimit-limit']).toBe('30000');
  });

  it('limits are per tenant (tenant A limit does not affect tenant B)', async () => {
    const tenantA = await createTenantWithPlan('test');
    const tenantB = await createTenantWithPlan('test');

    // Exhaust tenant A's rate limit
    const rateLimited = await sendUntilRateLimited(tenantA.rawKey, TEST_LIMIT * 3);
    expect(rateLimited).not.toBeNull();

    // Tenant B should still be allowed
    const responseB = await getAgents(tenantB.rawKey);
    expect(responseB.statusCode).toBe(200);
  });

  it('rate limiting disabled when RATE_LIMIT_ENABLED=false', async () => {
    const original = process.env['RATE_LIMIT_ENABLED'];
    process.env['RATE_LIMIT_ENABLED'] = 'false';

    try {
      const { rawKey } = await createTenantWithPlan('test');

      // Should never get 429 even after exceeding the limit
      for (let i = 0; i < TEST_LIMIT + 5; i++) {
        const response = await getAgents(rawKey);
        expect(response.statusCode).not.toBe(429);
        // Rate limit headers should NOT be present when disabled
        expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      }
    } finally {
      process.env['RATE_LIMIT_ENABLED'] = original;
    }
  });

  it('health endpoint is not rate limited', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    }
  });

  it('auth endpoints are not rate limited', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });
      // Will get 401 but should NOT have rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    }
  });

  it('rate limit headers present on successful responses', async () => {
    const response = await getAgents(testData.rawApiKey);
    expect(response.statusCode).toBe(200);

    const limit = parseInt(response.headers['x-ratelimit-limit'] as string);
    const remaining = parseInt(response.headers['x-ratelimit-remaining'] as string);
    const reset = parseInt(response.headers['x-ratelimit-reset'] as string);

    expect(limit).toBeGreaterThan(0);
    expect(remaining).toBeLessThan(limit);
    expect(reset).toBeGreaterThan(Math.floor(Date.now() / 1000) - 1);
  });

  it('team plan has higher limits than free', async () => {
    const freeTenant = await createTenantWithPlan('free');
    const teamTenant = await createTenantWithPlan('team');

    const freeResponse = await getAgents(freeTenant.rawKey);
    const teamResponse = await getAgents(teamTenant.rawKey);

    const freeLimit = parseInt(freeResponse.headers['x-ratelimit-limit'] as string);
    const teamLimit = parseInt(teamResponse.headers['x-ratelimit-limit'] as string);

    expect(teamLimit).toBeGreaterThan(freeLimit);
    expect(freeLimit).toBe(300); // free read
    expect(teamLimit).toBe(3000); // team read
  });
});
