import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';

export async function approvalRoutes(app: FastifyInstance) {
  // GET /api/v1/approvals/:id/status — poll approval status (P1.3)
  app.get('/approvals/:id/status', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const approval = await prisma.approvalRequest.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        status: true,
        decided_at: true,
        approver_name: true,
        decision_note: true,
      },
    });

    if (!approval) throw new NotFoundError('ApprovalRequest', id);

    return reply.status(200).send(approval);
  });

  // GET /api/v1/approvals — list pending approvals (P1.4)
  app.get('/approvals', async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }));

  // GET /api/v1/approvals/:id — approval detail (P1.4)
  app.get('/approvals/:id', async () => ({ data: null }));

  // POST /api/v1/approvals/:id/approve — approve request (P1.4)
  // POST /api/v1/approvals/:id/deny — deny request (P1.4)
}
