import { FastifyInstance } from 'fastify';

export async function policyRoutes(app: FastifyInstance) {
  // GET /api/v1/policies — list policy rules (P2.2)
  app.get('/policies', async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }));

  // GET /api/v1/policies/:id — policy rule detail (P2.2)
  app.get('/policies/:id', async () => ({ data: null }));

  // POST /api/v1/policies — create policy rule (P2.2)
  // PATCH /api/v1/policies/:id — update policy rule (P2.2)
  // DELETE /api/v1/policies/:id — deactivate policy rule (P2.2)
  // GET /api/v1/policies/:id/versions — policy version history (P2.2)
}
