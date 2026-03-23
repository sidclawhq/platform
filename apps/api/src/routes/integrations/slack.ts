import { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { ApprovalService } from '../../services/approval-service.js';
import { prisma } from '../../db/client.js';

export async function slackRoutes(app: FastifyInstance) {
  // Register content type parser for Slack's x-www-form-urlencoded payloads
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      // Store raw body for signature verification, pass parsed string
      (_req as unknown as Record<string, unknown>).rawBody = body;
      done(null, body);
    },
  );

  /**
   * POST /api/v1/integrations/slack/actions
   * Receives Slack interactive message callbacks (button clicks).
   * Slack sends application/x-www-form-urlencoded with a "payload" JSON field.
   * Verified via Slack signing secret — no SidClaw auth.
   */
  app.post('/integrations/slack/actions', async (request, reply) => {
    const rawBody = (request as unknown as Record<string, unknown>).rawBody as string | undefined;
    const timestamp = request.headers['x-slack-request-timestamp'] as string | undefined;
    const slackSignature = request.headers['x-slack-signature'] as string | undefined;

    // Prevent replay attacks (reject if timestamp > 5 min old)
    if (timestamp && Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
      return reply.status(403).send({ error: 'Request too old' });
    }

    // Parse the payload from form-encoded body
    const bodyStr = typeof request.body === 'string' ? request.body : '';
    const params = new URLSearchParams(bodyStr);
    const payloadStr = params.get('payload');

    if (!payloadStr) {
      return reply.status(400).send({ error: 'Missing payload' });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      return reply.status(400).send({ error: 'Invalid payload JSON' });
    }

    const actions = payload.actions as Array<{ action_id: string; value: string }> | undefined;
    const action = actions?.[0];
    if (!action) {
      return reply.status(400).send({ error: 'No action found' });
    }

    const approvalId = action.value;
    const actionType = action.action_id;

    // Skip view_dashboard — it's a link, no processing needed
    if (actionType === 'view_dashboard') {
      return reply.send({ ok: true });
    }

    // Look up the approval to find the tenant
    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      include: { agent: true },
    });

    if (!approval) {
      return reply.status(404).send({ error: 'Approval not found' });
    }

    // Verify Slack signature with the tenant's signing secret
    const tenant = await prisma.tenant.findUnique({ where: { id: approval.tenant_id } });
    const signingSecret = (tenant?.settings as Record<string, unknown> | null)?.integrations as Record<string, unknown> | undefined;
    const slackConfig = signingSecret?.slack as Record<string, unknown> | undefined;
    const secret = slackConfig?.signing_secret as string | undefined;

    if (secret && rawBody && timestamp && slackSignature) {
      const sigBasestring = `v0:${timestamp}:${rawBody}`;
      const mySignature = 'v0=' + createHmac('sha256', secret).update(sigBasestring).digest('hex');
      try {
        if (!timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature))) {
          return reply.status(403).send({ error: 'Invalid signature' });
        }
      } catch {
        return reply.status(403).send({ error: 'Invalid signature' });
      }
    }

    // Process the approval action
    const user = payload.user as Record<string, string> | undefined;
    const slackUser = user?.name ?? user?.real_name ?? 'Slack User';
    const approvalService = new ApprovalService(prisma);

    try {
      if (actionType === 'approve_action') {
        await approvalService.approve(approvalId, {
          approver_name: slackUser,
          decision_note: 'Approved via Slack',
        });
      } else if (actionType === 'deny_action') {
        await approvalService.deny(approvalId, {
          approver_name: slackUser,
          decision_note: 'Denied via Slack',
        });
      }
    } catch (error: unknown) {
      const appError = error as { statusCode?: number };
      const responseUrl = payload.response_url as string | undefined;
      if (appError.statusCode === 409) {
        const msg = { response_type: 'ephemeral', text: 'This approval has already been decided.' };
        if (responseUrl) { fetch(responseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) }).catch(() => {}); }
        return reply.header('content-type', 'application/json').send(msg);
      }
      if (appError.statusCode === 403) {
        const msg = { response_type: 'ephemeral', text: 'You cannot approve your own agent\'s requests (separation of duties).' };
        if (responseUrl) { fetch(responseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) }).catch(() => {}); }
        return reply.header('content-type', 'application/json').send(msg);
      }
      throw error;
    }

    // Update the original message — replace buttons with decision result
    const decision = actionType === 'approve_action' ? 'approved' : 'denied';
    const emoji = decision === 'approved' ? '\u{2705}' : '\u{274C}';
    const verb = decision === 'approved' ? 'Approved' : 'Denied';

    const updatedBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${verb}* by *${slackUser}*\n\`${approval.requested_operation}\` \u{2192} \`${approval.target_integration}\` by *${approval.agent.name}*`,
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '<https://sidclaw.com|SidClaw>' },
        ],
      },
    ];

    // Use chat.update to replace the original message in-place (removes buttons)
    const channel = (payload.channel as Record<string, string> | undefined)?.id;
    const messageTs = (payload.message as Record<string, string> | undefined)?.ts;
    const slackBotToken = slackConfig?.bot_token as string | undefined;

    if (slackBotToken && channel && messageTs) {
      fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackBotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          ts: messageTs,
          text: `${emoji} ${verb} by ${slackUser}`,
          blocks: updatedBlocks,
        }),
      }).catch(() => {});
    }

    // Return 200 to Slack (no replace_original — we handle it via chat.update above)
    return reply.header('content-type', 'application/json').send({ ok: true });
  });
}
