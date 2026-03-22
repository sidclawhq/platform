import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock EmailService
const mockSend = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/email-service.js', () => ({
  EmailService: class {
    send = mockSend;
  },
}));

// Mock prisma — use vi.hoisted to ensure the mock object is available at hoist time
const mockPrisma = vi.hoisted(() => ({
  tenant: {
    count: vi.fn().mockResolvedValue(5),
    findMany: vi.fn().mockResolvedValue([]),
  },
  user: { count: vi.fn().mockResolvedValue(10) },
  auditTrace: {
    count: vi.fn().mockResolvedValue(100),
    groupBy: vi.fn().mockResolvedValue([]),
  },
  approvalRequest: { count: vi.fn().mockResolvedValue(3) },
  agent: { count: vi.fn().mockResolvedValue(8) },
  policyRule: { count: vi.fn().mockResolvedValue(12) },
}));

vi.mock('../../db/client.js', () => ({
  prisma: mockPrisma,
}));

import { sendDailyDigest } from '../daily-digest.js';

beforeEach(() => {
  vi.stubEnv('ADMIN_ALERT_EMAIL', 'admin@test.com');
  mockSend.mockClear();
  // Reset all prisma mocks to defaults
  mockPrisma.tenant.count.mockResolvedValue(5);
  mockPrisma.tenant.findMany.mockResolvedValue([]);
  mockPrisma.user.count.mockResolvedValue(10);
  mockPrisma.auditTrace.count.mockResolvedValue(100);
  mockPrisma.auditTrace.groupBy.mockResolvedValue([]);
  mockPrisma.approvalRequest.count.mockResolvedValue(3);
  mockPrisma.agent.count.mockResolvedValue(8);
  mockPrisma.policyRule.count.mockResolvedValue(12);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Daily Digest', () => {
  it('sends email with correct metrics', async () => {
    await sendDailyDigest();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const emailArgs = mockSend.mock.calls[0][0];
    expect(emailArgs.to).toEqual(['admin@test.com']);
    expect(emailArgs.subject).toContain('SidClaw Daily Digest');
    expect(emailArgs.text).toContain('Tenants: 5');
    expect(emailArgs.text).toContain('Users: 10');
    expect(emailArgs.text).toContain('Agents: 8');
    expect(emailArgs.text).toContain('Policies: 12');
  });

  it('includes new signups', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([
      {
        id: 't1',
        name: 'Acme Corp',
        plan: 'free',
        created_at: new Date(),
        users: [{ email: 'john@acme.com', name: 'John' }],
        _count: { agents: 2 },
      },
    ]);

    await sendDailyDigest();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const emailArgs = mockSend.mock.calls[0][0];
    expect(emailArgs.text).toContain('Acme Corp');
    expect(emailArgs.text).toContain('john@acme.com');
  });

  it('includes top active tenants', async () => {
    mockPrisma.auditTrace.groupBy.mockResolvedValue([
      { tenant_id: 't1', _count: 50 },
    ]);
    // findMany is called twice: once for tenant names (with where.id.in), once for new signups
    mockPrisma.tenant.findMany
      .mockResolvedValueOnce([{ id: 't1', name: 'Top Tenant', plan: 'starter' }])
      .mockResolvedValueOnce([]);

    await sendDailyDigest();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const emailArgs = mockSend.mock.calls[0][0];
    expect(emailArgs.text).toContain('Top Tenant');
    expect(emailArgs.text).toContain('50 traces');
  });

  it('does not send when ADMIN_ALERT_EMAIL is not set', async () => {
    delete process.env['ADMIN_ALERT_EMAIL'];

    await sendDailyDigest();

    expect(mockSend).not.toHaveBeenCalled();
  });
});
