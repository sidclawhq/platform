import { FastifyInstance } from 'fastify';

export async function approvalRoutes(app: FastifyInstance) {
  // GET /api/v1/approvals — list pending approvals (P1.4)
  app.get('/approvals', async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }));

  // GET /api/v1/approvals/:id — approval detail (P1.4)
  app.get('/approvals/:id', async () => ({ data: null }));

  // POST /api/v1/approvals/:id/approve — approve request (P1.4)
  // POST /api/v1/approvals/:id/deny — deny request (P1.4)
}
