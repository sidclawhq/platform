import { FastifyInstance } from 'fastify';
import { ApprovalService } from '../../services/approval-service.js';
import { TelegramService } from '../../services/integrations/telegram-service.js';
import { prisma } from '../../db/client.js';

interface TelegramUpdate {
  callback_query?: {
    id: string;
    data: string;
    from?: { first_name?: string };
    message?: {
      message_id: number;
      chat?: { id: number };
    };
  };
}

export async function telegramRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/integrations/telegram/webhook
   * Receives Telegram callback queries (button clicks).
   * Set up via: POST https://api.telegram.org/bot<token>/setWebhook
   */
  app.post('/integrations/telegram/webhook', async (request, reply) => {
    const update = request.body as TelegramUpdate;

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const parts = callbackData.split(':');
      const action = parts[0] ?? '';
      const approvalId = parts[1] ?? '';
      const telegramUser = update.callback_query.from?.first_name ?? 'Telegram User';
      const messageId = update.callback_query.message?.message_id;
      const chatId = update.callback_query.message?.chat?.id;

      if (!approvalId || !['approve', 'deny'].includes(action)) {
        return reply.send({ ok: true });
      }

      // Look up approval to get tenant
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: approvalId },
        include: { agent: true },
      });

      if (!approval) {
        await answerCallbackQuery(update.callback_query.id, 'Approval not found', null);
        return reply.send({ ok: true });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: approval.tenant_id } });
      const integrations = (tenant?.settings as Record<string, unknown> | null)?.integrations as Record<string, unknown> | undefined;
      const telegramConfig = integrations?.telegram as Record<string, unknown> | undefined;
      const botToken = telegramConfig?.bot_token as string | undefined;

      const approvalService = new ApprovalService(prisma);

      try {
        if (action === 'approve') {
          await approvalService.approve(approvalId, {
            approver_name: telegramUser,
            decision_note: 'Approved via Telegram',
          });
        } else {
          await approvalService.deny(approvalId, {
            approver_name: telegramUser,
            decision_note: 'Denied via Telegram',
          });
        }

        // Update the message
        if (botToken && chatId && messageId) {
          const telegramService = new TelegramService();
          await telegramService.updateMessage(
            botToken,
            String(chatId),
            messageId,
            action === 'approve' ? 'approved' : 'denied',
            telegramUser,
          );
        }

        // Answer the callback query
        await answerCallbackQuery(
          update.callback_query.id,
          action === 'approve' ? 'Approved' : 'Denied',
          botToken ?? null,
        );
      } catch (error: unknown) {
        const appError = error as { statusCode?: number };
        const msg = appError.statusCode === 409
          ? 'Already decided'
          : appError.statusCode === 403
            ? 'Separation of duties violation'
            : 'Error processing action';
        await answerCallbackQuery(update.callback_query.id, msg, botToken ?? null);
      }
    }

    return reply.send({ ok: true });
  });
}

async function answerCallbackQuery(callbackQueryId: string, text: string, botToken: string | null): Promise<void> {
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {});
}
