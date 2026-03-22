import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock EmailService — must use class/function for `new` to work
const mockSend = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/email-service.js', () => ({
  EmailService: class {
    send = mockSend;
  },
}));

let runHealthChecks: () => Promise<void>;

beforeEach(async () => {
  vi.stubEnv('ADMIN_ALERT_EMAIL', 'admin@test.com');
  mockSend.mockClear();

  // Re-import to reset module-level state (serviceState)
  vi.resetModules();
  const mod = await import('../health-monitor.js');
  runHealthChecks = mod.runHealthChecks;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Health Monitor', () => {
  it('detects healthy services', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ status: 'healthy' }),
    }));

    await runHealthChecks();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('detects down services (timeout)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')));

    await runHealthChecks();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toEqual(['admin@test.com']);
    expect(call.subject).toContain('service(s) down');
  });

  it('detects down services (non-200 status)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 503,
      json: () => Promise.resolve({ status: 'unhealthy' }),
    }));

    await runHealthChecks();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain('service(s) down');
  });

  it('sends alert email when service goes down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    await runHealthChecks();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const emailArgs = mockSend.mock.calls[0][0];
    expect(emailArgs.to).toEqual(['admin@test.com']);
    expect(emailArgs.subject).toMatch(/SidClaw.*service\(s\) down/);
    expect(emailArgs.text).toContain('Service health alert');
    expect(emailArgs.html).toContain('Service Health Alert');
  });

  it('sends recovery email when service comes back up', async () => {
    // First run: all services down
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
    await runHealthChecks();
    mockSend.mockClear();

    // Second run: all services healthy
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ status: 'healthy' }),
    }));
    await runHealthChecks();

    // Should have sent recovery emails (one per service)
    expect(mockSend).toHaveBeenCalled();
    const hasRecovery = mockSend.mock.calls.some(
      (c: unknown[]) => (c[0] as { subject: string }).subject.includes('recovered'),
    );
    expect(hasRecovery).toBe(true);
  });

  it('does not spam alerts (30 min cooldown)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    // First run: sends alert
    await runHealthChecks();
    expect(mockSend).toHaveBeenCalledTimes(1);
    mockSend.mockClear();

    // Second run immediately after: should NOT send again (cooldown)
    await runHealthChecks();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send email when ADMIN_ALERT_EMAIL is not set', async () => {
    delete process.env['ADMIN_ALERT_EMAIL'];

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    await runHealthChecks();

    expect(mockSend).not.toHaveBeenCalled();
  });
});
