import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    let dbStatus: 'healthy' | 'unreachable' = 'healthy';
    let dbLatencyMs = 0;

    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'unreachable';
    }

    const status = dbStatus === 'healthy' ? 'healthy' : 'degraded';

    return reply.status(dbStatus === 'healthy' ? 200 : 503).send({
      status,
      version: '0.1.0',
      uptime_seconds: Math.floor(process.uptime()),
      checks: {
        database: { status: dbStatus, latency_ms: dbLatencyMs },
      },
    });
  });

  // Lightweight liveness probe — confirms the process is running without
  // checking database connectivity. Used by container orchestration.
  app.get('/health/live', async (_request, reply) => {
    return reply.status(200).send({ status: 'alive' });
  });
}
