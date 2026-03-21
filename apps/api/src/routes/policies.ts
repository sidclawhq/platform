import { FastifyInstance } from 'fastify';
import {
  PolicyRuleCreateSchema,
  PolicyRuleUpdateSchema,
} from '@agent-identity/shared';
import { prisma } from '../db/client.js';
import { ValidationError } from '../errors.js';
import { PolicyService } from '../services/policy-service.js';

export async function policyRoutes(app: FastifyInstance) {
  const policyService = new PolicyService(prisma);

  // POST /api/v1/policies — create policy rule
  app.post('/policies', async (request, reply) => {
    const tenantId = request.tenantId!;
    const body = PolicyRuleCreateSchema.parse(request.body);
    const policy = await policyService.create(tenantId, body);
    return reply.status(201).send({ data: policy });
  });

  // GET /api/v1/policies — list policy rules with filters
  app.get('/policies', async (request, reply) => {
    const tenantId = request.tenantId!;
    const query = request.query as {
      agent_id?: string;
      effect?: string;
      data_classification?: string;
      is_active?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const result = await policyService.list(tenantId, {
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
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };
    const policy = await policyService.getById(tenantId, id);
    return reply.status(200).send({ data: policy });
  });

  // PATCH /api/v1/policies/:id — update policy rule
  app.patch('/policies/:id', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };
    const body = PolicyRuleUpdateSchema.parse(request.body);

    if (Object.keys(body).length === 0) {
      throw new ValidationError('At least one field must be provided for update');
    }

    // TODO(P3.4): Use authenticated user name
    const modifiedBy = 'Dashboard User';
    const updated = await policyService.update(tenantId, id, body, modifiedBy);
    return reply.status(200).send({ data: updated });
  });

  // DELETE /api/v1/policies/:id — soft-delete (deactivate) policy rule
  app.delete('/policies/:id', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    // TODO(P3.4): Use authenticated user name
    const modifiedBy = 'Dashboard User';
    const policy = await policyService.softDelete(tenantId, id, modifiedBy);
    return reply.status(200).send({ data: policy });
  });

  // GET /api/v1/policies/:id/versions — policy version history
  app.get('/policies/:id/versions', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; offset?: string };

    const result = await policyService.getVersions(
      tenantId,
      id,
      query.limit ? parseInt(query.limit, 10) : undefined,
      query.offset ? parseInt(query.offset, 10) : undefined,
    );

    return reply.status(200).send(result);
  });

  // POST /api/v1/policies/test — dry-run policy evaluation
  app.post('/policies/test', async (request, reply) => {
    const tenantId = request.tenantId!;
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

    const result = await policyService.testEvaluate(tenantId, body);
    return reply.status(200).send(result);
  });
}
