/**
 * E2E tests for Microsoft Teams governance integration.
 *
 * Tests the full flow: agent evaluates action -> approval_required ->
 * Teams notification sent -> callback approves/denies -> audit trace complete.
 *
 * Uses a mock Teams server to capture webhook calls and the real SidClaw API (test DB).
 *
 * Prerequisites:
 *   1. Start test database: docker compose -f docker-compose.test.yml up -d
 *   2. Start API server against test database:
 *      DATABASE_URL=postgresql://agent_identity:agent_identity@localhost:5433/agent_identity_test npm run dev
 *      (from apps/api/)
 *   3. Run tests: npx vitest run --config tests/e2e/vitest.config.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { setupE2E, teardownE2E, createSDKClient, prisma } from './helpers';
import { createMockTeamsServer } from './teams-mock-server';

const TEST_API_URL = process.env.TEST_API_URL ?? 'http://localhost:4000';

let testData: Awaited<ReturnType<typeof setupE2E>>;
let mockTeamsUrl: string;
let mockServer: ReturnType<typeof createMockTeamsServer>;

describe('Teams Governance E2E', () => {
  beforeAll(async () => {
    testData = await setupE2E();

    // Start mock Teams server
    mockServer = createMockTeamsServer();
    const address = await mockServer.app.listen({ port: 0 });
    mockTeamsUrl = address;

    // Enable Teams integration pointing at mock server
    await prisma.tenant.update({
      where: { id: testData.tenant.id },
      data: {
        settings: {
          ...(testData.tenant.settings as Record<string, unknown>),
          integrations: {
            teams: {
              enabled: true,
              webhook_url: `${mockTeamsUrl}/webhook/incoming`,
              bot_id: 'test-bot-id',
              bot_secret: 'test-bot-secret',
            },
          },
        },
      },
    });
  }, 30000);

  afterAll(async () => {
    await mockServer.app.close();
    await teardownE2E();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  it('full approval flow: evaluate -> Teams notification -> approve via callback -> trace complete', async () => {
    const client = createSDKClient(testData.rawApiKey, testData.commsAgent.id);

    // 1. Evaluate an action that triggers approval_required
    const result = await client.evaluate({
      operation: 'send',
      target_integration: 'communications_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
    });

    expect(result.decision).toBe('approval_required');
    expect(result.approval_request_id).toBeDefined();

    // 2. Wait for the async Teams notification to be dispatched
    await new Promise(r => setTimeout(r, 500));

    // 3. Verify the mock Teams server received the notification
    expect(mockServer.messages.length).toBeGreaterThanOrEqual(1);
    const message = mockServer.messages[0]!;
    expect(message.type).toBe('message');
    expect(message.attachments[0]!.contentType).toBe('application/vnd.microsoft.card.adaptive');

    const card = message.attachments[0]!.content;
    expect(card.type).toBe('AdaptiveCard');

    // Verify card contains agent info
    const factSet = (card.body as Array<Record<string, unknown>>).find(b => b.type === 'FactSet') as Record<string, unknown> | undefined;
    expect(factSet).toBeDefined();
    const facts = factSet!.facts as Array<{ title: string; value: string }>;
    expect(facts[0]!.value).toBe('Customer Communications Agent');

    // 4. Simulate Teams callback (approve)
    const approvalId = result.approval_request_id!;
    const callbackBody = {
      type: 'invoke',
      value: { action: 'approve', approval_id: approvalId },
      from: { id: 'teams-user', name: 'E2E Teams Reviewer' },
      serviceUrl: mockTeamsUrl,
      conversation: { id: 'conv-e2e' },
      replyToId: 'activity-e2e',
    };

    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(callbackBody);
    const signature = createHmac('sha256', 'test-bot-secret').update(`${timestamp}:${rawBody}`).digest('hex');

    const callbackResponse = await fetch(`${TEST_API_URL}/api/v1/integrations/teams/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teams-timestamp': timestamp,
        'x-teams-signature': signature,
      },
      body: rawBody,
    });

    expect(callbackResponse.status).toBe(200);

    // 5. Verify the approval was processed
    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
    });
    expect(approval?.status).toBe('approved');
    expect(approval?.approver_name).toBe('E2E Teams Reviewer');
    expect(approval?.decision_note).toBe('Approved via Microsoft Teams');

    // 6. Verify the audit trace is complete
    const trace = await prisma.auditTrace.findFirst({
      where: { approval_request_id: approvalId },
    });
    expect(trace).toBeDefined();
    expect(trace?.final_decision).toBe('approved');
  });

  it('deny flow: evaluate -> Teams notification -> deny via callback', async () => {
    const client = createSDKClient(testData.rawApiKey, testData.caseAgent.id);

    const result = await client.evaluate({
      operation: 'close',
      target_integration: 'case_management_system',
      resource_scope: 'high_impact_cases',
      data_classification: 'confidential',
    });

    expect(result.decision).toBe('approval_required');
    const approvalId = result.approval_request_id!;

    // Simulate Teams deny callback
    const callbackBody = {
      type: 'invoke',
      value: { action: 'deny', approval_id: approvalId },
      from: { id: 'teams-user', name: 'E2E Teams Denier' },
      serviceUrl: mockTeamsUrl,
      conversation: { id: 'conv-e2e-deny' },
      replyToId: 'activity-e2e-deny',
    };

    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(callbackBody);
    const signature = createHmac('sha256', 'test-bot-secret').update(`${timestamp}:${rawBody}`).digest('hex');

    const callbackResponse = await fetch(`${TEST_API_URL}/api/v1/integrations/teams/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teams-timestamp': timestamp,
        'x-teams-signature': signature,
      },
      body: rawBody,
    });

    expect(callbackResponse.status).toBe(200);

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
    });
    expect(approval?.status).toBe('denied');
    expect(approval?.approver_name).toBe('E2E Teams Denier');
    expect(approval?.decision_note).toBe('Denied via Microsoft Teams');
  });
});
