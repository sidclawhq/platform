import { FastifyInstance } from 'fastify';

export async function agentRoutes(app: FastifyInstance) {
  // GET /api/v1/agents — list agents (P2.1)
  app.get('/agents', async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }));

  // GET /api/v1/agents/:id — agent detail (P2.1)
  app.get('/agents/:id', async () => ({ data: null }));

  // POST /api/v1/agents — create agent (P2.1)
  // PATCH /api/v1/agents/:id — update agent (P2.1)
  // POST /api/v1/agents/:id/suspend — suspend agent (P2.1)
  // POST /api/v1/agents/:id/revoke — revoke agent (P2.1)
  // POST /api/v1/agents/:id/reactivate — reactivate agent (P2.1)
}
