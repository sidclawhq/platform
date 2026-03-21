import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService, resetRateLimitState } from '../notification-service.js';
import type { EmailService, EmailMessage } from '../email-service.js';

// Mock PrismaClient
const DEFAULT_TENANT = {
  name: 'Test Workspace',
  settings: {
    notification_email: null,
    notifications_enabled: true,
  },
};

const DEFAULT_USERS = [
  { email: 'reviewer@example.com' },
  { email: 'admin@example.com' },
];

function createMockPrisma(overrides: {
  tenant?: Record<string, unknown> | null;
  users?: Array<{ email: string }>;
} = {}) {
  const tenantValue = 'tenant' in overrides ? overrides.tenant : DEFAULT_TENANT;
  const usersValue = 'users' in overrides ? overrides.users : DEFAULT_USERS;
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenantValue),
    },
    user: {
      findMany: vi.fn().mockResolvedValue(usersValue),
    },
  } as any;
}

function createMockEmailService(): EmailService & { send: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

const sampleApproval = {
  id: 'approval-1',
  agent_name: 'Data Exporter Agent',
  operation: 'export',
  target_integration: 'salesforce',
  data_classification: 'confidential',
  risk_classification: 'high' as string | null,
  flag_reason: 'Confidential data export requires approval',
};

describe('NotificationService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockEmailService: ReturnType<typeof createMockEmailService>;
  let service: NotificationService;

  beforeEach(() => {
    resetRateLimitState();
    mockPrisma = createMockPrisma();
    mockEmailService = createMockEmailService();
    service = new NotificationService(mockPrisma, mockEmailService);
  });

  it('sends email to reviewers and admins when approval requested', async () => {
    await service.notifyApprovalRequested('tenant-1', sampleApproval);

    expect(mockEmailService.send).toHaveBeenCalledOnce();
    const call = mockEmailService.send.mock.calls[0][0] as EmailMessage;
    expect(call.to).toEqual(['reviewer@example.com', 'admin@example.com']);
  });

  it('uses custom notification email when configured in tenant settings', async () => {
    mockPrisma = createMockPrisma({
      tenant: {
        name: 'Custom Tenant',
        settings: {
          notification_email: ['custom@example.com', 'ops@example.com'],
          notifications_enabled: true,
        },
      },
    });
    service = new NotificationService(mockPrisma, mockEmailService);

    await service.notifyApprovalRequested('tenant-2', sampleApproval);

    expect(mockEmailService.send).toHaveBeenCalledOnce();
    const call = mockEmailService.send.mock.calls[0][0] as EmailMessage;
    expect(call.to).toEqual(['custom@example.com', 'ops@example.com']);
    // Should NOT look up users when custom email is set
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('handles single string notification_email setting', async () => {
    mockPrisma = createMockPrisma({
      tenant: {
        name: 'Single Email Tenant',
        settings: {
          notification_email: 'solo@example.com',
          notifications_enabled: true,
        },
      },
    });
    service = new NotificationService(mockPrisma, mockEmailService);

    await service.notifyApprovalRequested('tenant-3', sampleApproval);

    const call = mockEmailService.send.mock.calls[0][0] as EmailMessage;
    expect(call.to).toEqual(['solo@example.com']);
  });

  it('does not send when notifications_enabled is false', async () => {
    mockPrisma = createMockPrisma({
      tenant: {
        name: 'Silent Tenant',
        settings: { notifications_enabled: false },
      },
    });
    service = new NotificationService(mockPrisma, mockEmailService);

    await service.notifyApprovalRequested('tenant-4', sampleApproval);

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('does not send when no recipients found', async () => {
    mockPrisma = createMockPrisma({ users: [] });
    service = new NotificationService(mockPrisma, mockEmailService);

    await service.notifyApprovalRequested('tenant-5', sampleApproval);

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('does not send when tenant not found', async () => {
    mockPrisma = createMockPrisma({ tenant: null });
    service = new NotificationService(mockPrisma, mockEmailService);

    await service.notifyApprovalRequested('nonexistent', sampleApproval);

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('rate limits to 1 email per tenant per minute', async () => {
    await service.notifyApprovalRequested('tenant-6', sampleApproval);
    expect(mockEmailService.send).toHaveBeenCalledOnce();

    // Second call within 1 minute — should be rate limited
    await service.notifyApprovalRequested('tenant-6', sampleApproval);
    expect(mockEmailService.send).toHaveBeenCalledOnce(); // still 1

    // Different tenant should NOT be rate limited
    await service.notifyApprovalRequested('tenant-7', sampleApproval);
    expect(mockEmailService.send).toHaveBeenCalledTimes(2);
  });

  it('email failure does not throw', async () => {
    mockEmailService.send.mockRejectedValueOnce(new Error('SMTP error'));

    // Should not throw
    await expect(
      service.notifyApprovalRequested('tenant-8', sampleApproval)
    ).resolves.toBeUndefined();
  });

  it('email contains agent name, operation, classification, risk, and dashboard link', async () => {
    await service.notifyApprovalRequested('tenant-9', sampleApproval);

    const call = mockEmailService.send.mock.calls[0][0] as EmailMessage;

    // Subject
    expect(call.subject).toContain('Data Exporter Agent');
    expect(call.subject).toContain('export');
    expect(call.subject).toContain('salesforce');

    // Plain text
    expect(call.text).toContain('Data Exporter Agent');
    expect(call.text).toContain('export');
    expect(call.text).toContain('salesforce');
    expect(call.text).toContain('confidential');
    expect(call.text).toContain('HIGH');
    expect(call.text).toContain('Confidential data export requires approval');
    expect(call.text).toContain('/dashboard/approvals');

    // HTML
    expect(call.html).toContain('Data Exporter Agent');
    expect(call.html).toContain('export');
    expect(call.html).toContain('salesforce');
    expect(call.html).toContain('confidential');
    expect(call.html).toContain('HIGH');
    expect(call.html).toContain('/dashboard/approvals');
  });

  it('omits risk row in email when risk_classification is null', async () => {
    const approvalNoRisk = { ...sampleApproval, risk_classification: null };

    await service.notifyApprovalRequested('tenant-10', approvalNoRisk);

    const call = mockEmailService.send.mock.calls[0][0] as EmailMessage;
    expect(call.text).not.toContain('Risk:');
    expect(call.html).not.toContain('Risk:</td>');
  });
});
