import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { NotFoundError } from '../../errors.js';
import { requireRole } from '../../middleware/require-role.js';
import { SlackService } from '../../services/integrations/slack-service.js';
import { TeamsService } from '../../services/integrations/teams-service.js';
import { TelegramService } from '../../services/integrations/telegram-service.js';

const SlackConfigSchema = z.object({
  enabled: z.boolean(),
  webhook_url: z.string().url().optional().nullable(),
  bot_token: z.string().optional().nullable(),
  channel_id: z.string().optional().nullable(),
  signing_secret: z.string().optional().nullable(),
}).strict();

const TeamsConfigSchema = z.object({
  enabled: z.boolean(),
  webhook_url: z.string().url().optional().nullable(),
}).strict();

const TelegramConfigSchema = z.object({
  enabled: z.boolean(),
  bot_token: z.string().optional().nullable(),
  chat_id: z.string().optional().nullable(),
}).strict();

const UpdateIntegrationsSchema = z.object({
  slack: SlackConfigSchema.optional(),
  teams: TeamsConfigSchema.optional(),
  telegram: TelegramConfigSchema.optional(),
}).strict();

function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

interface IntegrationSettings {
  slack?: {
    enabled: boolean;
    webhook_url?: string | null;
    bot_token?: string | null;
    channel_id?: string | null;
    signing_secret?: string | null;
  };
  teams?: {
    enabled: boolean;
    webhook_url?: string | null;
  };
  telegram?: {
    enabled: boolean;
    bot_token?: string | null;
    chat_id?: string | null;
  };
}

function formatIntegrations(integrations: IntegrationSettings | undefined) {
  return {
    slack: {
      enabled: integrations?.slack?.enabled ?? false,
      webhook_url: integrations?.slack?.webhook_url ? maskToken(integrations.slack.webhook_url) : null,
      bot_token: integrations?.slack?.bot_token ? maskToken(integrations.slack.bot_token) : null,
      channel_id: integrations?.slack?.channel_id ?? null,
      signing_secret: integrations?.slack?.signing_secret ? '****' : null,
    },
    teams: {
      enabled: integrations?.teams?.enabled ?? false,
      webhook_url: integrations?.teams?.webhook_url ? maskToken(integrations.teams.webhook_url) : null,
    },
    telegram: {
      enabled: integrations?.telegram?.enabled ?? false,
      bot_token: integrations?.telegram?.bot_token ? maskToken(integrations.telegram.bot_token) : null,
      chat_id: integrations?.telegram?.chat_id ?? null,
    },
  };
}

export async function integrationSettingsRoutes(app: FastifyInstance) {
  // GET /api/v1/tenant/integrations — returns current integration config (tokens masked)
  app.get('/tenant/integrations', {
    preHandler: requireRole('admin'),
  }, async (request, reply) => {
    const tenantId = request.tenantId!;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const settings = tenant.settings as Record<string, unknown>;
    const integrations = settings?.integrations as IntegrationSettings | undefined;

    return reply.send({ data: formatIntegrations(integrations) });
  });

  // PATCH /api/v1/tenant/integrations — update integration settings
  app.patch('/tenant/integrations', {
    preHandler: requireRole('admin'),
  }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const body = UpdateIntegrationsSchema.parse(request.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const currentSettings = tenant.settings as Record<string, unknown>;
    const currentIntegrations = (currentSettings?.integrations ?? {}) as IntegrationSettings;

    // Merge: for each provider in the body, merge with current (preserving unset fields)
    const merged: IntegrationSettings = { ...currentIntegrations };
    if (body.slack) {
      merged.slack = { ...currentIntegrations.slack, ...body.slack };
    }
    if (body.teams) {
      merged.teams = { ...currentIntegrations.teams, ...body.teams };
    }
    if (body.telegram) {
      merged.telegram = { ...currentIntegrations.telegram, ...body.telegram };
    }

    const updatedSettings = { ...currentSettings, integrations: merged };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: updatedSettings as unknown as Parameters<typeof prisma.tenant.update>[0]['data']['settings'] },
    });

    // Auto-register Telegram webhook when bot_token is saved
    if (body.telegram?.bot_token && body.telegram.bot_token !== currentIntegrations.telegram?.bot_token) {
      const apiBaseUrl = process.env['API_BASE_URL'] ?? 'https://api.sidclaw.com';
      const telegramService = new TelegramService();
      telegramService.setWebhook(
        body.telegram.bot_token,
        `${apiBaseUrl}/api/v1/integrations/telegram/webhook`,
      ).catch(err => console.error('[Telegram webhook registration error]', err));
    }

    return reply.send({ data: formatIntegrations(merged) });
  });

  // POST /api/v1/tenant/integrations/:provider/test — send a test notification
  app.post<{ Params: { provider: string } }>('/tenant/integrations/:provider/test', {
    preHandler: requireRole('admin'),
  }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const { provider } = request.params;

    if (!['slack', 'teams', 'telegram'].includes(provider)) {
      return reply.status(400).send({ error: 'validation_error', message: `Unknown provider: ${provider}`, status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const settings = tenant.settings as Record<string, unknown>;
    const integrations = settings?.integrations as IntegrationSettings | undefined;
    const dashboardUrl = `${process.env['DASHBOARD_URL'] ?? 'https://app.sidclaw.com'}/dashboard/approvals`;

    try {
      if (provider === 'slack') {
        const config = integrations?.slack;
        if (!config?.enabled) {
          return reply.status(400).send({ error: 'validation_error', message: 'Slack integration is not enabled', status: 400 });
        }
        const slackService = new SlackService();
        await slackService.sendTestNotification(config, dashboardUrl);
      } else if (provider === 'teams') {
        const config = integrations?.teams;
        if (!config?.enabled || !config.webhook_url) {
          return reply.status(400).send({ error: 'validation_error', message: 'Teams integration is not enabled or webhook URL missing', status: 400 });
        }
        const teamsService = new TeamsService();
        await teamsService.sendTestNotification(config.webhook_url, dashboardUrl);
      } else if (provider === 'telegram') {
        const config = integrations?.telegram;
        if (!config?.enabled || !config.bot_token || !config.chat_id) {
          return reply.status(400).send({ error: 'validation_error', message: 'Telegram integration is not enabled or missing bot token/chat ID', status: 400 });
        }
        const telegramService = new TelegramService();
        await telegramService.sendTestNotification(config.bot_token, config.chat_id, dashboardUrl);
      }

      return reply.send({ success: true, message: `Test notification sent to ${provider}` });
    } catch (err) {
      console.error(`[Integration test] ${provider} error:`, err);
      return reply.status(502).send({
        error: 'integration_error',
        message: `Failed to send test notification to ${provider}`,
        status: 502,
      });
    }
  });
}
