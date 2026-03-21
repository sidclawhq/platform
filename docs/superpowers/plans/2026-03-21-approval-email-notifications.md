# Approval Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send email notifications to reviewers when approval requests are created, with graceful degradation when no email provider is configured.

**Architecture:** EmailService abstracts email sending (Resend provider or console-log fallback). NotificationService looks up recipients from tenant settings or user roles, rate-limits per tenant, and renders the email. The evaluate route calls NotificationService fire-and-forget after the transaction commits, alongside existing webhook dispatch.

**Tech Stack:** Resend SDK, Vitest (unit tests with mocked EmailService)

---

### Task 1: Install Resend SDK

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install resend**

```bash
cd apps/api && npm install resend
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/api && node -e "require('resend')"
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json package-lock.json
git commit -m "chore: add resend email SDK dependency"
```

---

### Task 2: Add Email Config and Env Documentation

**Files:**
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/.env.example`

> **Design note:** Config schema additions provide startup-time Zod validation and centralized documentation of env vars. The EmailService and NotificationService read `process.env` directly at runtime — this is intentional since `loadConfig()` is called in `server.ts` and the config object is not propagated to route handlers or services. Both patterns (config validation + direct env access) work together: config catches invalid values at startup, services use values at runtime.

- [ ] **Step 1: Add email fields to config schema**

In `apps/api/src/config.ts`, add three optional fields to the `configSchema` object:

```typescript
// Add after sessionTtlSeconds line:
emailApiKey: z.string().optional(),
emailFrom: z.string().default('Agent Identity <notifications@agentidentity.dev>'),
dashboardUrl: z.string().default('http://localhost:3000'),
```

And add the corresponding env var mappings in `loadConfig()`:

```typescript
// Add after sessionTtlSeconds mapping:
emailApiKey: process.env['EMAIL_API_KEY'],
emailFrom: process.env['EMAIL_FROM'],
dashboardUrl: process.env['DASHBOARD_URL'],
```

- [ ] **Step 2: Update .env.example**

Append to `apps/api/.env.example`:

```
# Email notifications (optional — logs to console if not set)
EMAIL_API_KEY=re_...
EMAIL_FROM=Agent Identity <notifications@agentidentity.dev>
DASHBOARD_URL=http://localhost:3000
```

- [ ] **Step 3: Verify typecheck passes**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/config.ts apps/api/.env.example
git commit -m "feat: add email notification config (EMAIL_API_KEY, EMAIL_FROM, DASHBOARD_URL)"
```

---

### Task 3: Create EmailService

**Files:**
- Create: `apps/api/src/services/email-service.ts`

- [ ] **Step 1: Create the email service**

Create `apps/api/src/services/email-service.ts`:

```typescript
export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private provider: 'resend' | 'none';

  constructor() {
    this.provider = process.env['EMAIL_API_KEY'] ? 'resend' : 'none';
    if (this.provider === 'none') {
      console.log('Email notifications disabled — EMAIL_API_KEY not set');
    }
  }

  async send(message: EmailMessage): Promise<void> {
    if (this.provider === 'none') {
      console.log(`[Email] Would send to ${message.to.join(', ')}: ${message.subject}`);
      return;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(process.env['EMAIL_API_KEY']);

    await resend.emails.send({
      from: process.env['EMAIL_FROM'] ?? 'Agent Identity <notifications@agentidentity.dev>',
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/email-service.ts
git commit -m "feat: add EmailService with Resend provider and console fallback"
```

---

### Task 4: Create NotificationService

**Files:**
- Create: `apps/api/src/services/notification-service.ts`

- [ ] **Step 1: Create the notification service**

Create `apps/api/src/services/notification-service.ts`:

