import type { PrismaClient } from '../generated/prisma/index.js';
import type { EmailService } from './email-service.js';
import { SlackService } from './integrations/slack-service.js';
import { TelegramService } from './integrations/telegram-service.js';
import { TeamsService } from './integrations/teams-service.js';

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
    owner_name?: string | null;
    expires_at?: string | null;
  }): Promise<void> {
    // Dispatch to chat integrations (fire-and-forget, independent of email)
    this.dispatchChatIntegrations(tenantId, approval).catch(() => {});

    try {
      // Rate limit check (email only)
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

  private async dispatchChatIntegrations(tenantId: string, approval: {
    id: string;
    agent_name: string;
    operation: string;
    target_integration: string;
    data_classification: string;
    risk_classification: string | null;
    flag_reason: string;
    owner_name?: string | null;
    expires_at?: string | null;
  }): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) return;

    const settings = tenant.settings as Record<string, unknown>;
    const integrations = settings?.integrations as Record<string, unknown> | undefined;
    if (!integrations) return;

    const dashboardUrl = `${process.env['DASHBOARD_URL'] ?? 'https://app.sidclaw.com'}/dashboard/approvals`;
    const notificationPayload = { ...approval, dashboard_url: dashboardUrl };

    // Slack
    const slack = integrations.slack as Record<string, unknown> | undefined;
    if (slack?.enabled) {
      const slackService = new SlackService();
      slackService.sendApprovalNotification(
        {
          bot_token: slack.bot_token as string | undefined,
          webhook_url: slack.webhook_url as string | undefined,
          channel_id: slack.channel_id as string | undefined,
          signing_secret: slack.signing_secret as string | undefined,
        },
        notificationPayload,
      ).catch(err => console.error('[Slack notification error]', err));
    }

    // Telegram
    const telegram = integrations.telegram as Record<string, unknown> | undefined;
    if (telegram?.enabled && telegram.bot_token && telegram.chat_id) {
      const telegramService = new TelegramService();
      telegramService.sendApprovalNotification(
        telegram.bot_token as string,
        telegram.chat_id as string,
        notificationPayload,
      ).catch(err => console.error('[Telegram notification error]', err));
    }

    // Microsoft Teams
    const teams = integrations.teams as Record<string, unknown> | undefined;
    if (teams?.enabled && teams.webhook_url) {
      const teamsService = new TeamsService();
      teamsService.sendApprovalNotification(
        {
          webhook_url: teams.webhook_url as string | undefined,
          bot_id: teams.bot_id as string | undefined,
          bot_secret: teams.bot_secret as string | undefined,
        },
        notificationPayload,
      ).catch(err => console.error('[Teams notification error]', err));
    }
  }
}
