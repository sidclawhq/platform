import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let testData: Awaited<ReturnType<typeof seedTestData>>;

// Mock fetch for external API calls
const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  const server = await createTestServer();
  app = server.app;
  prisma = server.prisma;
});

afterAll(async () => {
  await destroyTestServer();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
  testData = await seedTestData(prisma);

  // Add second user for SoD enforcement
  await prisma.user.create({
    data: {
      tenant_id: testData.tenant.id,
      email: 'reviewer@example.com',
      name: 'Test Reviewer',
      role: 'reviewer',
      auth_provider: 'email',
    },
  });

  // Mock fetch
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => '{"ok":true}',
    json: async () => ({ ok: true }),
  });
  globalThis.fetch = fetchMock;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createApprovalPolicy() {
  await prisma.policyRule.create({
    data: {
      id: 'pol-integration-test',
      tenant_id: testData.tenant.id,
      agent_id: testData.agent.id,
      policy_name: 'Require approval for send',
      target_integration: 'communications_service',
      operation: 'send',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Requires human review',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'test',
    },
  });
}

async function evaluateForApproval(): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/evaluate',
    headers: { authorization: `Bearer ${testData.rawApiKey}` },
    payload: {
      agent_id: testData.agent.id,
      operation: 'send',
      target_integration: 'communications_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
    },
  });
  return response.json().approval_request_id;
}

const SLACK_SIGNING_SECRET = 'test-signing-secret';

function makeSlackPayload(payloadObj: Record<string, unknown>): {
  body: string;
  headers: Record<string, string>;
} {
  const payloadStr = JSON.stringify(payloadObj);
  const body = `payload=${encodeURIComponent(payloadStr)}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sigBasestring = `v0:${timestamp}:${body}`;
  const signature = 'v0=' + createHmac('sha256', SLACK_SIGNING_SECRET).update(sigBasestring).digest('hex');
  return {
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    },
  };
}

async function enableSlackIntegration(config?: Record<string, unknown>) {
  const settings = testData.tenant.settings as Record<string, unknown>;
  await prisma.tenant.update({
    where: { id: testData.tenant.id },
    data: {
      settings: {
        ...settings,
        integrations: {
          slack: {
            enabled: true,
            bot_token: 'xoxb-test-token',
            channel_id: 'C0123456789',
            signing_secret: 'test-signing-secret',
            ...config,
          },
        },
      },
    },
  });
}

async function enableTelegramIntegration() {
  const settings = testData.tenant.settings as Record<string, unknown>;
  await prisma.tenant.update({
    where: { id: testData.tenant.id },
    data: {
      settings: {
        ...settings,
        integrations: {
          telegram: {
            enabled: true,
            bot_token: 'test-telegram-bot-token',
            chat_id: '-100123456789',
          },
        },
      },
    },
  });
}

// ── Slack Integration Tests ──────────────────────────────────────────────────

describe('Slack Integration', () => {
  it('processes approve callback and updates approval status', async () => {
    await createApprovalPolicy();
    await enableSlackIntegration();
    const approvalId = await evaluateForApproval();

    // Reset fetch mock to track calls from this point
    fetchMock.mockClear();

    const slackReq = makeSlackPayload({
      actions: [{ action_id: 'approve_action', value: approvalId }],
      user: { name: 'SlackReviewer' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/slack/actions',
      headers: slackReq.headers,
      payload: slackReq.body,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(true);

    // Verify the approval was actually approved in DB
    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(approval?.status).toBe('approved');
    expect(approval?.approver_name).toBe('SlackReviewer');
  });

  it('processes deny callback and updates approval status', async () => {
    await createApprovalPolicy();
    await enableSlackIntegration();
    const approvalId = await evaluateForApproval();
    fetchMock.mockClear();

    const slackReq = makeSlackPayload({
      actions: [{ action_id: 'deny_action', value: approvalId }],
      user: { name: 'SlackReviewer' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/slack/actions',
      headers: slackReq.headers,
      payload: slackReq.body,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(true);

    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(approval?.status).toBe('denied');
  });

  it('returns 409 for already-decided approval', async () => {
    await createApprovalPolicy();
    await enableSlackIntegration();
    const approvalId = await evaluateForApproval();

    // First: approve via API
    await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${approvalId}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Direct Reviewer' },
    });

    fetchMock.mockClear();

    // Second: try via Slack
    const slackReq = makeSlackPayload({
      actions: [{ action_id: 'approve_action', value: approvalId }],
      user: { name: 'SlackReviewer' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/slack/actions',
      headers: slackReq.headers,
      payload: slackReq.body,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.response_type).toBe('ephemeral');
    expect(body.text).toContain('already been decided');
  });

  it('returns error for separation of duties violation', async () => {
    await createApprovalPolicy();
    await enableSlackIntegration();
    const approvalId = await evaluateForApproval();
    fetchMock.mockClear();

    // Owner name matches agent owner
    const slackReq = makeSlackPayload({
      actions: [{ action_id: 'approve_action', value: approvalId }],
      user: { name: 'Test Owner' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/slack/actions',
      headers: slackReq.headers,
      payload: slackReq.body,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.response_type).toBe('ephemeral');
    expect(body.text).toContain('separation of duties');
  });

  it('falls back to webhook URL when no bot token', async () => {
    await enableSlackIntegration({ bot_token: null, channel_id: null, webhook_url: 'https://hooks.slack.test/webhook' });
    await createApprovalPolicy();
    fetchMock.mockClear();

    // Trigger notification by evaluating (the notification is fire-and-forget)
    await evaluateForApproval();

    // Wait briefly for async notification dispatch
    await new Promise(r => setTimeout(r, 100));

    // Check that fetch was called with the webhook URL
    const webhookCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string) === 'https://hooks.slack.test/webhook',
    );
    expect(webhookCalls.length).toBe(1);
  });

  it('returns 400 for missing payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/slack/actions',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'nopayload=true',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('Missing payload');
  });

  it('rejects callback without Slack signature headers when signing secret is configured', async () => {
    await createApprovalPolicy();
    await enableSlackIntegration();
    const approvalId = await evaluateForApproval();

    // Send without Slack signature headers — should be rejected
    const payload = JSON.stringify({
      actions: [{ action_id: 'approve_action', value: approvalId }],
      user: { name: 'Attacker' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/slack/actions',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `payload=${encodeURIComponent(payload)}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('Missing Slack signature headers');

    // Verify the approval was NOT approved
    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(approval?.status).toBe('pending');
  });

  it('returns 404 for non-existent approval', async () => {
    const payload = JSON.stringify({
      actions: [{ action_id: 'approve_action', value: 'non-existent-id' }],
      user: { name: 'SlackReviewer' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/slack/actions',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `payload=${encodeURIComponent(payload)}`,
    });

    expect(response.statusCode).toBe(404);
  });
});

