import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/client.js';
import { createTenantClient } from '../db/tenant-client.js';

async function tenantPluginImpl(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Only create tenant-scoped client if tenantId was set by auth middleware
    if (request.tenantId) {
      request.tenantPrisma = createTenantClient(prisma, request.tenantId);
    }
  });
}

export const tenantPlugin = fp(tenantPluginImpl, {
  name: 'tenant-plugin',
  dependencies: ['auth-plugin'],
});
