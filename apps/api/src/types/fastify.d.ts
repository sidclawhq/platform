import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    userId?: string;
    userRole?: string;
  }
}