// ── Telegram Integration Tests ───────────────────────────────────────────────

describe('Telegram Integration', () => {
  it('sends message with inline keyboard (mock Telegram API)', async () => {
    await enableTelegramIntegration();
    await createApprovalPolicy();
    fetchMock.mockClear();

    await evaluateForApproval();

    // Wait for fire-and-forget dispatch
    await new Promise(r => setTimeout(r, 100));

    const telegramCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes('api.telegram.org'),
    );
    expect(telegramCalls.length).toBeGreaterThanOrEqual(1);

    const sendCall = telegramCalls.find(
      (call: unknown[]) => (call[0] as string).includes('/sendMessage'),
    );
    expect(sendCall).toBeDefined();

    const body = JSON.parse((sendCall![1] as RequestInit).body as string);
    expect(body.chat_id).toBe('-100123456789');
    expect(body.reply_markup.inline_keyboard).toBeDefined();
    expect(body.reply_markup.inline_keyboard[0].length).toBe(3); // Approve + Deny + Dashboard
  });

  it('processes callback query for approve', async () => {
    await createApprovalPolicy();
    await enableTelegramIntegration();
    const approvalId = await evaluateForApproval();
    fetchMock.mockClear();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/telegram/webhook',
      payload: {
        callback_query: {
          id: 'test-callback-id',
          data: `approve:${approvalId}`,
          from: { first_name: 'TelegramUser' },
          message: { message_id: 123, chat: { id: -100123456789 } },
        },
      },
    });

    expect(response.statusCode).toBe(200);

    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(approval?.status).toBe('approved');
    expect(approval?.approver_name).toBe('TelegramUser');
  });

  it('processes callback query for deny', async () => {
    await createApprovalPolicy();
    await enableTelegramIntegration();
    const approvalId = await evaluateForApproval();
    fetchMock.mockClear();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/telegram/webhook',
      payload: {
        callback_query: {
          id: 'test-callback-id',
          data: `deny:${approvalId}`,
          from: { first_name: 'TelegramUser' },
          message: { message_id: 123, chat: { id: -100123456789 } },
        },
      },
    });

    expect(response.statusCode).toBe(200);

    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(approval?.status).toBe('denied');
  });

  it('removes buttons and answers callback after decision', async () => {
    await createApprovalPolicy();
    await enableTelegramIntegration();
    const approvalId = await evaluateForApproval();
    fetchMock.mockClear();

    await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/telegram/webhook',
      payload: {
        callback_query: {
          id: 'test-callback-id',
          data: `approve:${approvalId}`,
          from: { first_name: 'TelegramUser' },
          message: { message_id: 123, chat: { id: -100123456789 } },
        },
      },
    });

    // Check that editMessageReplyMarkup, sendMessage, and answerCallbackQuery were called
    const telegramCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes('api.telegram.org'),
    );

    const editMarkupCall = telegramCalls.find(
      (call: unknown[]) => (call[0] as string).includes('editMessageReplyMarkup'),
    );
    expect(editMarkupCall).toBeDefined();

    const answerCall = telegramCalls.find(
      (call: unknown[]) => (call[0] as string).includes('answerCallbackQuery'),
    );
    expect(answerCall).toBeDefined();
  });
});

