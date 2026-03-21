import { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../generated/prisma/index.js';
import { ApprovalDecisionSchema } from '@sidclaw/shared';
import { NotFoundError } from '../errors.js';
import { ApprovalService } from '../services/approval-service.js';
import { WebhookService } from '../services/webhook-service.js';
import { requireRole } from '../middleware/require-role.js';

export async function approvalRoutes(app: FastifyInstance) {
  // GET /api/v1/approvals/:id/status — poll approval status (P1.3)
  app.get('/approvals/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };

    const approval = await (request.tenantPrisma! as unknown as PrismaClient).approvalRequest.findFirst({
      where: { id },
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

  // GET /api/v1/approvals/count — lightweight pending count (P2.3c)
  app.get('/approvals/count', async (request, reply) => {
    const query = request.query as { status?: string };

    const approvalService = new ApprovalService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await approvalService.count({
      status: query.status,
    });

    return reply.status(200).send(result);
  });

  // GET /api/v1/approvals — list approvals with filters and pagination (P1.4)
  app.get('/approvals', async (request, reply) => {
    const query = request.query as {
      status?: string;
      agent_id?: string;
      limit?: string;
      offset?: string;
    };

    const approvalService = new ApprovalService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await approvalService.list({
      status: query.status,
      agent_id: query.agent_id,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return reply.status(200).send(result);
  });

  // GET /api/v1/approvals/:id — approval detail with context (P1.4)
  app.get('/approvals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const approvalService = new ApprovalService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await approvalService.getApprovalWithContext(id);

    return reply.status(200).send(result);
  });

  // POST /api/v1/approvals/:id/approve — approve request (reviewer, admin)
  app.post('/approvals/:id/approve', { preHandler: [requireRole('reviewer', 'admin')] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };
    const body = ApprovalDecisionSchema.parse(request.body);

    const approvalService = new ApprovalService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await approvalService.approve(id, body);

    // Webhook dispatch — AFTER transaction commits
    const webhookService = new WebhookService(request.tenantPrisma! as unknown as PrismaClient);
    webhookService.dispatch(tenantId, 'approval.approved', {
      approval_request: {
        id: result.id,
        trace_id: result.trace_id,
        agent_name: result.agent.name,
        operation: result.requested_operation,
        approver_name: result.approver_name,
        decision_note: result.decision_note,
      },
    }).catch(() => {});

    return reply.status(200).send(result);
  });

  // POST /api/v1/approvals/:id/deny — deny request (reviewer, admin)
  app.post('/approvals/:id/deny', { preHandler: [requireRole('reviewer', 'admin')] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };
    const body = ApprovalDecisionSchema.parse(request.body);

    const approvalService = new ApprovalService(request.tenantPrisma! as unknown as PrismaClient);
    const result = await approvalService.deny(id, body);

    // Webhook dispatch — AFTER transaction commits
    const webhookService = new WebhookService(request.tenantPrisma! as unknown as PrismaClient);
    webhookService.dispatch(tenantId, 'approval.denied', {
      approval_request: {
        id: result.id,
        trace_id: result.trace_id,
        agent_name: result.agent.name,
        operation: result.requested_operation,
        approver_name: result.approver_name,
        decision_note: result.decision_note,
      },
    }).catch(() => {});

    return reply.status(200).send(result);
  });
}
