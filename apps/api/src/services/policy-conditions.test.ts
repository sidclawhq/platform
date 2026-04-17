import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateConditions } from './policy-conditions.js';

// Stub dns.lookup so webhook_check's SSRF guard doesn't try real DNS.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

// Stub safeFetch so we test the condition logic in isolation from the real
// socket stack. The real behavior of safeFetch (IP pinning, redirect: manual,
// SSRF check) is covered in url-safety.test.ts.
vi.mock('../lib/url-safety.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/url-safety.js')>();
  return {
    ...original,
    safeFetch: vi.fn(async () => new Response(JSON.stringify({ allowed: true }), { status: 200 })),
  };
});

import { safeFetch as safeFetchMock, UrlSafetyError } from '../lib/url-safety.js';
const safeFetchMocked = safeFetchMock as unknown as ReturnType<typeof vi.fn>;

// Minimal PrismaClient-compatible stub — only the methods we actually call.
function mockPrisma(trace_counts: number[] = [0], traces: Array<{ cost_estimate: number | null }> = []): any {
  let callIndex = 0;
  return {
    auditTrace: {
      count: vi.fn(async () => trace_counts[callIndex++] ?? 0),
      findMany: vi.fn(async () => traces),
    },
  };
}

const context = {
  tenant_id: 't1',
  agent_id: 'a1',
  operation: 'send_email',
  target_integration: 'email_service',
};

