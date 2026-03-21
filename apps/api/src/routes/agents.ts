import { FastifyInstance } from 'fastify';
import { AgentCreateSchema } from '@agent-identity/shared';
import { prisma } from '../db/client.js';
import { AgentService } from '../services/agent-service.js';

export async function agentRoutes(app: FastifyInstance) {
  const agentService = new AgentService(prisma);

  // POST /api/v1/agents — create agent
  app.post('/agents', async (request, reply) => {
    const tenantId = request.tenantId!;
    const body = AgentCreateSchema.parse(request.body);

    const agent = await agentService.create(tenantId, body);

    return reply.status(201).send({ data: agent });
  });

  // GET /api/v1/agents — list agents with filters and pagination
  app.get('/agents', async (request, reply) => {
    const tenantId = request.tenantId!;
    const query = request.query as {
      environment?: string;
      lifecycle_state?: string;
      authority_model?: string;
      autonomy_tier?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const result = await agentService.list(tenantId, {
      environment: query.environment,
      lifecycle_state: query.lifecycle_state,
      authority_model: query.authority_model,
      autonomy_tier: query.autonomy_tier,
      search: query.search,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return reply.status(200).send(result);
  });

  // GET /api/v1/agents/:id — agent detail with stats
  app.get('/agents/:id', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const result = await agentService.getDetail(tenantId, id);

    return reply.status(200).send(result);
  });

  // PATCH /api/v1/agents/:id — update agent metadata
  app.patch('/agents/:id', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const agent = await agentService.update(tenantId, id, body);

    return reply.status(200).send({ data: agent });
  });

  // POST /api/v1/agents/:id/suspend — suspend agent
  app.post('/agents/:id/suspend', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const result = await agentService.changeLifecycle(tenantId, id, 'suspended', 'suspend');

    return reply.status(200).send(result);
  });

  // POST /api/v1/agents/:id/revoke — revoke agent
  app.post('/agents/:id/revoke', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const result = await agentService.changeLifecycle(tenantId, id, 'revoked', 'revoke');

    return reply.status(200).send(result);
  });

  // POST /api/v1/agents/:id/reactivate — reactivate agent
  app.post('/agents/:id/reactivate', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const result = await agentService.changeLifecycle(tenantId, id, 'active', 'reactivate');

    return reply.status(200).send(result);
  });
}
