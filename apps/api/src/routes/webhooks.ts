import { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../generated/prisma/index.js';
import { z } from 'zod';
import { randomBytes, createHmac } from 'node:crypto';
import { NotFoundError, ValidationError } from '../errors.js';
import { VALID_WEBHOOK_EVENT_TYPES } from '../services/webhook-service.js';
import { assertUrlIsSafe, safeFetch, UrlSafetyError } from '../lib/url-safety.js';
import { requireRole } from '../middleware/require-role.js';
import { checkPlanLimit } from '../middleware/plan-limits.js';
import { prisma } from '../db/client.js';

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  description: z.string().optional(),
});

const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  is_active: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

async function validateUrl(url: string): Promise<void> {
  try {
    await assertUrlIsSafe(url, { allowHttpInDev: true });
  } catch (e) {
    const message = e instanceof UrlSafetyError ? e.message : 'Invalid webhook URL';
    throw new ValidationError(message);
  }
}

function validateEvents(events: string[]): void {
  const invalid = events.filter(e => !VALID_WEBHOOK_EVENT_TYPES.includes(e as any));
  if (invalid.length > 0) {
    throw new ValidationError(`Invalid event types: ${invalid.join(', ')}. Valid types: ${VALID_WEBHOOK_EVENT_TYPES.join(', ')}`);
  }
}

export async function webhookRoutes(app: FastifyInstance) {
  // All webhook CRUD — admin only
  app.addHook('preHandler', requireRole('admin'));

  // POST /api/v1/webhooks — create endpoint
  app.post('/webhooks', async (request, reply) => {
    const body = CreateWebhookSchema.parse(request.body);
    const db = request.tenantPrisma! as unknown as PrismaClient;

    await validateUrl(body.url);
    validateEvents(body.events);

    const currentCount = await prisma.webhookEndpoint.count({ where: { tenant_id: request.tenantId! } });
    await checkPlanLimit(prisma, request.tenantId!, 'max_webhook_endpoints', currentCount);

    const secret = randomBytes(32).toString('hex');

    const endpoint = await db.webhookEndpoint.create({
      data: {
        tenant_id: request.tenantId!,
        url: body.url,
        secret,
        events: body.events,
        description: body.description ?? null,
      },
    });

    return reply.status(201).send({
      data: {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        secret, // Only returned on creation
        is_active: endpoint.is_active,
        description: endpoint.description,
        created_at: endpoint.created_at.toISOString(),
      },
    });
  });

  // GET /api/v1/webhooks — list endpoints
  app.get('/webhooks', async (request, reply) => {
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const endpoints = await db.webhookEndpoint.findMany({
      orderBy: { created_at: 'desc' },
    });

    return reply.send({
      data: endpoints.map(e => ({
        id: e.id,
        url: e.url,
        events: e.events,
        is_active: e.is_active,
        description: e.description,
        created_at: e.created_at.toISOString(),
      })),
    });
  });

  // GET /api/v1/webhooks/:id — single endpoint (without secret)
  app.get('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const endpoint = await db.webhookEndpoint.findFirst({
      where: { id },
    });

    if (!endpoint) throw new NotFoundError('WebhookEndpoint', id);

    return reply.send({
      data: {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        is_active: endpoint.is_active,
        description: endpoint.description,
        created_at: endpoint.created_at.toISOString(),
      },
    });
  });

  // PATCH /api/v1/webhooks/:id — update endpoint
  app.patch('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateWebhookSchema.parse(request.body);
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const existing = await db.webhookEndpoint.findFirst({
      where: { id },
    });
    if (!existing) throw new NotFoundError('WebhookEndpoint', id);

    if (body.url) await validateUrl(body.url);
    if (body.events) validateEvents(body.events);

    const updated = await db.webhookEndpoint.update({
      where: { id },
      data: {
        ...(body.url !== undefined && { url: body.url }),
        ...(body.events !== undefined && { events: body.events }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
        ...(body.description !== undefined && { description: body.description }),
      },
    });

    return reply.send({
      data: {
        id: updated.id,
        url: updated.url,
        events: updated.events,
        is_active: updated.is_active,
        description: updated.description,
        created_at: updated.created_at.toISOString(),
      },
    });
  });

  // DELETE /api/v1/webhooks/:id — delete endpoint and all deliveries
  app.delete('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const existing = await db.webhookEndpoint.findFirst({
      where: { id },
    });
    if (!existing) throw new NotFoundError('WebhookEndpoint', id);

    // Cascade delete handles deliveries (onDelete: Cascade in schema)
    await db.webhookEndpoint.delete({ where: { id } });

    return reply.status(204).send();
  });

  // GET /api/v1/webhooks/:id/deliveries — delivery history
  app.get('/webhooks/:id/deliveries', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, limit = '20' } = request.query as { status?: string; limit?: string };
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const endpoint = await db.webhookEndpoint.findFirst({
      where: { id },
    });
    if (!endpoint) throw new NotFoundError('WebhookEndpoint', id);

    const where: Record<string, unknown> = { endpoint_id: id };
    if (status) where.status = status;

    const deliveries = await db.webhookDelivery.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
    });

    return reply.send({
      data: deliveries.map(d => ({
        id: d.id,
        event_type: d.event_type,
        status: d.status,
        http_status: d.http_status,
        attempts: d.attempts,
        created_at: d.created_at.toISOString(),
        delivered_at: d.delivered_at?.toISOString() ?? null,
        next_retry_at: d.next_retry_at?.toISOString() ?? null,
      })),
    });
  });

  // POST /api/v1/webhooks/:id/test — send test event
  app.post('/webhooks/:id/test', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const endpoint = await db.webhookEndpoint.findFirst({
      where: { id },
    });
    if (!endpoint) throw new NotFoundError('WebhookEndpoint', id);

    const testPayload = {
      id: crypto.randomUUID(),
      event: 'test',
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      data: { message: 'Test webhook from Agent Identity' },
    };

    const body = JSON.stringify(testPayload);
    const signature = 'sha256=' + createHmac('sha256', endpoint.secret).update(body).digest('hex');

    const startTime = Date.now();
    try {
      // SSRF guard — validate and pin-dial via safeFetch. A webhook URL that
      // passed validation at create time may still resolve to a private IP
      // now (DNS rebinding, infra drift), and safeFetch also rejects
      // 3xx-to-private redirects.
      const response = await safeFetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': crypto.randomUUID(),
          'X-Webhook-Timestamp': new Date().toISOString(),
          'X-Webhook-Signature': signature,
        },
        body,
        timeoutMs: 10_000,
        validateOptions: { allowHttpInDev: true },
      });

      const responseTimeMs = Date.now() - startTime;

      return reply.send({
        delivered: response.ok,
        http_status: response.status,
        response_time_ms: responseTimeMs,
      });
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      if (error instanceof UrlSafetyError) {
        return reply.send({
          delivered: false,
          http_status: null,
          response_time_ms: responseTimeMs,
          error: `blocked by SSRF guard: ${error.reason} — ${error.message}`,
        });
      }
      return reply.send({
        delivered: false,
        http_status: null,
        response_time_ms: responseTimeMs,
        error: String(error),
      });
    }
  });
}
