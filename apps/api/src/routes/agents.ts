import { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../generated/prisma/index.js';
import { AgentCreateSchema } from '@sidclaw/shared';
import { AgentService } from '../services/agent-service.js';
import { requireRole } from '../middleware/require-role.js';
import { checkPlanLimit } from '../middleware/plan-limits.js';
import { prisma } from '../db/client.js';

export async function agentRoutes(app: FastifyInstance) {
  // POST /api/v1/agents — create agent (admin only)
  app.post('/agents', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const body = AgentCreateSchema.parse(request.body);
    const currentCount = await prisma.agent.count({ where: { tenant_id: request.tenantId! } });
    await checkPlanLimit(prisma, request.tenantId!, 'max_agents', currentCount);
    const agentService = new AgentService(request.tenantPrisma! as unknown as PrismaClient);
    const agent = await agentService.create(body);

    return reply.status(201).send({ data: agent });
  });

  // GET /api/v1/agents — list agents with filters and pagination
  app.get('/agents', async (request, reply) => {
    const query = request.query as {
      environment?: string;
      lifecycle_state?: string;
      authority_model?: string;
      autonomy_tier?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const agentService = new AgentService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await agentService.list({
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
    const { id } = request.params as { id: string };
    const agentService = new AgentService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await agentService.getDetail(id);

    return reply.status(200).send(result);
  });

  // PATCH /api/v1/agents/:id — update agent metadata (admin only)
  app.patch('/agents/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const agentService = new AgentService(request.tenantPrisma! as unknown as PrismaClient);
    const agent = await agentService.update(id, body);

    return reply.status(200).send({ data: agent });
  });

  // POST /api/v1/agents/:id/suspend — suspend agent (admin only)
  app.post('/agents/:id/suspend', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agentService = new AgentService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await agentService.changeLifecycle(id, 'suspended', 'suspend');

    return reply.status(200).send(result);
  });

  // POST /api/v1/agents/:id/revoke — revoke agent (admin only)
  app.post('/agents/:id/revoke', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agentService = new AgentService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await agentService.changeLifecycle(id, 'revoked', 'revoke');

    return reply.status(200).send(result);
  });

  // POST /api/v1/agents/:id/reactivate — reactivate agent (admin only)
  app.post('/agents/:id/reactivate', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agentService = new AgentService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await agentService.changeLifecycle(id, 'active', 'reactivate');

    return reply.status(200).send(result);
  });
}
