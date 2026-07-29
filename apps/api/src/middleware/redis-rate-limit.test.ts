import { describe, it, expect, vi } from 'vitest';
import { RedisRateLimiter } from './rate-limit.js';

/** Minimal in-process fake of the Redis commands the limiter uses. */
function fakeRedis(initial: Record<string, number> = {}) {
  const store = new Map<string, number>(Object.entries(initial));
  return {
    store,
    multi() {
      const ops: Array<() => [null, unknown]> = [];
      const chain = {
        incr: (key: string) => {
          ops.push(() => {
            const next = (store.get(key) ?? 0) + 1;
            store.set(key, next);
            return [null, next];
          });
          return chain;
        },
        expire: (_key: string, _s: number, _nx: 'NX') => {
          ops.push(() => [null, 1]);
          return chain;
        },
        exec: async () => ops.map((op) => op()),
      };
      return chain;
    },
    ttl: async () => 60,
  };
}

describe('RedisRateLimiter', () => {
  it('counts across calls and enforces the limit', async () => {
    const limiter = new RedisRateLimiter(fakeRedis());
    const first = await limiter.check('tenant:read', 2, 60);
    expect(first).toMatchObject({ allowed: true, remaining: 1 });
    await limiter.check('tenant:read', 2, 60);
    const third = await limiter.check('tenant:read', 2, 60);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('keys are shared state — a second limiter over the same store sees the count', async () => {
    const redis = fakeRedis();
    const a = new RedisRateLimiter(redis);
    const b = new RedisRateLimiter(redis);
    await a.check('k', 2, 60);
    await b.check('k', 2, 60);
    const result = await b.check('k', 2, 60);
    expect(result.allowed).toBe(false);
  });

  it('falls back to in-memory when Redis errors, and requests keep flowing', async () => {
    const broken = {
      multi() {
        return {
          incr: () => broken.multi(),
          expire: () => broken.multi(),
          exec: async () => {
            throw new Error('ECONNREFUSED');
          },
          // satisfy the structural chain type
        } as never;
      },
      ttl: async () => -1,
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter = new RedisRateLimiter(broken as never);
    const first = await limiter.check('k', 1, 60);
    expect(first.allowed).toBe(true);
    const second = await limiter.check('k', 1, 60);
    expect(second.allowed).toBe(false); // in-memory fallback still enforces
    expect(spy).toHaveBeenCalledTimes(1); // error logged once, not per request
    spy.mockRestore();
  });

  it('reset clears the fallback state', async () => {
    const limiter = new RedisRateLimiter(fakeRedis());
    limiter.reset();
    const result = await limiter.check('k', 5, 60);
    expect(result.allowed).toBe(true);
  });
});