// ── Microsoft Teams Integration Tests ────────────────────────────────────────

const TEAMS_BOT_SECRET = 'test-teams-bot-secret';

async function enableTeamsIntegration(config?: Record<string, unknown>) {
  const settings = testData.tenant.settings as Record<string, unknown>;
  const currentIntegrations = (settings?.integrations ?? {}) as Record<string, unknown>;
  await prisma.tenant.update({
    where: { id: testData.tenant.id },
    data: {
      settings: {
        ...settings,
        integrations: {
          ...currentIntegrations,
          teams: {
            enabled: true,
            webhook_url: 'https://teams.test.webhook/incoming',
            bot_id: 'test-bot-id',
            bot_secret: TEAMS_BOT_SECRET,
            ...config,
          },
        },
      },
    },
  });
}

function makeTeamsCallbackPayload(action: string, approvalId: string, userName?: string): {
  body: Record<string, unknown>;
  headers: Record<string, string>;
} {
  const body = {
    type: 'invoke',
    value: { action, approval_id: approvalId },
    from: { id: 'teams-user-id', name: userName ?? 'TeamsReviewer' },
    serviceUrl: 'https://smba.trafficmanager.net/teams/',
    conversation: { id: 'conv-123' },
    replyToId: 'activity-456',
  };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify(body);
  const sigBasestring = `${timestamp}:${rawBody}`;
  const signature = createHmac('sha256', TEAMS_BOT_SECRET).update(sigBasestring).digest('hex');
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'x-teams-timestamp': timestamp,
      'x-teams-signature': signature,
    },
  };
}

