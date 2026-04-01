import { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { ApprovalService } from '../../services/approval-service.js';
import { TeamsService } from '../../services/integrations/teams-service.js';
import { prisma } from '../../db/client.js';

interface TeamsActivity {
  type: string;
  value?: {
    action?: string;
    approval_id?: string;
  };
  from?: {
    id?: string;
    name?: string;
  };
  serviceUrl?: string;
  conversation?: {
    id?: string;
  };
  replyToId?: string;
}

export async function teamsRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/integrations/teams/callback
   * Receives Bot Framework Activity messages when a user clicks Approve/Deny
   * in a Teams Adaptive Card.
   *
   * Security: validated via HMAC shared secret (bot_secret).
   * Full JWT validation of Bot Framework tokens is a v2 enhancement.
   */
  app.post('/integrations/teams/callback', async (request, reply) => {
    const activity = request.body as TeamsActivity;

    // Only handle invoke/message activities with submit data
    if (!activity.value?.action || !activity.value?.approval_id) {
      return reply.status(200).send({ ok: true });
    }

    const { action, approval_id: approvalId } = activity.value;
    const teamsUser = activity.from?.name ?? 'Teams User';

    if (!['approve', 'deny'].includes(action)) {
      return reply.status(200).send({ ok: true });
    }

    // Look up the approval to find the tenant
    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      include: { agent: true },
    });

    if (!approval) {
      return reply.status(404).send({ error: 'Approval not found' });
    }

    // Load tenant config for validation and message update
    const tenant = await prisma.tenant.findUnique({ where: { id: approval.tenant_id } });
    const integrations = (tenant?.settings as Record<string, unknown> | null)?.integrations as Record<string, unknown> | undefined;
    const teamsConfig = integrations?.teams as Record<string, unknown> | undefined;
    const botSecret = teamsConfig?.bot_secret as string | undefined;

    // Validate HMAC signature — fail-closed if not configured
    if (!botSecret) {
      return reply.status(403).send({ error: 'Teams bot secret not configured — cannot verify request authenticity' });
    }

    const signature = request.headers['x-teams-signature'] as string | undefined;
    const timestamp = request.headers['x-teams-timestamp'] as string | undefined;

    if (!signature || !timestamp) {
      return reply.status(403).send({ error: 'Missing signature headers' });
    }

    // Reject requests older than 5 minutes (replay prevention)
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
      return reply.status(403).send({ error: 'Request too old' });
    }

    const rawBody = JSON.stringify(request.body);
    const sigBasestring = `${timestamp}:${rawBody}`;
    const expectedSig = createHmac('sha256', botSecret).update(sigBasestring).digest('hex');

    try {
      if (!timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
        return reply.status(403).send({ error: 'Invalid signature' });
      }
    } catch {
      return reply.status(403).send({ error: 'Invalid signature' });
    }

    // Process the approval action
    const approvalService = new ApprovalService(prisma);

    try {
      if (action === 'approve') {
        await approvalService.approve(approvalId, {
          approver_name: teamsUser,
          decision_note: 'Approved via Microsoft Teams',
        });
      } else {
        await approvalService.deny(approvalId, {
          approver_name: teamsUser,
          decision_note: 'Denied via Microsoft Teams',
        });
      }
    } catch (error: unknown) {
      const appError = error as { statusCode?: number };
      if (appError.statusCode === 409) {
        const current = await prisma.approvalRequest.findUnique({ where: { id: approvalId }, select: { status: true } });
        const text = current?.status === 'expired'
          ? 'This approval has expired.'
          : 'This approval has already been decided.';
        return reply.status(409).send({ error: 'conflict', message: text });
      }
      if (appError.statusCode === 403) {
        return reply.status(403).send({ error: 'forbidden', message: 'Separation of duties: you cannot approve your own agent\'s requests.' });
      }
      throw error;
    }

    // Update the original Teams message (replace card with decision result)
    const botId = teamsConfig?.bot_id as string | undefined;
    const serviceUrl = activity.serviceUrl;
    const conversationId = activity.conversation?.id;
    const activityId = activity.replyToId;

    if (botId && botSecret && serviceUrl && conversationId && activityId) {
      const teamsService = new TeamsService();
      const decisionCard = teamsService.buildDecisionCard(
        action === 'approve' ? 'approved' : 'denied',
        teamsUser,
        {
          agent_name: approval.agent.name,
          operation: approval.requested_operation,
          target_integration: approval.target_integration,
        },
      );

      teamsService.updateMessage(
        serviceUrl,
        conversationId,
        activityId,
        botId,
        botSecret,
        decisionCard,
      ).catch(err => console.error('[Teams] Failed to update message:', err));
    }

    return reply.status(200).send({ ok: true });
  });
}
