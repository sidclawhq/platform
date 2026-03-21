import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';

const RecordOutcomeSchema = z.object({
  status: z.enum(['success', 'error']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function traceRoutes(app: FastifyInstance) {
  // POST /api/v1/traces/:traceId/outcome — record execution outcome (P1.3)
  app.post('/traces/:traceId/outcome', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { traceId } = request.params as { traceId: string };
    const body = RecordOutcomeSchema.parse(request.body);

    await prisma.$transaction(async (tx) => {
      const trace = await tx.auditTrace.findFirst({
        where: { id: traceId, tenant_id: tenantId },
      });
      if (!trace) throw new NotFoundError('Trace', traceId);

      const finalOutcome = body.status === 'success'
        ? (trace.final_outcome === 'in_progress' ? 'executed' : 'completed_with_approval')
        : 'blocked';
      const eventType = body.status === 'success' ? 'operation_executed' : 'operation_failed';

      const agent = await tx.agent.findFirst({
        where: { id: trace.agent_id },
        select: { name: true },
      });

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

    return reply.status(204).send();
  });

  // GET /api/v1/traces — list audit traces (P1.6)
  app.get('/traces', async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }));

  // GET /api/v1/traces/:id — trace detail with events (P1.6)
  app.get('/traces/:id', async () => ({ data: null }));

  // GET /api/v1/traces/:id/events — trace events timeline (P1.6)
  app.get('/traces/:id/events', async () => ({ data: [] }));
}
