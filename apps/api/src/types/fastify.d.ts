import 'fastify';
import type { TenantPrismaClient } from '../db/tenant-client.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    tenantPlan?: string;
    userId?: string;
    userRole?: string;
    tenantPrisma?: TenantPrismaClient;
    apiKeyScopes?: string[];
  }
}
