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

// ── Notification Dispatch Tests ──────────────────────────────────────────────

describe('Notification dispatch', () => {
  it('sends to all enabled channels', async () => {
    // Enable both
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

    expect(slackCalls.length).toBeGreaterThanOrEqual(1);
    expect(telegramCalls.length).toBeGreaterThanOrEqual(1);
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
        return url.includes('slack.com') || url.includes('api.telegram.org');
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