describe('Microsoft Teams Integration', () => {
  it('sends Adaptive Card via webhook when notification is triggered', async () => {
    await enableTeamsIntegration();
    await createApprovalPolicy();
    fetchMock.mockClear();

    await evaluateForApproval();
    await new Promise(r => setTimeout(r, 150));

    const teamsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string) === 'https://teams.test.webhook/incoming',
    );
    expect(teamsCalls.length).toBe(1);

    const payload = JSON.parse((teamsCalls[0]![1] as RequestInit).body as string);
    expect(payload.type).toBe('message');
    expect(payload.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(payload.attachments[0].content.type).toBe('AdaptiveCard');
  });

  it('sends Adaptive Card with correct agent info', async () => {
    await enableTeamsIntegration();
    await createApprovalPolicy();
    fetchMock.mockClear();

    await evaluateForApproval();
    await new Promise(r => setTimeout(r, 150));

    const teamsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string) === 'https://teams.test.webhook/incoming',
    );

    const card = JSON.parse((teamsCalls[0]![1] as RequestInit).body as string).attachments[0].content;
    const factSet = card.body.find((b: Record<string, unknown>) => b.type === 'FactSet');
    expect(factSet.facts[0].value).toBe(testData.agent.name);
  });

  it('includes Action.Submit buttons in bot mode', async () => {
    await enableTeamsIntegration();
    await createApprovalPolicy();
    fetchMock.mockClear();

    await evaluateForApproval();
    await new Promise(r => setTimeout(r, 150));

    const teamsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string) === 'https://teams.test.webhook/incoming',
    );

    const card = JSON.parse((teamsCalls[0]![1] as RequestInit).body as string).attachments[0].content;
    const submitActions = card.actions.filter((a: Record<string, unknown>) => a.type === 'Action.Submit');
    expect(submitActions.length).toBe(2); // Approve + Deny
    expect(submitActions[0].data.action).toBe('approve');
    expect(submitActions[1].data.action).toBe('deny');
  });

  it('falls back to OpenUrl when no bot credentials', async () => {
    await enableTeamsIntegration({ bot_id: null, bot_secret: null });
    await createApprovalPolicy();
    fetchMock.mockClear();

    await evaluateForApproval();
    await new Promise(r => setTimeout(r, 150));

    const teamsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string) === 'https://teams.test.webhook/incoming',
    );
    expect(teamsCalls.length).toBe(1);

    const card = JSON.parse((teamsCalls[0]![1] as RequestInit).body as string).attachments[0].content;
    // No Action.Submit buttons, only Action.OpenUrl
    const submitActions = card.actions.filter((a: Record<string, unknown>) => a.type === 'Action.Submit');
    expect(submitActions.length).toBe(0);
    const openUrlActions = card.actions.filter((a: Record<string, unknown>) => a.type === 'Action.OpenUrl');
    expect(openUrlActions.length).toBe(1);
  });

  it('handles all risk levels correctly', async () => {
    await enableTeamsIntegration();

    // Create a critical risk policy
    await prisma.policyRule.create({
      data: {
        id: 'pol-teams-critical',
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Critical risk',
        target_integration: 'critical_system',
        operation: 'delete',
        resource_scope: 'all',
        data_classification: 'restricted',
        policy_effect: 'approval_required',
        rationale: 'Critical action',
        priority: 50,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    fetchMock.mockClear();

    await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'delete',
        target_integration: 'critical_system',
        resource_scope: 'all',
        data_classification: 'restricted',
      },
    });

    await new Promise(r => setTimeout(r, 150));

    const teamsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string) === 'https://teams.test.webhook/incoming',
    );
    expect(teamsCalls.length).toBe(1);
  });

  it('processes approve callback and updates approval status', async () => {
    await createApprovalPolicy();
    await enableTeamsIntegration();
    const approvalId = await evaluateForApproval();
    fetchMock.mockClear();

    const teamsReq = makeTeamsCallbackPayload('approve', approvalId);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/teams/callback',
      headers: teamsReq.headers,
      payload: teamsReq.body,
    });

    expect(response.statusCode).toBe(200);

    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(approval?.status).toBe('approved');
    expect(approval?.approver_name).toBe('TeamsReviewer');
    expect(approval?.decision_note).toBe('Approved via Microsoft Teams');
  });

  it('processes deny callback and updates approval status', async () => {
    await createApprovalPolicy();
    await enableTeamsIntegration();
    const approvalId = await evaluateForApproval();
    fetchMock.mockClear();

    const teamsReq = makeTeamsCallbackPayload('deny', approvalId);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/teams/callback',
      headers: teamsReq.headers,
      payload: teamsReq.body,
    });

    expect(response.statusCode).toBe(200);

    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(approval?.status).toBe('denied');
    expect(approval?.approver_name).toBe('TeamsReviewer');
  });

  it('returns 409 for already-decided approval', async () => {
    await createApprovalPolicy();
    await enableTeamsIntegration();
    const approvalId = await evaluateForApproval();

    // First: approve via API
    await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${approvalId}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Direct Reviewer' },
    });

    fetchMock.mockClear();

    const teamsReq = makeTeamsCallbackPayload('approve', approvalId);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/teams/callback',
      headers: teamsReq.headers,
      payload: teamsReq.body,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('already been decided');
  });

  it('returns 403 for separation of duties violation', async () => {
    await createApprovalPolicy();
    await enableTeamsIntegration();
    const approvalId = await evaluateForApproval();
    fetchMock.mockClear();

    // Owner name matches agent owner
    const teamsReq = makeTeamsCallbackPayload('approve', approvalId, 'Test Owner');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/teams/callback',
      headers: teamsReq.headers,
      payload: teamsReq.body,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain('Separation of duties');
  });

  it('rejects callback with invalid signature', async () => {
    await createApprovalPolicy();
    await enableTeamsIntegration();
    const approvalId = await evaluateForApproval();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/teams/callback',
      headers: {
        'content-type': 'application/json',
        'x-teams-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-teams-signature': 'invalid-signature',
      },
      payload: {
        type: 'invoke',
        value: { action: 'approve', approval_id: approvalId },
        from: { name: 'Attacker' },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('Invalid signature');

    // Verify the approval was NOT approved
    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(approval?.status).toBe('pending');
  });

  it('rejects callback with missing signature headers', async () => {
    await createApprovalPolicy();
    await enableTeamsIntegration();
    const approvalId = await evaluateForApproval();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/teams/callback',
      headers: { 'content-type': 'application/json' },
      payload: {
        type: 'invoke',
        value: { action: 'approve', approval_id: approvalId },
        from: { name: 'Attacker' },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('Missing signature headers');
  });

  it('rejects callback with expired timestamp', async () => {
    await createApprovalPolicy();
    await enableTeamsIntegration();
    const approvalId = await evaluateForApproval();

    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
    const body = { type: 'invoke', value: { action: 'approve', approval_id: approvalId }, from: { name: 'Attacker' } };
    const rawBody = JSON.stringify(body);
    const sig = createHmac('sha256', TEAMS_BOT_SECRET).update(`${oldTimestamp}:${rawBody}`).digest('hex');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/teams/callback',
      headers: {
        'content-type': 'application/json',
        'x-teams-timestamp': oldTimestamp,
        'x-teams-signature': sig,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('Request too old');
  });

  it('returns 404 for non-existent approval', async () => {
    await enableTeamsIntegration();

    const teamsReq = makeTeamsCallbackPayload('approve', 'non-existent-id');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/teams/callback',
      headers: teamsReq.headers,
      payload: teamsReq.body,
    });

    expect(response.statusCode).toBe(404);
  });

  it('sends test notification via webhook', async () => {
    await enableTeamsIntegration();
    fetchMock.mockClear();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/integrations/teams/test',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);

    const teamsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string) === 'https://teams.test.webhook/incoming',
    );
    expect(teamsCalls.length).toBe(1);

    // Verify it's a test card (no Action.Submit buttons)
    const card = JSON.parse((teamsCalls[0]![1] as RequestInit).body as string).attachments[0].content;
    const submitActions = (card.actions ?? []).filter((a: Record<string, unknown>) => a.type === 'Action.Submit');
    expect(submitActions.length).toBe(0);
  });

  it('test notification returns 400 when not enabled', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/integrations/teams/test',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it('skips Teams notification when not configured', async () => {
    // Don't enable Teams
    await createApprovalPolicy();
    fetchMock.mockClear();

    await evaluateForApproval();
    await new Promise(r => setTimeout(r, 100));

    const teamsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes('teams.test.webhook'),
    );
    expect(teamsCalls.length).toBe(0);
  });

  it('PATCH settings saves Teams config', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/integrations',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        teams: {
          enabled: true,
          webhook_url: 'https://teams.webhook.test/123',
          bot_id: 'my-bot-id',
          bot_secret: 'my-bot-secret',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.teams.enabled).toBe(true);
    expect(data.teams.bot_id).toBe('my-bot-id');
    expect(data.teams.bot_secret).toBe('****'); // masked
  });

  it('GET settings returns masked Teams tokens', async () => {
    await enableTeamsIntegration();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/integrations',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.teams.enabled).toBe(true);
    expect(data.teams.webhook_url).toContain('****');
    expect(data.teams.bot_secret).toBe('****');
  });

  it('handles API errors gracefully (does not throw)', async () => {
    await enableTeamsIntegration();
    await createApprovalPolicy();

    // Make Teams webhook fail
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://teams.test.webhook/incoming') {
        return { ok: false, status: 500, text: async () => 'Internal Server Error' };
      }
      return { ok: true, status: 200, text: async () => '{"ok":true}', json: async () => ({ ok: true }) };
    });

    // Evaluate should still succeed
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().decision).toBe('approval_required');
  });
});

