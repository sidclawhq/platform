import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors.js';
import { WebhookService } from '../services/webhook-service.js';

const RecordOutcomeSchema = z.object({
  status: z.enum(['success', 'error']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function traceRoutes(app: FastifyInstance) {
  const webhookService = new WebhookService(prisma);

  // POST /api/v1/traces/:traceId/outcome — record execution outcome (P1.3)
  app.post('/traces/:traceId/outcome', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { traceId } = request.params as { traceId: string };
    const body = RecordOutcomeSchema.parse(request.body);

    let traceContext: { agentId: string; agentName: string; operation: string; finalOutcome: string } | null = null;

    await prisma.$transaction(async (tx) => {
      const trace = await tx.auditTrace.findFirst({
        where: { id: traceId, tenant_id: tenantId },
      });
      if (!trace) throw new NotFoundError('Trace', traceId);

      // Reject recording on already-finalized traces
      const finalizedOutcomes = ['blocked', 'denied', 'expired', 'executed', 'completed_with_approval'];
      if (finalizedOutcomes.includes(trace.final_outcome)) {
        throw new ConflictError(
          `Trace is already finalized with outcome '${trace.final_outcome}' — cannot record new outcome`
        );
      }

      // Check if this trace went through an approval flow
      const approvedRequest = await tx.approvalRequest.findFirst({
        where: { trace_id: traceId, status: 'approved' },
      });

      const finalOutcome = body.status === 'success'
        ? (approvedRequest ? 'completed_with_approval' : 'executed')
        : 'blocked';
      const eventType = body.status === 'success' ? 'operation_executed' : 'operation_failed';

      const agent = await tx.agent.findFirst({
        where: { id: trace.agent_id },
        select: { name: true },
      });

      traceContext = {
        agentId: trace.agent_id,
        agentName: agent?.name ?? 'Unknown Agent',
        operation: trace.requested_operation,
        finalOutcome,
      };

      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: trace.agent_id,
          event_type: eventType,
          actor_type: 'agent',
          actor_name: agent?.name ?? 'Unknown Agent',
          description: body.status === 'success'
            ? `${trace.requested_operation} operation completed successfully`
            : `${trace.requested_operation} operation failed`,
          status: body.status,
          metadata: body.metadata as object | undefined,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: trace.agent_id,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: `Trace completed with outcome: ${finalOutcome}`,
          status: 'closed',
        },
      });

      await tx.auditTrace.update({
        where: { id: trace.id },
        data: {
          final_outcome: finalOutcome,
          completed_at: new Date(),
        },
      });
    });

    // Webhook dispatch — AFTER transaction commits
    if (traceContext) {
      const ctx = traceContext as { agentId: string; agentName: string; operation: string; finalOutcome: string };
      webhookService.dispatch(tenantId, 'trace.completed', {
        trace: {
          id: traceId,
          agent_id: ctx.agentId,
          agent_name: ctx.agentName,
          operation: ctx.operation,
          final_outcome: ctx.finalOutcome,
        },
      }).catch(() => {});
    }

    return reply.status(204).send();
  });

  // GET /api/v1/traces — list audit traces with filters and pagination (P1.6, P2.4)
  app.get('/traces', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { agent_id, outcome, from, to, limit = '20', offset = '0' } = request.query as Record<string, string>;

    const where: Record<string, unknown> = { tenant_id: tenantId, deleted_at: null };
    if (agent_id) where.agent_id = agent_id;
    if (outcome) where.final_outcome = outcome;
    if (from || to) {
      const startedAt: Record<string, Date> = {};
      if (from) startedAt.gte = new Date(from);
      if (to) startedAt.lte = new Date(to);
      where.started_at = startedAt;
    }

    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = parseInt(offset, 10) || 0;

    const [traces, total] = await Promise.all([
      prisma.auditTrace.findMany({
        where,
        include: {
          agent: { select: { name: true } },
          audit_events: { select: { id: true } },
          approval_requests: { select: { id: true } },
        },
        orderBy: { started_at: 'desc' },
        take,
        skip,
      }),
      prisma.auditTrace.count({ where }),
    ]);

    const data = traces.map(trace => ({
      id: trace.id,
      agent_id: trace.agent_id,
      agent_name: trace.agent.name,
      authority_model: trace.authority_model,
      requested_operation: trace.requested_operation,
      target_integration: trace.target_integration,
      resource_scope: trace.resource_scope,
      final_outcome: trace.final_outcome,
      started_at: trace.started_at.toISOString(),
      completed_at: trace.completed_at?.toISOString() ?? null,
      duration_ms: trace.completed_at
        ? trace.completed_at.getTime() - trace.started_at.getTime()
        : null,
      event_count: trace.audit_events.length,
      has_approval: trace.approval_requests.length > 0,
    }));

    return reply.send({ data, pagination: { total, limit: take, offset: skip } });
  });

  // GET /api/v1/traces/:id — trace detail with all events (P1.6)
  app.get('/traces/:id', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const trace = await prisma.auditTrace.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: {
        agent: { select: { name: true } },
        audit_events: {
          where: { deleted_at: null },
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            event_type: true,
            actor_type: true,
            actor_name: true,
            description: true,
            status: true,
            timestamp: true,
            policy_version: true,
            approval_request_id: true,
            metadata: true,
          },
        },
        approval_requests: {
          select: {
            id: true,
            status: true,
            approver_name: true,
            decided_at: true,
          },
        },
      },
    });

    if (!trace) throw new NotFoundError('Trace', id);

    return reply.send({
      id: trace.id,
      agent_id: trace.agent_id,
      agent_name: trace.agent.name,
      authority_model: trace.authority_model,
      requested_operation: trace.requested_operation,
      target_integration: trace.target_integration,
      resource_scope: trace.resource_scope,
      parent_trace_id: trace.parent_trace_id,
      final_outcome: trace.final_outcome,
      started_at: trace.started_at.toISOString(),
      completed_at: trace.completed_at?.toISOString() ?? null,
      duration_ms: trace.completed_at
        ? trace.completed_at.getTime() - trace.started_at.getTime()
        : null,
      events: trace.audit_events.map(event => ({
        id: event.id,
        event_type: event.event_type,
        actor_type: event.actor_type,
        actor_name: event.actor_name,
        description: event.description,
        status: event.status,
        timestamp: event.timestamp.toISOString(),
        policy_version: event.policy_version,
        approval_request_id: event.approval_request_id,
        metadata: event.metadata as Record<string, unknown> | null,
      })),
      approval_requests: trace.approval_requests.map(ar => ({
        id: ar.id,
        status: ar.status,
        approver_name: ar.approver_name,
        decided_at: ar.decided_at?.toISOString() ?? null,
      })),
    });
  });

  // GET /api/v1/traces/:traceId/export?format=json — export single trace as JSON (P2.4)
  app.get('/traces/:traceId/export', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { traceId } = request.params as { traceId: string };

    const trace = await prisma.auditTrace.findFirst({
      where: { id: traceId, tenant_id: tenantId, deleted_at: null },
      include: {
        agent: { select: { name: true } },
        audit_events: {
          where: { deleted_at: null },
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            event_type: true,
            actor_type: true,
            actor_name: true,
            description: true,
            status: true,
            timestamp: true,
            policy_version: true,
            metadata: true,
          },
        },
        approval_requests: {
          select: {
            id: true,
            status: true,
            flag_reason: true,
            approver_name: true,
            decision_note: true,
            decided_at: true,
          },
        },
      },
    });

    if (!trace) throw new NotFoundError('Trace', traceId);

    const exportData = {
      trace: {
        id: trace.id,
        agent_id: trace.agent_id,
        agent_name: trace.agent.name,
        authority_model: trace.authority_model,
        requested_operation: trace.requested_operation,
        target_integration: trace.target_integration,
        resource_scope: trace.resource_scope,
        parent_trace_id: trace.parent_trace_id,
        final_outcome: trace.final_outcome,
        started_at: trace.started_at.toISOString(),
        completed_at: trace.completed_at?.toISOString() ?? null,
        duration_ms: trace.completed_at
          ? trace.completed_at.getTime() - trace.started_at.getTime()
          : null,
      },
      events: trace.audit_events.map(event => ({
        id: event.id,
        event_type: event.event_type,
        actor_type: event.actor_type,
        actor_name: event.actor_name,
        description: event.description,
        status: event.status,
        timestamp: event.timestamp.toISOString(),
        policy_version: event.policy_version,
        metadata: event.metadata as Record<string, unknown> | null,
      })),
      approval_requests: trace.approval_requests.map(ar => ({
        id: ar.id,
        status: ar.status,
        flag_reason: ar.flag_reason,
        approver_name: ar.approver_name,
        decision_note: ar.decision_note,
        decided_at: ar.decided_at?.toISOString() ?? null,
      })),
      exported_at: new Date().toISOString(),
    };

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="trace-${traceId}.json"`)
      .send(exportData);
  });

  // GET /api/v1/traces/export?from=&to=&format=csv — bulk export traces as CSV (P2.4)
  app.get('/traces/export', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { agent_id, from, to, format } = request.query as Record<string, string>;

    if (!from || !to) throw new ValidationError('from and to query params are required');
    if (format !== 'csv') throw new ValidationError('Only csv format is supported');

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError('Invalid date format. Use ISO 8601.');
    }

    const where: Record<string, unknown> = {
      tenant_id: tenantId,
      started_at: { gte: fromDate, lte: toDate },
      deleted_at: null,
    };
    if (agent_id) where.agent_id = agent_id;

    const total = await prisma.auditTrace.count({ where });
    if (total > 100000) {
      return reply.status(413).send({
        error: 'export_too_large',
        message: `Export contains ${total} traces (max 100,000). Use a smaller date range.`,
        status: 413,
        request_id: request.id,
      });
    }

    const traces = await prisma.auditTrace.findMany({
      where,
      include: {
        agent: { select: { name: true } },
        approval_requests: {
          select: {
            status: true,
            approver_name: true,
            decided_at: true,
            policy_rule_id: true,
            data_classification: true,
            policy_rule: { select: { policy_version: true } },
          },
          take: 1,
        },
      },
      orderBy: { started_at: 'asc' },
    });

    const header = 'trace_id,agent_id,agent_name,operation,target_integration,resource_scope,data_classification,final_outcome,started_at,completed_at,duration_ms,approval_required,approver_name,approval_decision,approval_decided_at,policy_rule_id,policy_version';

    const rows = traces.map(trace => {
      const approval = trace.approval_requests[0];
      const durationMs = trace.completed_at
        ? trace.completed_at.getTime() - trace.started_at.getTime()
        : '';

      return [
        trace.id,
        trace.agent_id,
        csvEscape(trace.agent.name),
        trace.requested_operation,
        trace.target_integration,
        trace.resource_scope,
        approval?.data_classification ?? '',
        trace.final_outcome,
        trace.started_at.toISOString(),
        trace.completed_at?.toISOString() ?? '',
        durationMs,
        approval ? 'true' : 'false',
        csvEscape(approval?.approver_name ?? ''),
        approval?.status ?? '',
        approval?.decided_at?.toISOString() ?? '',
        approval?.policy_rule_id ?? '',
        approval?.policy_rule?.policy_version ?? '',
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const filename = `audit-${from.split('T')[0]}-to-${to.split('T')[0]}.csv`;

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('X-Total-Count', String(total))
      .send(csv);
  });
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
