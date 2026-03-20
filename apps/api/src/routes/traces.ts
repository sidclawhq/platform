import { FastifyInstance } from 'fastify';

export async function traceRoutes(app: FastifyInstance) {
  // GET /api/v1/traces — list audit traces (P1.6)
  app.get('/traces', async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }));

  // GET /api/v1/traces/:id — trace detail with events (P1.6)
  app.get('/traces/:id', async () => ({ data: null }));

  // GET /api/v1/traces/:id/events — trace events timeline (P1.6)
  app.get('/traces/:id/events', async () => ({ data: [] }));
}
