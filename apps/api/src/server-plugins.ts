import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import helmet from '@fastify/helmet';
import { errorHandlerPlugin } from './middleware/error-handler.js';
import { authPlugin } from './middleware/auth.js';
import { tenantPlugin } from './middleware/tenant.js';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agents.js';
import { policyRoutes } from './routes/policies.js';
import { approvalRoutes } from './routes/approvals.js';
import { traceRoutes } from './routes/traces.js';
import { evaluateRoutes } from './routes/evaluate.js';

export async function registerPlugins(app: FastifyInstance) {
  // Set X-Request-ID on every response (uses Fastify's built-in request.id)
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Agent Identity & Approval Layer API',
        description: 'Governance API for AI agents — identity, policy, approval, and audit',
        version: '0.1.0',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Error handler
  await app.register(errorHandlerPlugin);

  // Public routes
  await app.register(healthRoutes);

  // API v1 routes — auth and tenant middleware scoped to /api/v1
  await app.register(async (api) => {
    await api.register(authPlugin);
    await api.register(tenantPlugin);

    await api.register(agentRoutes);
    await api.register(policyRoutes);
    await api.register(approvalRoutes);
    await api.register(traceRoutes);
    await api.register(evaluateRoutes);
  }, { prefix: '/api/v1' });
}
