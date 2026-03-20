import { FastifyInstance } from 'fastify';

export async function evaluateRoutes(app: FastifyInstance) {
  // POST /api/v1/evaluate — evaluate an agent operation against policies (P1.3)
  app.post('/evaluate', async () => ({ decision: 'deny', trace_id: null, approval_request_id: null, reason: 'Not implemented', policy_rule_id: null }));
}
