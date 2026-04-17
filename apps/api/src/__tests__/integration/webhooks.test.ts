import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { WebhookService } from '../../services/webhook-service.js';
import { verifyWebhookSignature } from '@sidclaw/sdk';

let app: FastifyInstance;
let prisma: PrismaClient;
let testData: Awaited<ReturnType<typeof seedTestData>>;

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
});

// Helper to create a simple HTTP server that captures webhooks
function createWebhookReceiver(
  statusCode = 200,
): { server: Server; received: Array<{ headers: IncomingMessage['headers']; body: string }>; url: () => string; close: () => Promise<void> } {
  const received: Array<{ headers: IncomingMessage['headers']; body: string }> = [];

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  server.listen(0, '127.0.0.1');

  return {
    server,
    received,
    url: () => {
      const addr = server.address() as AddressInfo;
      return `http://localhost:${addr.port}`;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('Webhook CRUD', () => {
  it('creates endpoint and returns secret exactly once', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://localhost:9999/hook',
        events: ['approval.requested'],
        description: 'Test hook',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.url).toBe('http://localhost:9999/hook');
    expect(body.data.events).toEqual(['approval.requested']);
    expect(body.data.secret).toBeDefined();
    expect(body.data.secret).toHaveLength(64); // 32 bytes hex
    expect(body.data.is_active).toBe(true);
    expect(body.data.description).toBe('Test hook');
  });

  it('list excludes secret', async () => {
    // Create a webhook first
    await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://localhost:9999/hook',
        events: ['approval.requested'],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].secret).toBeUndefined();
    expect(body.data[0].url).toBe('http://localhost:9999/hook');
  });

  it('get excludes secret', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://localhost:9999/hook',
        events: ['approval.requested'],
      },
    });
    const webhookId = createRes.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.secret).toBeUndefined();
  });

  it('updates url and events', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://localhost:9999/hook',
        events: ['approval.requested'],
      },
    });
    const webhookId = createRes.json().data.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/webhooks/${webhookId}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://localhost:8888/updated',
        events: ['approval.approved', 'approval.denied'],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.url).toBe('http://localhost:8888/updated');
    expect(body.data.events).toEqual(['approval.approved', 'approval.denied']);
  });

  it('deletes endpoint and deliveries', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://localhost:9999/hook',
        events: ['approval.requested'],
      },
    });
    const webhookId = createRes.json().data.id;

    // Create a delivery record
    await prisma.webhookDelivery.create({
      data: {
        endpoint_id: webhookId,
        event_type: 'approval.requested',
        payload: { test: true },
        status: 'pending',
      },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/webhooks/${webhookId}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(204);

    // Verify both endpoint and delivery are gone
    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: webhookId } });
    expect(endpoint).toBeNull();
    const deliveries = await prisma.webhookDelivery.findMany({ where: { endpoint_id: webhookId } });
    expect(deliveries).toHaveLength(0);
  });

  it('validates URL starts with https (or http://localhost in dev)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://example.com/hook',
        events: ['approval.requested'],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('validates event types', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://localhost:9999/hook',
        events: ['invalid.event'],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Webhook Delivery', () => {
  it('dispatches event to matching endpoints', async () => {
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        tenant_id: testData.tenant.id,
        url: 'http://localhost:9999/hook',
        secret: 'test-secret',
        events: ['approval.requested'],
        is_active: true,
      },
    });

    const webhookService = new WebhookService(prisma);
    await webhookService.dispatch(testData.tenant.id, 'approval.requested', { test: true });

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpoint_id: endpoint.id },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].event_type).toBe('approval.requested');
    expect(deliveries[0].status).toBe('pending');
  });

  it('does not dispatch to inactive endpoints', async () => {
    await prisma.webhookEndpoint.create({
      data: {
        tenant_id: testData.tenant.id,
        url: 'http://localhost:9999/hook',
        secret: 'test-secret',
        events: ['approval.requested'],
        is_active: false,
      },
    });

    const webhookService = new WebhookService(prisma);
    await webhookService.dispatch(testData.tenant.id, 'approval.requested', { test: true });

    const deliveries = await prisma.webhookDelivery.findMany();
    expect(deliveries).toHaveLength(0);
  });

  it('does not dispatch to endpoints not subscribed to this event', async () => {
    await prisma.webhookEndpoint.create({
      data: {
        tenant_id: testData.tenant.id,
        url: 'http://localhost:9999/hook',
        secret: 'test-secret',
        events: ['approval.approved'],
        is_active: true,
      },
    });

    const webhookService = new WebhookService(prisma);
    await webhookService.dispatch(testData.tenant.id, 'approval.requested', { test: true });

    const deliveries = await prisma.webhookDelivery.findMany();
    expect(deliveries).toHaveLength(0);
  });

  it('delivery includes HMAC signature', async () => {
    const receiver = createWebhookReceiver();
    // Wait for server to be ready
    await new Promise<void>((resolve) => receiver.server.on('listening', resolve));

    try {
      const endpoint = await prisma.webhookEndpoint.create({
        data: {
          tenant_id: testData.tenant.id,
          url: receiver.url() + '/hook',
          secret: 'my-webhook-secret',
          events: ['approval.requested'],
          is_active: true,
        },
      });

      // Create a delivery manually
      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpoint_id: endpoint.id,
          event_type: 'approval.requested',
          payload: { id: 'test-123', event: 'approval.requested', data: {} },
          status: 'pending',
        },
      });

      const webhookService = new WebhookService(prisma);
      await webhookService.deliver(delivery.id);

      expect(receiver.received).toHaveLength(1);
      expect(receiver.received[0].headers['x-webhook-signature']).toBeDefined();
      expect(receiver.received[0].headers['x-webhook-signature']).toMatch(/^sha256=/);
      expect(receiver.received[0].headers['x-webhook-id']).toBe(delivery.id);
    } finally {
      await receiver.close();
    }
  });

  it('SDK verifyWebhookSignature validates the signature', async () => {
    const receiver = createWebhookReceiver();
    await new Promise<void>((resolve) => receiver.server.on('listening', resolve));

    try {
      const secret = 'verify-test-secret';
      const endpoint = await prisma.webhookEndpoint.create({
        data: {
          tenant_id: testData.tenant.id,
          url: receiver.url() + '/hook',
          secret,
          events: ['approval.requested'],
          is_active: true,
        },
      });

      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpoint_id: endpoint.id,
          event_type: 'approval.requested',
          payload: { id: 'sig-test', event: 'approval.requested', data: { foo: 'bar' } },
          status: 'pending',
        },
      });

      const webhookService = new WebhookService(prisma);
      await webhookService.deliver(delivery.id);

      expect(receiver.received).toHaveLength(1);
      const receivedBody = receiver.received[0].body;
      const receivedSignature = receiver.received[0].headers['x-webhook-signature'] as string;

      expect(verifyWebhookSignature(receivedBody, receivedSignature, secret)).toBe(true);
    } finally {
      await receiver.close();
    }
  });

  it('SDK verifyWebhookSignature rejects tampered payloads', async () => {
    const receiver = createWebhookReceiver();
    await new Promise<void>((resolve) => receiver.server.on('listening', resolve));

    try {
      const secret = 'tamper-test-secret';
      const endpoint = await prisma.webhookEndpoint.create({
        data: {
          tenant_id: testData.tenant.id,
          url: receiver.url() + '/hook',
          secret,
          events: ['approval.requested'],
          is_active: true,
        },
      });

      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpoint_id: endpoint.id,
          event_type: 'approval.requested',
          payload: { id: 'tamper-test', event: 'approval.requested', data: {} },
          status: 'pending',
        },
      });

      const webhookService = new WebhookService(prisma);
      await webhookService.deliver(delivery.id);

      const receivedSignature = receiver.received[0].headers['x-webhook-signature'] as string;
      const tamperedBody = '{"tampered": true}';

      expect(verifyWebhookSignature(tamperedBody, receivedSignature, secret)).toBe(false);
      expect(verifyWebhookSignature(receiver.received[0].body, receivedSignature, 'wrong-secret')).toBe(false);
      expect(verifyWebhookSignature(receiver.received[0].body, 'invalid-signature', secret)).toBe(false);
    } finally {
      await receiver.close();
    }
  });

  it('failed delivery schedules retry', async () => {
    const receiver = createWebhookReceiver(500);
    await new Promise<void>((resolve) => receiver.server.on('listening', resolve));

    try {
      const endpoint = await prisma.webhookEndpoint.create({
        data: {
          tenant_id: testData.tenant.id,
          url: receiver.url() + '/hook',
          secret: 'retry-secret',
          events: ['approval.requested'],
          is_active: true,
        },
      });

      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpoint_id: endpoint.id,
          event_type: 'approval.requested',
          payload: { id: 'retry-test', event: 'approval.requested', data: {} },
          status: 'pending',
        },
      });

      const webhookService = new WebhookService(prisma);
      await webhookService.deliver(delivery.id);

      const updated = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
      expect(updated!.status).toBe('retrying');
      expect(updated!.attempts).toBe(1);
      expect(updated!.next_retry_at).toBeDefined();
      expect(updated!.http_status).toBe(500);
    } finally {
      await receiver.close();
    }
  });

  it('delivery marked as failed on 302 redirect (SSRF pivot blocked)', async () => {
    // Server that always responds with 302 → attacker could use this to pivot to private.
    const redirectServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
    });
    redirectServer.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => redirectServer.on('listening', resolve));

    try {
      const addr = redirectServer.address() as AddressInfo;
      const endpoint = await prisma.webhookEndpoint.create({
        data: {
          tenant_id: testData.tenant.id,
          url: `http://localhost:${addr.port}/hook`,
          secret: 'redirect-secret',
          events: ['approval.requested'],
          is_active: true,
        },
      });

      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpoint_id: endpoint.id,
          event_type: 'approval.requested',
          payload: { id: 'redir-test', event: 'approval.requested', data: {} },
          status: 'pending',
        },
      });

      const webhookService = new WebhookService(prisma);
      await webhookService.deliver(delivery.id);

      const updated = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
      // safeFetch raises UrlSafetyError(redirect_blocked) — treated as permanent failure.
      expect(updated!.status).toBe('failed');
      expect(updated!.response_body ?? '').toContain('redirect_blocked');
    } finally {
      await new Promise<void>((resolve) => redirectServer.close(() => resolve()));
    }
  });

  it('POST /webhooks/:id/test rejects redirects (SSRF pivot blocked)', async () => {
    const redirectServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(301, { Location: 'http://169.254.169.254/' });
      res.end();
    });
    redirectServer.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => redirectServer.on('listening', resolve));

    try {
      const addr = redirectServer.address() as AddressInfo;
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          url: `http://localhost:${addr.port}/hook`,
          events: ['approval.requested'],
        },
      });
      const webhookId = createRes.json().data.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/webhooks/${webhookId}/test`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.delivered).toBe(false);
      expect(body.error ?? '').toMatch(/redirect_blocked|SSRF/);
    } finally {
      await new Promise<void>((resolve) => redirectServer.close(() => resolve()));
    }
  });

  it('POST /webhooks/:id/test blocks when URL now resolves to metadata IP', async () => {
    // Create a webhook with a normal localhost URL (passes creation check).
    const receiver = createWebhookReceiver();
    await new Promise<void>((resolve) => receiver.server.on('listening', resolve));
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          url: receiver.url() + '/hook',
          events: ['approval.requested'],
        },
      });
      const webhookId = createRes.json().data.id;

      // Manually tamper the stored URL to a metadata endpoint — simulates
      // URL drift / DB-level tampering. The /test endpoint must re-validate.
      await prisma.webhookEndpoint.update({
        where: { id: webhookId },
        data: { url: 'http://169.254.169.254/latest/meta-data/' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/webhooks/${webhookId}/test`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.delivered).toBe(false);
      expect(body.error ?? '').toMatch(/SSRF|private_literal_ip|http_forbidden/);
    } finally {
      await receiver.close();
    }
  });

  it('after 5 failures, delivery marked as failed', async () => {
    const receiver = createWebhookReceiver(500);
    await new Promise<void>((resolve) => receiver.server.on('listening', resolve));

    try {
      const endpoint = await prisma.webhookEndpoint.create({
        data: {
          tenant_id: testData.tenant.id,
          url: receiver.url() + '/hook',
          secret: 'fail-secret',
          events: ['approval.requested'],
          is_active: true,
        },
      });

      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpoint_id: endpoint.id,
          event_type: 'approval.requested',
          payload: { id: 'fail-test', event: 'approval.requested', data: {} },
          status: 'retrying',
          attempts: 4, // Already failed 4 times
        },
      });

      const webhookService = new WebhookService(prisma);
      await webhookService.deliver(delivery.id);

      const updated = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
      expect(updated!.status).toBe('failed');
      expect(updated!.attempts).toBe(5);
    } finally {
      await receiver.close();
    }
  });

  it('test endpoint delivers immediately and returns result', async () => {
    const receiver = createWebhookReceiver();
    await new Promise<void>((resolve) => receiver.server.on('listening', resolve));

    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          url: receiver.url() + '/hook',
          events: ['approval.requested'],
        },
      });
      const webhookId = createRes.json().data.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/webhooks/${webhookId}/test`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.delivered).toBe(true);
      expect(body.http_status).toBe(200);
      expect(body.response_time_ms).toBeGreaterThanOrEqual(0);

      // Verify webhook was actually received
      expect(receiver.received).toHaveLength(1);
      const payload = JSON.parse(receiver.received[0].body);
      expect(payload.event).toBe('test');
      expect(payload.data.message).toBe('Test webhook from Agent Identity');
    } finally {
      await receiver.close();
    }
  });
});

describe('Webhook Integration', () => {
  let receiver: ReturnType<typeof createWebhookReceiver>;

  beforeEach(async () => {
    receiver = createWebhookReceiver();
    await new Promise<void>((resolve) => receiver.server.on('listening', resolve));
  });

  afterAll(async () => {
    if (receiver) await receiver.close();
  });

  // Create webhook endpoints via the API to ensure they're in the same DB as routes
  async function createWebhookEndpointViaApi(events: string[]) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: receiver.url() + '/hook',
        events,
        description: 'Integration test webhook',
      },
    });
    return res.json().data;
  }

  // Create policy via test prisma (these are only read by routes, not written to webhook tables)
  async function createApprovalPolicy() {
    await prisma.policyRule.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Require approval for sends',
        target_integration: 'email_service',
        operation: 'send',
        resource_scope: '*',
        data_classification: 'confidential',
        policy_effect: 'approval_required',
        rationale: 'Sensitive operations require approval',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });
  }

  // Wait briefly for fire-and-forget dispatch to complete
  async function waitForDispatch() {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  it('approval.requested webhook fires after evaluate with approval_required', async () => {
    await createWebhookEndpointViaApi(['approval.requested']);
    await createApprovalPolicy();

    await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'send',
        target_integration: 'email_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      },
    });

    await waitForDispatch();

    // Check that a delivery record was created — query via API deliveries endpoint
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const webhookId = listRes.json().data[0].id;

    const deliveriesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}/deliveries`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const deliveries = deliveriesRes.json().data;
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].event_type).toBe('approval.requested');
    expect(deliveries[0].status).toBe('pending');
  });

  it('approval.approved webhook fires after approve', async () => {
    await createWebhookEndpointViaApi(['approval.approved']);
    await createApprovalPolicy();

    const evalRes = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'send',
        target_integration: 'email_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      },
    });
    const approvalId = evalRes.json().approval_request_id;

    // Approve it
    await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${approvalId}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        approver_name: 'Not The Owner',
        decision_note: 'Looks good',
      },
    });

    await waitForDispatch();

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const webhookId = listRes.json().data[0].id;

    const deliveriesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}/deliveries`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const deliveries = deliveriesRes.json().data;
    // May have approval.requested delivery too (from evaluate), filter to approved only
    const approvedDeliveries = deliveries.filter((d: any) => d.event_type === 'approval.approved');
    expect(approvedDeliveries).toHaveLength(1);
  });

  it('agent.suspended webhook fires after suspend', async () => {
    await createWebhookEndpointViaApi(['agent.suspended']);

    await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testData.agent.id}/suspend`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    await waitForDispatch();

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const webhookId = listRes.json().data[0].id;

    const deliveriesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}/deliveries`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const deliveries = deliveriesRes.json().data;
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].event_type).toBe('agent.suspended');
  });

  it('policy.updated webhook fires after policy update', async () => {
    await createWebhookEndpointViaApi(['policy.updated']);

    const policy = await prisma.policyRule.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Test policy',
        target_integration: 'test_service',
        operation: 'read',
        resource_scope: '*',
        data_classification: 'internal',
        policy_effect: 'allow',
        rationale: 'Test',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/policies/${policy.id}`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        rationale: 'Updated rationale',
      },
    });

    await waitForDispatch();

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const webhookId = listRes.json().data[0].id;

    const deliveriesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}/deliveries`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const deliveries = deliveriesRes.json().data;
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].event_type).toBe('policy.updated');
  });

  it('webhook dispatch failure does NOT affect primary operation result', async () => {
    // Create an endpoint with an unreachable URL via the API
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        url: 'http://localhost:1/unreachable',
        events: ['approval.requested'],
      },
    });
    const webhookId = createRes.json().data.id;

    await createApprovalPolicy();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'send',
        target_integration: 'email_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      },
    });

    // The primary operation should still succeed
    expect(response.statusCode).toBe(200);
    expect(response.json().decision).toBe('approval_required');

    await waitForDispatch();

    // Delivery record should have been created
    const deliveriesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}/deliveries`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });
    const deliveries = deliveriesRes.json().data;
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe('pending');
  });
});
