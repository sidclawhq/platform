import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiKeyService, VALID_SCOPES } from '../services/api-key-service.js';
import { requireRole } from '../middleware/require-role.js';
import { prisma } from '../db/client.js';
import { ValidationError } from '../errors.js';
import { checkPlanLimit } from '../middleware/plan-limits.js';

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['evaluate', 'traces:read', 'traces:write', 'agents:read', 'approvals:read', 'admin'])).min(1),
  expires_at: z.string().datetime().optional(),
});

export async function apiKeyRoutes(app: FastifyInstance) {
  const service = new ApiKeyService(prisma);

  // POST /api/v1/api-keys — create key (admin only)
  app.post('/api-keys', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const parsed = CreateApiKeySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request body', { issues: parsed.error.issues });
    }

    const currentCount = await prisma.apiKey.count({ where: { tenant_id: request.tenantId! } });
    await checkPlanLimit(prisma, request.tenantId!, 'max_api_keys', currentCount);

    const result = await service.create(request.tenantId!, parsed.data);

    return reply.status(201).send({
      data: {
        id: result.id,
        name: result.name,
        key: result.key,
        key_prefix: result.key_prefix,
        scopes: result.scopes,
        expires_at: result.expires_at,
        created_at: result.created_at,
      },
    });
  });

  // GET /api/v1/api-keys — list keys (admin only)
  app.get('/api-keys', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const keys = await service.list(request.tenantId!);
    return reply.status(200).send({ data: keys });
  });

  // DELETE /api/v1/api-keys/:id — delete key (admin only)
  app.delete('/api-keys/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.delete(request.tenantId!, id);
    return reply.status(204).send();
  });

  // POST /api/v1/api-keys/:id/rotate — rotate key (admin only)
  app.post('/api-keys/:id/rotate', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await service.rotate(request.tenantId!, id);

    return reply.status(200).send({
      data: {
        id: result.id,
        name: result.name,
        key: result.key,
        key_prefix: result.key_prefix,
        scopes: result.scopes,
      },
    });
  });
}
