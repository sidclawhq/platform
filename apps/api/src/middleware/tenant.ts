import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

async function tenantPluginImpl(_app: FastifyInstance) {
  // Tenant context is set by auth middleware.
  // This plugin exists as a placeholder for tenant-scoped Prisma client (P4.2)
  // and other tenant-specific middleware that will be added later.
}

export const tenantPlugin = fp(tenantPluginImpl, { name: 'tenant-plugin' });