describe('evaluateConditions', () => {
  it('returns base effect when no conditions present', async () => {
    const result = await evaluateConditions(mockPrisma(), null, context, 'allow');
    expect(result.effect).toBe('allow');
    expect(result.results).toEqual([]);
  });

  describe('rate_limit', () => {
    it('escalates to approval_required when over limit', async () => {
      const prisma = mockPrisma([10]);
      const result = await evaluateConditions(
        prisma,
        { rate_limit: { max_actions: 10, window_minutes: 60 } },
        context,
        'allow',
      );
      expect(result.effect).toBe('approval_required');
      expect(result.results[0].outcome).toBe('violated');
    });

    it('stays allowed under the limit', async () => {
      const prisma = mockPrisma([3]);
      const result = await evaluateConditions(
        prisma,
        { rate_limit: { max_actions: 10, window_minutes: 60 } },
        context,
        'allow',
      );
      expect(result.effect).toBe('allow');
    });

    it('skips if operation not in scope', async () => {
      const prisma = mockPrisma([100]);
      const result = await evaluateConditions(
        prisma,
        { rate_limit: { max_actions: 10, window_minutes: 60, action_types: ['other'] } },
        context,
        'allow',
      );
      expect(result.effect).toBe('allow');
      expect(result.results[0].detail).toContain('not in rate_limit scope');
    });

    it('can deny with explicit on_exceed', async () => {
      const prisma = mockPrisma([10]);
      const result = await evaluateConditions(
        prisma,
        { rate_limit: { max_actions: 10, window_minutes: 60, on_exceed: 'deny' } },
        context,
        'allow',
      );
      expect(result.effect).toBe('deny');
    });
  });

  describe('time_restriction', () => {
    it('denies when current weekday is blocked', async () => {
      // Pick the current UTC weekday name to make the test deterministic
      const now = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getUTCDay()];
      const result = await evaluateConditions(
        mockPrisma(),
        { time_restriction: { blocked_days: [currentDay], timezone: 'UTC' } },
        context,
        'allow',
      );
      expect(result.effect).toBe('deny');
    });

    it('allows outside blocked hours', async () => {
      const currentHour = new Date().getUTCHours();
      const otherHour = (currentHour + 1) % 24;
      const result = await evaluateConditions(
        mockPrisma(),
        { time_restriction: { blocked_hours: [otherHour], timezone: 'UTC' } },
        context,
        'allow',
      );
      expect(result.effect).toBe('allow');
    });

    it('scopes to action_types', async () => {
      const currentHour = new Date().getUTCHours();
      const result = await evaluateConditions(
        mockPrisma(),
        {
          time_restriction: {
            action_types: ['other-op'],
            blocked_hours: [currentHour],
          },
        },
        context,
        'allow',
      );
      expect(result.effect).toBe('allow');
    });
  });

  describe('cost_threshold', () => {
    it('escalates when per-action estimate exceeds max', async () => {
      const result = await evaluateConditions(
        mockPrisma(),
        { cost_threshold: { max_cost_per_action: 5 } },
        context,
        'allow',
        { estimated_cost: 10 },
      );
      expect(result.effect).toBe('approval_required');
    });

    it('escalates when hourly cost exceeds max', async () => {
      const prisma = mockPrisma([], [
        { cost_estimate: 50 },
        { cost_estimate: 60 },
      ]);
      const result = await evaluateConditions(
        prisma,
        { cost_threshold: { max_cost_per_hour: 100 } },
        context,
        'allow',
      );
      expect(result.effect).toBe('approval_required');
    });
  });

  describe('webhook_check', () => {
    beforeEach(() => {
      safeFetchMocked.mockReset();
      // Default: allow
      safeFetchMocked.mockImplementation(async () =>
        new Response(JSON.stringify({ allowed: true }), { status: 200 }),
      );
    });

    it('fails closed (deny) when safeFetch rejects SSRF target', async () => {
      safeFetchMocked.mockImplementation(async () => {
        throw new UrlSafetyError('blocked', 'private_literal_ip');
      });
      const result = await evaluateConditions(
        mockPrisma(),
        { webhook_check: { url: 'http://169.254.169.254/meta' } },
        context,
        'allow',
      );
      expect(result.effect).toBe('deny');
    });

    it('denies when remote webhook says allowed:false', async () => {
      safeFetchMocked.mockImplementation(async () =>
        new Response(JSON.stringify({ allowed: false, reason: 'external denied' }), { status: 200 }),
      );
      const result = await evaluateConditions(
        mockPrisma(),
        { webhook_check: { url: 'https://governance.example.com/check' } },
        context,
        'allow',
      );
      expect(result.effect).toBe('deny');
      expect(result.rationale).toContain('external denied');
    });

    it('allows when remote webhook says allowed:true', async () => {
      safeFetchMocked.mockImplementation(async () =>
        new Response(JSON.stringify({ allowed: true }), { status: 200 }),
      );
      const result = await evaluateConditions(
        mockPrisma(),
        { webhook_check: { url: 'https://governance.example.com/check' } },
        context,
        'allow',
      );
      expect(result.effect).toBe('allow');
    });

    it('fails closed on network error', async () => {
      safeFetchMocked.mockImplementation(async () => {
        throw new Error('network unreachable');
      });
      const result = await evaluateConditions(
        mockPrisma(),
        { webhook_check: { url: 'https://governance.example.com/check' } },
        context,
        'allow',
      );
      expect(result.effect).toBe('deny');
    });

    it('fails closed when safeFetch reports a redirect-to-private', async () => {
      safeFetchMocked.mockImplementation(async () => {
        throw new UrlSafetyError('redirect blocked', 'redirect_blocked');
      });
      const result = await evaluateConditions(
        mockPrisma(),
        { webhook_check: { url: 'https://governance.example.com/check' } },
        context,
        'allow',
      );
      expect(result.effect).toBe('deny');
      expect(result.rationale).toContain('redirect_blocked');
    });
  });

  describe('effect escalation', () => {
    it('never relaxes from approval_required to allow', async () => {
      const prisma = mockPrisma([1]);
      const result = await evaluateConditions(
        prisma,
        { rate_limit: { max_actions: 10, window_minutes: 60 } },
        context,
        'approval_required',
      );
      expect(result.effect).toBe('approval_required');
    });
  });
});
