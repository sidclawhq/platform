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
import { dashboardRoutes } from './routes/dashboard.js';
import { webhookRoutes } from './routes/webhooks.js';
import { userRoutes } from './routes/users.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { tenantRoutes } from './routes/tenant.js';
import { rateLimitPlugin } from './middleware/rate-limit.js';
import { authRoutes } from './routes/auth.js';

export async function registerPlugins(app: FastifyInstance) {
  // Allow empty JSON body on POST/PATCH/PUT (e.g., /api-keys/:id/rotate)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Set X-Request-ID on every response (uses Fastify's built-in request.id)
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
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
    await api.register(authRoutes);
    await api.register(authPlugin);
    await api.register(rateLimitPlugin);
    await api.register(tenantPlugin);

    await api.register(agentRoutes);
    await api.register(policyRoutes);
    await api.register(approvalRoutes);
    await api.register(traceRoutes);
    await api.register(evaluateRoutes);
    await api.register(dashboardRoutes);
    await api.register(webhookRoutes);
    await api.register(userRoutes);
    await api.register(apiKeyRoutes);
    await api.register(tenantRoutes);
  }, { prefix: '/api/v1' });
}