// ── Notification Dispatch Tests ──────────────────────────────────────────────

describe('Notification dispatch', () => {
  it('sends to all enabled channels', async () => {
    // Enable all three
    const settings = testData.tenant.settings as Record<string, unknown>;
    await prisma.tenant.update({
      where: { id: testData.tenant.id },
      data: {
        settings: {
          ...settings,
          notifications_enabled: true,
          integrations: {
            slack: { enabled: true, bot_token: 'xoxb-test', channel_id: 'C123' },
            telegram: { enabled: true, bot_token: 'tg-token', chat_id: '-100' },
            teams: { enabled: true, webhook_url: 'https://teams.test.webhook/incoming', bot_id: 'bot-id', bot_secret: 'bot-secret' },
          },
        },
      },
    });

    await createApprovalPolicy();
    fetchMock.mockClear();

    await evaluateForApproval();
    await new Promise(r => setTimeout(r, 150));

    const slackCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes('slack.com'),
    );
    const telegramCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes('api.telegram.org'),
    );
    const teamsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes('teams.test.webhook'),
    );

    expect(slackCalls.length).toBeGreaterThanOrEqual(1);
    expect(telegramCalls.length).toBeGreaterThanOrEqual(1);
    expect(teamsCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('skips disabled channels', async () => {
    const settings = testData.tenant.settings as Record<string, unknown>;
    await prisma.tenant.update({
      where: { id: testData.tenant.id },
      data: {
        settings: {
          ...settings,
          integrations: {
            slack: { enabled: false, bot_token: 'xoxb-test', channel_id: 'C123' },
            telegram: { enabled: false, bot_token: 'tg-token', chat_id: '-100' },
            teams: { enabled: false, webhook_url: 'https://teams.test/incoming' },
          },
        },
      },
    });

    await createApprovalPolicy();
    fetchMock.mockClear();

    await evaluateForApproval();
    await new Promise(r => setTimeout(r, 100));

    // No external API calls to chat platforms
    const chatCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => {
        const url = call[0] as string;
        return url.includes('slack.com') || url.includes('api.telegram.org') || url.includes('teams.test');
      },
    );
    expect(chatCalls.length).toBe(0);
  });

  it('channel failure does not affect evaluate response', async () => {
    // Enable Slack but make it fail
    fetchMock.mockRejectedValue(new Error('Network error'));

    const settings = testData.tenant.settings as Record<string, unknown>;
    await prisma.tenant.update({
      where: { id: testData.tenant.id },
      data: {
        settings: {
          ...settings,
          integrations: {
            slack: { enabled: true, bot_token: 'xoxb-test', channel_id: 'C123' },
          },
        },
      },
    });

    await createApprovalPolicy();

    // Evaluate should still succeed even if Slack fails
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().decision).toBe('approval_required');
  });
});

// ── Integration Settings API Tests ───────────────────────────────────────────

describe('Integration Settings API', () => {
  it('GET returns masked tokens', async () => {
    await enableSlackIntegration();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/integrations',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.slack.enabled).toBe(true);
    expect(data.slack.bot_token).not.toBe('xoxb-test-token');
    expect(data.slack.bot_token).toContain('****');
    expect(data.slack.channel_id).toBe('C0123456789');
  });

  it('PATCH updates integration config', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant/integrations',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        telegram: {
          enabled: true,
          bot_token: 'test-tg-token',
          chat_id: '-100999',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.telegram.enabled).toBe(true);
  });

  it('POST test sends notification to provider', async () => {
    await enableSlackIntegration();
    fetchMock.mockClear();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/integrations/slack/test',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);

    // Verify Slack API was called
    const slackCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes('slack.com'),
    );
    expect(slackCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('POST test returns 400 for disabled provider', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/integrations/slack/test',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(400);
  });
});
