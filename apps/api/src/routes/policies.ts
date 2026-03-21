import { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../generated/prisma/index.js';
import {
  PolicyRuleCreateSchema,
  PolicyRuleUpdateSchema,
} from '@sidclaw/shared';
import { ValidationError } from '../errors.js';
import { PolicyService } from '../services/policy-service.js';
import { requireRole } from '../middleware/require-role.js';
import { checkPlanLimit } from '../middleware/plan-limits.js';
import { prisma } from '../db/client.js';

export async function policyRoutes(app: FastifyInstance) {
  // POST /api/v1/policies — create policy rule (admin only)
  app.post('/policies', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const body = PolicyRuleCreateSchema.parse(request.body);
    const policyCount = await prisma.policyRule.count({
      where: { tenant_id: request.tenantId!, agent_id: body.agent_id },
    });
    await checkPlanLimit(prisma, request.tenantId!, 'max_policies_per_agent', policyCount);
    const policyService = new PolicyService(request.tenantPrisma! as unknown as PrismaClient);
    const policy = await policyService.create(body);
    return reply.status(201).send({ data: policy });
  });

  // GET /api/v1/policies — list policy rules with filters
  app.get('/policies', async (request, reply) => {
    const query = request.query as {
      agent_id?: string;
      effect?: string;
      data_classification?: string;
      is_active?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const policyService = new PolicyService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await policyService.list({
      agent_id: query.agent_id,
      effect: query.effect,
      data_classification: query.data_classification,
      is_active: query.is_active !== undefined ? query.is_active === 'true' : undefined,
      search: query.search,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return reply.status(200).send(result);
  });

  // GET /api/v1/policies/:id — policy rule detail
  app.get('/policies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const policyService = new PolicyService(request.tenantPrisma! as unknown as PrismaClient);
    const policy = await policyService.getById(id);
    return reply.status(200).send({ data: policy });
  });

  // PATCH /api/v1/policies/:id — update policy rule (admin only)
  app.patch('/policies/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = PolicyRuleUpdateSchema.parse(request.body);

    if (Object.keys(body).length === 0) {
      throw new ValidationError('At least one field must be provided for update');
    }

    // TODO(P3.4): Use authenticated user name
    const modifiedBy = 'Dashboard User';
    const policyService = new PolicyService(request.tenantPrisma! as unknown as PrismaClient);
    const updated = await policyService.update(id, body, modifiedBy);
    return reply.status(200).send({ data: updated });
  });

  // DELETE /api/v1/policies/:id — soft-delete (deactivate) policy rule (admin only)
  app.delete('/policies/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // TODO(P3.4): Use authenticated user name
    const modifiedBy = 'Dashboard User';
    const policyService = new PolicyService(request.tenantPrisma! as unknown as PrismaClient);
    const policy = await policyService.softDelete(id, modifiedBy);
    return reply.status(200).send({ data: policy });
  });

  // GET /api/v1/policies/:id/versions — policy version history
  app.get('/policies/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; offset?: string };

    const policyService = new PolicyService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await policyService.getVersions(
      id,
      query.limit ? parseInt(query.limit, 10) : undefined,
      query.offset ? parseInt(query.offset, 10) : undefined,
    );

    return reply.status(200).send(result);
  });

  // POST /api/v1/policies/test — dry-run policy evaluation
  app.post('/policies/test', async (request, reply) => {
    const body = request.body as {
      agent_id: string;
      operation: string;
      target_integration: string;
      resource_scope: string;
      data_classification: string;
    };

    if (!body.agent_id || !body.operation || !body.target_integration || !body.resource_scope || !body.data_classification) {
      throw new ValidationError('All fields required: agent_id, operation, target_integration, resource_scope, data_classification');
    }

    const policyService = new PolicyService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await policyService.testEvaluate(body);
    return reply.status(200).send(result);
  });
}