```typescript
import type { PrismaClient } from '../generated/prisma/index.js';
import type { EmailService } from './email-service.js';

// Rate limiting: max 1 email per tenant per minute
const lastEmailSent = new Map<string, number>();

// Exported for testing — allows tests to reset rate limit state
export function resetRateLimitState(): void {
  lastEmailSent.clear();
}

export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailService: EmailService
  ) {}

  async notifyApprovalRequested(tenantId: string, approval: {
    id: string;
    agent_name: string;
    operation: string;
    target_integration: string;
    data_classification: string;
    risk_classification: string | null;
    flag_reason: string;
  }): Promise<void> {
    try {
      // Rate limit check
      const lastSent = lastEmailSent.get(tenantId) ?? 0;
      if (Date.now() - lastSent < 60000) {
        console.log(`[Notification] Rate limited for tenant ${tenantId}`);
        return;
      }

      // Get tenant settings
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true, name: true },
      });
      if (!tenant) return;

      const settings = tenant.settings as Record<string, unknown>;

      // Check if notifications are enabled (default: true)
      if (settings?.notifications_enabled === false) return;

      // Get recipients
      let recipients: string[];
      if (settings?.notification_email) {
        // Custom notification email list
        recipients = Array.isArray(settings.notification_email)
          ? settings.notification_email as string[]
          : [settings.notification_email as string];
      } else {
        // Default: all reviewers and admins
        const users = await this.prisma.user.findMany({
          where: {
            tenant_id: tenantId,
            role: { in: ['reviewer', 'admin'] },
          },
          select: { email: true },
        });
        recipients = users.map(u => u.email);
      }

      if (recipients.length === 0) return;

      // Build dashboard URL
      const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000';
      const approvalUrl = `${dashboardUrl}/dashboard/approvals`;

      // Build risk label
      const riskLabel = approval.risk_classification
        ? `Risk: ${approval.risk_classification.toUpperCase()}`
        : '';

      // Send email
      await this.emailService.send({
        to: recipients,
        subject: `[Approval Required] ${approval.agent_name}: ${approval.operation} → ${approval.target_integration}`,
        text: [
          `An AI agent requires your approval.`,
          ``,
          `Agent: ${approval.agent_name}`,
          `Action: ${approval.operation} → ${approval.target_integration}`,
          `Classification: ${approval.data_classification}`,
          riskLabel,
          ``,
          `Reason: ${approval.flag_reason}`,
          ``,
          `Review and approve/deny:`,
          approvalUrl,
        ].filter(Boolean).join('\n'),
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #0A0A0B; font-size: 18px; margin-bottom: 16px;">Approval Required</h2>

            <div style="background: #f8f9fa; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
              <p style="margin: 0 0 8px 0; font-weight: 600;">${approval.agent_name}</p>
              <p style="margin: 0; font-family: monospace; font-size: 14px; color: #666;">
                ${approval.operation} → ${approval.target_integration}
              </p>
            </div>

            <table style="font-size: 14px; margin-bottom: 16px;">
              <tr><td style="color: #888; padding-right: 12px;">Classification:</td><td>${approval.data_classification}</td></tr>
              ${approval.risk_classification ? `<tr><td style="color: #888; padding-right: 12px;">Risk:</td><td><strong>${approval.risk_classification.toUpperCase()}</strong></td></tr>` : ''}
            </table>

            <p style="font-size: 14px; color: #666; font-style: italic; margin-bottom: 16px;">
              "${approval.flag_reason}"
            </p>

            <a href="${approvalUrl}" style="display: inline-block; background: #0A0A0B; color: #E4E4E7; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
              Review in Dashboard →
            </a>

            <p style="margin-top: 24px; font-size: 12px; color: #aaa;">
              Agent Identity & Approval Layer
            </p>
          </div>
        `,
      });

      lastEmailSent.set(tenantId, Date.now());
    } catch (error) {
      // Email failures must not affect the evaluate endpoint
      console.error('Email notification error:', error);
    }
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/notification-service.ts
git commit -m "feat: add NotificationService with rate limiting and tenant settings"
```

---

### Task 5: Integrate into Evaluate Route

**Files:**
- Modify: `apps/api/src/routes/evaluate.ts`

- [ ] **Step 1: Add risk_classification to the approval_required return value**

In `apps/api/src/routes/evaluate.ts`, find the `approval_required` return statement inside the transaction (around line 174) and add `risk_classification`:

```typescript
return {
  decision: 'approval_required' as const,
  trace_id: trace.id,
  approval_request_id: approvalRequest.id,
  reason: decision.rationale,
  policy_rule_id: decision.rule_id,
  risk_classification: riskClassification,
};
```

> **Note:** This adds an additive field to the response. Existing evaluate integration tests do NOT strictly check response keys, so this won't break them — they only assert on `decision`, `trace_id`, `approval_request_id`, `reason`, and `policy_rule_id`.

- [ ] **Step 2: Add notification dispatch after webhook dispatch**

In `apps/api/src/routes/evaluate.ts`:

1. Add imports at the top:
```typescript
import { EmailService } from '../services/email-service.js';
import { NotificationService } from '../services/notification-service.js';
```

2. Inside `evaluateRoutes()`, after `const webhookService = new WebhookService(prisma);`:
```typescript
const emailService = new EmailService();
const notificationService = new NotificationService(prisma, emailService);
```

3. After the existing webhook dispatch block (after the `webhookService.dispatch(...).catch(() => {});` block), add:
```typescript
// Email notification — AFTER transaction commits, fire and forget
if (result.decision === 'approval_required') {
  notificationService.notifyApprovalRequested(tenantId, {
    id: result.approval_request_id!,
    agent_name: agentName,
    operation: body.operation,
    target_integration: body.target_integration,
    data_classification: body.data_classification,
    risk_classification: result.risk_classification ?? null,
    flag_reason: result.reason,
  }).catch(() => {});  // fire and forget
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/evaluate.ts
git commit -m "feat: dispatch email notification on approval_required in evaluate route"
```

---

### Task 6: Write NotificationService Tests

**Files:**
- Create: `apps/api/src/services/__tests__/notification-service.test.ts`

- [ ] **Step 1: Create test directory and test file**

```bash
mkdir -p apps/api/src/services/__tests__
```

Create `apps/api/src/services/__tests__/notification-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService, resetRateLimitState } from '../notification-service.js';
import type { EmailService, EmailMessage } from '../email-service.js';

// Mock PrismaClient
function createMockPrisma(overrides: {
  tenant?: Record<string, unknown> | null;
  users?: Array<{ email: string }>;
} = {}) {
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(overrides.tenant ?? {
        name: 'Test Workspace',
        settings: {
          notification_email: null,
          notifications_enabled: true,
        },
      }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue(overrides.users ?? [
        { email: 'reviewer@example.com' },
        { email: 'admin@example.com' },
      ]),
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
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd apps/api && npx vitest run src/services/__tests__/notification-service.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/__tests__/notification-service.test.ts
git commit -m "test: add NotificationService unit tests with mocked email provider"
```

---

### Task 7: Run Full Test Suite

- [ ] **Step 1: Run turbo test from repo root**

```bash
npx turbo test
```

Expected: all tests pass, including new notification service tests.

- [ ] **Step 2: Run typecheck**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Final commit (if any fixes needed)**

Only if issues were found and fixed in previous steps.
