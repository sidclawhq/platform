import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// Importing ioredis does not open a connection — a client is only
// constructed when REDIS_URL is configured (see createRateLimiter).
import Redis from 'ioredis';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp (seconds)
}

export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  /** Clear all window state. Used by tests. */
  reset(): void | Promise<void>;
}

// ─── In-Memory Implementation ────────────────────────────────────────────────

/**
 * In-memory sliding window rate limiter.
 * Per-process only — sufficient for single-instance deployment.
 * Swap to Redis/PostgreSQL backend for multi-instance by implementing the RateLimiter interface.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private windows: Map<string, { count: number; resetAt: number }> = new Map();

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${key}:${Math.floor(now / windowSeconds)}`;

    let window = this.windows.get(windowKey);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowSeconds };
      this.windows.set(windowKey, window);
    }

    window.count++;

    // Cleanup old windows periodically
    if (this.windows.size > 10000) {
      for (const [k, v] of this.windows) {
        if (v.resetAt <= now) this.windows.delete(k);
      }
    }

    return {
      allowed: window.count <= limit,
      limit,
      remaining: Math.max(0, limit - window.count),
      resetAt: window.resetAt,
    };
  }

  /** Clear all window state. Used by tests. */
  reset(): void {
    this.windows.clear();
  }
}

// ─── Redis Implementation ────────────────────────────────────────────────────

interface RedisMultiChain {
  incr(key: string): RedisMultiChain;
  expire(key: string, seconds: number, nx: 'NX'): RedisMultiChain;
  exec(): Promise<unknown>;
}

export interface RedisLike {
  multi(): RedisMultiChain;
  ttl(key: string): Promise<number>;
}

/**
 * Redis-backed fixed-window rate limiter for multi-instance deployments.
 * Enabled by setting REDIS_URL. Uses INCR + EXPIRE NX so all instances share
 * one window per key.
 *
 * Degrades rather than breaks: if Redis is unreachable, falls back to the
 * per-process in-memory limiter (weaker isolation, but requests keep flowing
 * and abuse is still bounded per instance) and logs the failure at most once
 * per minute.
 */
export class RedisRateLimiter implements RateLimiter {
  private readonly fallback = new InMemoryRateLimiter();
  private lastErrorLogAt = 0;

  // Structural type covering the slice of ioredis the limiter uses; kept
  // loose so tests can supply an in-process fake without a Redis server.
  constructor(private readonly redis: RedisLike) {}

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const redisKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
    try {
      const results = (await this.redis
        .multi()
        .incr(redisKey)
        // NX: only set the TTL when the key has none — first request in the
        // window owns the expiry; later requests must not extend it.
        .expire(redisKey, windowSeconds, 'NX')
        .exec()) as Array<[Error | null, unknown]> | null;
      if (!results) throw new Error('redis MULTI aborted');
      const [incrErr, count] = results[0]!;
      if (incrErr) throw incrErr;
      const used = Number(count);
      return {
        allowed: used <= limit,
        limit,
        remaining: Math.max(0, limit - used),
        resetAt: (Math.floor(now / windowSeconds) + 1) * windowSeconds,
      };
    } catch (error) {
      if (now - this.lastErrorLogAt >= 60) {
        this.lastErrorLogAt = now;
        console.error('Rate limiter: Redis unavailable, using in-memory fallback:', error instanceof Error ? error.message : error);
      }
      return this.fallback.check(key, limit, windowSeconds);
    }
  }

  reset(): void {
    this.fallback.reset();
  }
}

// ─── Rate Limit Tiers ────────────────────────────────────────────────────────

export interface RateLimitTier {
  evaluate: number; // per minute
  read: number; // per minute
  write: number; // per minute
}

export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  free: { evaluate: 100, read: 300, write: 60 },
  starter: { evaluate: 500, read: 1500, write: 300 },
  business: { evaluate: 5000, read: 15000, write: 3000 },
  enterprise: { evaluate: 50000, read: 150000, write: 30000 },
};

export function getEndpointCategory(method: string, url: string): 'evaluate' | 'read' | 'write' {
  if (url.includes('/evaluate')) return 'evaluate';
  if (method === 'GET') return 'read';
  return 'write';
}

// ─── Fastify Plugin ──────────────────────────────────────────────────────────

function createRateLimiter(): RateLimiter {
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) return new InMemoryRateLimiter();
  const client = new Redis(redisUrl, {
    // Never let a slow Redis stall requests: short timeouts, no retry queue.
    connectTimeout: 2000,
    commandTimeout: 1000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  console.log('Rate limiter: using Redis backend');
  return new RedisRateLimiter(client);
}

export const rateLimiter = createRateLimiter();

async function rateLimitPluginImpl(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for health, docs, auth
    if (
      request.url === '/health' ||
      request.url.startsWith('/docs') ||
      request.url.startsWith('/api/v1/auth/') ||
      request.url.startsWith('/auth/')
    ) {
      return;
    }

    // Skip if disabled (development/test)
    if (process.env['RATE_LIMIT_ENABLED'] === 'false') return;

    const tenantId = request.tenantId;
    if (!tenantId) {
      // IP-based rate limiting for unauthenticated requests
      const ip = request.ip ?? 'unknown';
      const ipKey = `ip:${ip}`;
      const ipResult = await rateLimiter.check(ipKey, 30, 60); // 30 requests per minute

      reply.header('X-RateLimit-Limit', String(ipResult.limit));
      reply.header('X-RateLimit-Remaining', String(ipResult.remaining));
      reply.header('X-RateLimit-Reset', String(ipResult.resetAt));

      if (!ipResult.allowed) {
        const retryAfter = Math.max(1, ipResult.resetAt - Math.floor(Date.now() / 1000));
        reply.header('Retry-After', String(retryAfter));
        reply.status(429).send({
          error: 'rate_limit_exceeded',
          message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
          status: 429,
          details: {
            limit: ipResult.limit,
            remaining: 0,
            reset_at: ipResult.resetAt,
            retry_after_seconds: retryAfter,
          },
          request_id: request.id,
        });
      }
      return;
    }

    // Get tenant plan (set by auth middleware)
    const tenantPlan = request.tenantPlan ?? 'free';
    const tier = RATE_LIMIT_TIERS[tenantPlan] ?? RATE_LIMIT_TIERS['free']!;

    const category = getEndpointCategory(request.method, request.url);
    const limit = tier[category];
    const key = `${tenantId}:${category}`;

    const result = await rateLimiter.check(key, limit, 60); // 60-second window

    // Set headers on every response
    reply.header('X-RateLimit-Limit', String(result.limit));
    reply.header('X-RateLimit-Remaining', String(result.remaining));
    reply.header('X-RateLimit-Reset', String(result.resetAt));

    if (!result.allowed) {
      const retryAfter = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));
      reply.header('Retry-After', String(retryAfter));
      reply.status(429).send({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded for ${category} endpoints. Retry after ${retryAfter} seconds.`,
        status: 429,
        details: {
          category,
          limit: result.limit,
          remaining: 0,
          reset_at: result.resetAt,
          retry_after_seconds: retryAfter,
        },
        request_id: request.id,
      });
    }
  });
}

export const rateLimitPlugin = fp(rateLimitPluginImpl, {
  name: 'rate-limit-plugin',
  dependencies: ['auth-plugin'],
});
