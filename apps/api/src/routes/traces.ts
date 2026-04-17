import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '../generated/prisma/index.js';
import { z } from 'zod';
import { NotFoundError, ConflictError, ValidationError } from '../errors.js';
import { IntegrityService } from '../services/integrity-service.js';
import { WebhookService } from '../services/webhook-service.js';
import { requireRole } from '../middleware/require-role.js';

// Int4 max — Postgres INTEGER column bound. Longer sessions exceeding ~2.1B
// tokens need BIGINT (future work). Until then, reject to avoid silent 500s.
const INT4_MAX = 2_147_483_647;
// Cost cap — Decimal(14,6) supports up to 99,999,999.999999; we bound clients
// well below that to catch pricing bugs early.
const COST_MAX = 10_000_000;

const RecordOutcomeSchema = z.object({
  status: z.enum(['success', 'error']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Hook telemetry (Section 1 of competitive-response spec)
  outcome_summary: z.string().max(2000).optional(),
  error_classification: z.enum(['timeout', 'permission', 'not_found', 'runtime']).optional(),
  exit_code: z.number().int().min(-255).max(255).optional(),
  tokens_in: z.number().int().nonnegative().max(INT4_MAX).optional(),
  tokens_out: z.number().int().nonnegative().max(INT4_MAX).optional(),
  tokens_cache_read: z.number().int().nonnegative().max(INT4_MAX).optional(),
  model: z.string().max(100).optional(),
  cost_estimate: z.number().nonnegative().max(COST_MAX).optional(),
}).strict();

const RecordTelemetrySchema = z.object({
  tokens_in: z.number().int().nonnegative().max(INT4_MAX).optional(),
  tokens_out: z.number().int().nonnegative().max(INT4_MAX).optional(),
  tokens_cache_read: z.number().int().nonnegative().max(INT4_MAX).optional(),
  model: z.string().max(100).optional(),
  cost_estimate: z.number().nonnegative().max(COST_MAX).optional(),
  outcome_summary: z.string().max(2000).optional(),
}).strict().refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one telemetry field is required' },
);

export async function traceRoutes(app: FastifyInstance) {
  // POST /api/v1/traces/:traceId/outcome — record execution outcome (P1.3)
  app.post('/traces/:traceId/outcome', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { traceId } = request.params as { traceId: string };
    const body = RecordOutcomeSchema.parse(request.body);
    const db = request.tenantPrisma! as unknown as PrismaClient;

    let traceContext: { agentId: string; agentName: string; operation: string; finalOutcome: string } | null = null;

    await db.$transaction(async (tx) => {
      const integrity = new IntegrityService(tx as unknown as PrismaClient);

      // Acquire the row lock FIRST, then do all reads + branch decisions
      // inside the serialized section. The prior version had a race where
      // two concurrent error reports on an already-executed trace could
      // both see no prior operation_failed and both append one.
      // Scope the raw lock by tenant_id — Prisma $extends does NOT intercept
      // $queryRaw, so without the predicate a cross-tenant caller could take
      // a FOR UPDATE lock on another tenant's row before the findFirst check
      // below returns 404.
      const lockResult = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "AuditTrace" WHERE id = ${traceId} AND tenant_id = ${tenantId} FOR UPDATE
      `;
      if (lockResult.length === 0) throw new NotFoundError('Trace', traceId);

      const trace = await tx.auditTrace.findFirst({
        where: { id: traceId },
      });
      if (!trace) throw new NotFoundError('Trace', traceId);

      // Reject recording on terminally-finalized traces. 'executed' and
      // 'completed_with_approval' are also terminal for the EVENT chain —
      // the initial outcome event has already been written. We still want
      // to accept telemetry updates on those, but we MUST NOT append a
      // contradictory outcome event to the hash chain.
      // 'drift_sentinel' is internal drift-detection bookkeeping; user
      // callers must not mutate these rows.
      const terminalOutcomes = ['blocked', 'denied', 'expired', 'drift_sentinel'];
      if (terminalOutcomes.includes(trace.final_outcome)) {
        throw new ConflictError(
          `Trace is finalized with outcome '${trace.final_outcome}'`
        );
      }

      const isAlreadyExecuted = trace.final_outcome === 'executed' || trace.final_outcome === 'completed_with_approval';

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
        finalOutcome: isAlreadyExecuted ? trace.final_outcome : finalOutcome,
      };

      // Build telemetry update — note: when telemetry arrives on an
      // already-executed trace, we SET (not increment); the PATCH
      // telemetry endpoint is the additive path for Stop-hook-style updates.
      // outcome_summary and model are SET-ONCE for audit integrity (mirrors
      // PATCH /telemetry semantics): a retry or crash-recovery POST must not
      // silently overwrite a finalized forensic summary or the executing
      // model string.
      const telemetryUpdate: Record<string, unknown> = {};
      if (body.outcome_summary !== undefined && trace.outcome_summary === null) {
        telemetryUpdate.outcome_summary = body.outcome_summary;
      }
      if (body.error_classification !== undefined) telemetryUpdate.error_classification = body.error_classification;
      if (body.exit_code !== undefined) telemetryUpdate.exit_code = body.exit_code;
      if (body.tokens_in !== undefined) telemetryUpdate.tokens_in = body.tokens_in;
      if (body.tokens_out !== undefined) telemetryUpdate.tokens_out = body.tokens_out;
      if (body.tokens_cache_read !== undefined) telemetryUpdate.tokens_cache_read = body.tokens_cache_read;
      if (body.model !== undefined && trace.model === null) {
        telemetryUpdate.model = body.model;
      }
      if (body.cost_estimate !== undefined) telemetryUpdate.cost_estimate = body.cost_estimate;

      // Idempotency guard for already-executed + error: reject if we've
      // already recorded an operation_failed for this trace. This prevents
      // the Stop-hook crash-recovery path from appending duplicate events.
      if (isAlreadyExecuted && body.status === 'error') {
        const priorFailure = await tx.auditEvent.findFirst({
          where: { trace_id: traceId, event_type: 'operation_failed' },
        });
        if (priorFailure) {
          // Already recorded — just update telemetry idempotently.
          if (Object.keys(telemetryUpdate).length > 0) {
            await tx.auditTrace.update({
              where: { id: trace.id },
              data: telemetryUpdate,
            });
          }
          return;
        }
        // First error after executed — event creation path below will add a
        // single operation_failed. The policy decision (executed) stays; the
        // error_classification + outcome_summary on the trace capture the
        // runtime failure. This intentionally does NOT demote final_outcome.
      }

      // Create the outcome event (first time, or re-confirmation of success).
      const outcomeEventId = randomUUID();
      const outcomeTimestamp = new Date();
      const outcomeDescription = body.status === 'success'
        ? `${trace.requested_operation} operation completed successfully`
        : `${trace.requested_operation} operation failed`;
      const outcomeHash = await integrity.computeEventHash(
        tx as unknown as PrismaClient,
        trace.id,
        {
          id: outcomeEventId,
          event_type: eventType,
          actor_type: 'agent',
          actor_name: agent?.name ?? 'Unknown Agent',
          description: outcomeDescription,
          status: body.status,
          timestamp: outcomeTimestamp,
        },
      );
      await tx.auditEvent.create({
        data: {
          id: outcomeEventId,
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: trace.agent_id,
          event_type: eventType,
          actor_type: 'agent',
          actor_name: agent?.name ?? 'Unknown Agent',
          description: outcomeDescription,
          status: body.status,
          timestamp: outcomeTimestamp,
          integrity_hash: outcomeHash,
          metadata: body.metadata as object | undefined,
        },
      });

      // For already-executed traces, persist telemetry fields AND update the
      // trace row's `integrity_hash` pointer to the newly-appended outcome
      // event. Skipping this update leaves `AuditTrace.integrity_hash` stale
      // relative to the tail of the chain — not a hash-chain break, but any
      // caller using the row as a cheap latest-event reference would see a
      // stale value.
      if (isAlreadyExecuted) {
        await tx.auditTrace.update({
          where: { id: trace.id },
          data: { ...telemetryUpdate, integrity_hash: outcomeHash },
        });
      }

      // For already-executed traces (auto-close allow path), skip re-closing
      if (!isAlreadyExecuted) {
        // Create trace_closed event with integrity hash
        const closeEventId = randomUUID();
        const closeTimestamp = new Date();
        const closeDescription = `Trace completed with outcome: ${finalOutcome}`;
        const closeHash = await integrity.computeEventHash(
          tx as unknown as PrismaClient,
          trace.id,
          {
            id: closeEventId,
            event_type: 'trace_closed',
            actor_type: 'system',
            actor_name: 'Trace Service',
            description: closeDescription,
            status: 'closed',
            timestamp: closeTimestamp,
          },
        );
        await tx.auditEvent.create({
          data: {
            id: closeEventId,
            tenant_id: tenantId,
            trace_id: trace.id,
            agent_id: trace.agent_id,
            event_type: 'trace_closed',
            actor_type: 'system',
            actor_name: 'Trace Service',
            description: closeDescription,
            status: 'closed',
            timestamp: closeTimestamp,
            integrity_hash: closeHash,
          },
        });

        await tx.auditTrace.update({
          where: { id: trace.id },
          data: {
            final_outcome: finalOutcome,
            completed_at: new Date(),
            integrity_hash: closeHash,
            ...telemetryUpdate,
          },
        });
      }
    });

    // Webhook dispatch — AFTER transaction commits
    if (traceContext) {
      const ctx = traceContext as { agentId: string; agentName: string; operation: string; finalOutcome: string };
      const webhookService = new WebhookService(db);
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

  // PATCH /api/v1/traces/:traceId/telemetry — append token usage / cost data
  // Used by the Claude Code Stop hook (arrives after outcome is recorded) and any
  // SDK caller that wants to attribute LLM cost to a governance trace post-hoc.
  //
  // Semantics:
  //   - tokens_in/out/cache_read, cost_estimate: ADDITIVE. Server increments.
  //     Fixes the Stop hook cumulative-drift bug: caller sends the delta since
  //     its last call, we sum them into the trace.
  //   - model: SET-ONCE. If already populated, new values are ignored (first
  //     model wins — typically the model that actually executed the action).
  //   - outcome_summary: SET-ONCE for audit integrity. Cannot overwrite a
  //     finalized forensic summary.
  //
  // Every PATCH appends a `telemetry_appended` AuditEvent to the hash chain
  // so mutations are recorded.
  app.patch('/traces/:traceId/telemetry', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { traceId } = request.params as { traceId: string };
    const body = RecordTelemetrySchema.parse(request.body);
    const db = request.tenantPrisma! as unknown as PrismaClient;

    await db.$transaction(async (tx) => {
      const integrity = new IntegrityService(tx as unknown as PrismaClient);

      // Take the row lock FIRST, then re-read inside the locked section.
      // The prior version had a read-before-lock race where two concurrent
      // PATCHes on a fresh (null) trace would both see tokens_in=null,
      // both enter the SET branch, and one value would be lost.
      // Scope the raw lock by tenant_id — $queryRaw is not intercepted by
      // Prisma's $extends tenant scoping.
      const lockResult = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "AuditTrace" WHERE id = ${traceId} AND tenant_id = ${tenantId} FOR UPDATE
      `;
      if (lockResult.length === 0) throw new NotFoundError('Trace', traceId);

      const trace = await tx.auditTrace.findFirst({ where: { id: traceId } });
      if (!trace) throw new NotFoundError('Trace', traceId);

      // Reject telemetry writes on terminally-finalized traces — the sibling
      // POST /outcome endpoint enforces the same invariant. Without this
      // guard, a caller could attribute tokens/cost to a denied or blocked
      // trace (polluting billing), or mutate internal drift_sentinel rows
      // used by the drift-detection dedup job.
      const terminalOutcomes = ['blocked', 'denied', 'expired', 'drift_sentinel'];
      if (terminalOutcomes.includes(trace.final_outcome)) {
        throw new ConflictError(
          `Trace is finalized with outcome '${trace.final_outcome}'`
        );
      }

      const update: Record<string, unknown> = {};
      const setOnceFieldsTouched: string[] = [];
      const addedFields: string[] = [];

      // Additive counters — Prisma's { increment } silently no-ops when the
      // column is NULL (Postgres: NULL + N = NULL). For a fresh trace we SET
      // the first value; thereafter increment. Safe now that the FOR UPDATE
      // lock is held across read-check-write.
      if (body.tokens_in !== undefined) {
        update.tokens_in =
          trace.tokens_in === null
            ? body.tokens_in
            : { increment: body.tokens_in };
        addedFields.push('tokens_in');
      }
      if (body.tokens_out !== undefined) {
        update.tokens_out =
          trace.tokens_out === null
            ? body.tokens_out
            : { increment: body.tokens_out };
        addedFields.push('tokens_out');
      }
      if (body.tokens_cache_read !== undefined) {
        update.tokens_cache_read =
          trace.tokens_cache_read === null
            ? body.tokens_cache_read
            : { increment: body.tokens_cache_read };
        addedFields.push('tokens_cache_read');
      }
      if (body.cost_estimate !== undefined) {
        update.cost_estimate =
          trace.cost_estimate === null
            ? body.cost_estimate
            : { increment: body.cost_estimate };
        addedFields.push('cost_estimate');
      }

      // Set-once fields — ignore new value if already populated.
      if (body.model !== undefined && (trace.model === null || trace.model === undefined)) {
        update.model = body.model;
        setOnceFieldsTouched.push('model');
      }
      if (
        body.outcome_summary !== undefined &&
        (trace.outcome_summary === null || trace.outcome_summary === undefined)
      ) {
        update.outcome_summary = body.outcome_summary;
        setOnceFieldsTouched.push('outcome_summary');
      }

      if (Object.keys(update).length === 0) {
        // Nothing to write — body sent set-once fields that were already set.
        return;
      }

      const agent = await tx.agent.findFirst({
        where: { id: trace.agent_id },
        select: { name: true },
      });

      const evId = randomUUID();
      const evTs = new Date();
      const mutated = [...addedFields, ...setOnceFieldsTouched];
      const evDesc = `Telemetry updated: ${mutated.join(', ')}`;
      const evHash = await integrity.computeEventHash(
        tx as unknown as PrismaClient,
        trace.id,
        {
          id: evId,
          event_type: 'telemetry_appended',
          actor_type: 'agent',
          actor_name: agent?.name ?? 'Unknown Agent',
          description: evDesc,
          status: 'appended',
          timestamp: evTs,
        },
      );
      await tx.auditEvent.create({
        data: {
          id: evId,
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: trace.agent_id,
          event_type: 'telemetry_appended',
          actor_type: 'agent',
          actor_name: agent?.name ?? 'Unknown Agent',
          description: evDesc,
          status: 'appended',
          timestamp: evTs,
          integrity_hash: evHash,
          metadata: { added: addedFields, set_once: setOnceFieldsTouched } as object,
        },
      });

      await tx.auditTrace.update({
        where: { id: trace.id },
        data: { ...update, integrity_hash: evHash },
      });
    });

    return reply.status(204).send();
  });

  // GET /api/v1/traces — list audit traces with filters and pagination (P1.6, P2.4)
  app.get('/traces', async (request, reply) => {
    const { agent_id, outcome, from, to, limit = '20', offset = '0' } = request.query as Record<string, string>;
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const where: Record<string, unknown> = {
      deleted_at: null,
      // Exclude drift-detection sentinel traces — they're an internal
      // mechanism for dedup state, not user-facing.
      final_outcome: { not: 'drift_sentinel' },
    };
    if (agent_id) where.agent_id = agent_id;
    // Merge an explicit outcome filter WITH the sentinel exclusion; a plain
    // assignment would clobber the exclusion and let `?outcome=drift_sentinel`
    // enumerate internal rows.
    if (outcome && outcome !== 'drift_sentinel') {
      where.final_outcome = { equals: outcome, not: 'drift_sentinel' };
    }
    if (from || to) {
      const startedAt: Record<string, Date> = {};
      if (from) startedAt.gte = new Date(from);
      if (to) startedAt.lte = new Date(to);
      where.started_at = startedAt;
    }

    const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = Math.max(parseInt(offset, 10) || 0, 0);

    const [traces, total] = await Promise.all([
      db.auditTrace.findMany({
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
      db.auditTrace.count({ where }),
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
    const { id } = request.params as { id: string };
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const trace = await db.auditTrace.findFirst({
      where: { id, deleted_at: null, final_outcome: { not: 'drift_sentinel' } },
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
            integrity_hash: true,
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
      outcome_summary: trace.outcome_summary,
      error_classification: trace.error_classification,
      exit_code: trace.exit_code,
      tokens_in: trace.tokens_in,
      tokens_out: trace.tokens_out,
      tokens_cache_read: trace.tokens_cache_read,
      model: trace.model,
      cost_estimate: trace.cost_estimate ? Number(trace.cost_estimate) : null,
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
        integrity_hash: event.integrity_hash,
      })),
      approval_requests: trace.approval_requests.map(ar => ({
        id: ar.id,
        status: ar.status,
        approver_name: ar.approver_name,
        decided_at: ar.decided_at?.toISOString() ?? null,
      })),
    });
  });

  // GET /api/v1/traces/:traceId/verify — verify trace integrity (P4.5)
  app.get('/traces/:traceId/verify', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { traceId } = request.params as { traceId: string };
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const integrityService = new IntegrityService(db);
    const result = await integrityService.verifyTrace(traceId, tenantId);

    return reply.send(result);
  });

  // GET /api/v1/traces/:traceId/export?format=json — export single trace as JSON (reviewer, admin)
  app.get('/traces/:traceId/export', { preHandler: [requireRole('reviewer', 'admin')] }, async (request, reply) => {
    const { traceId } = request.params as { traceId: string };
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const trace = await db.auditTrace.findFirst({
      where: { id: traceId, deleted_at: null, final_outcome: { not: 'drift_sentinel' } },
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

  // GET /api/v1/traces/export?from=&to=&format=csv — bulk export traces as CSV (reviewer, admin)
  app.get('/traces/export', { preHandler: [requireRole('reviewer', 'admin')] }, async (request, reply) => {
    const { agent_id, from, to, format } = request.query as Record<string, string>;
    const db = request.tenantPrisma! as unknown as PrismaClient;

    if (!from || !to) throw new ValidationError('from and to query params are required');
    if (format !== 'csv') throw new ValidationError('Only csv format is supported');

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError('Invalid date format. Use ISO 8601.');
    }

    const where: Record<string, unknown> = {
      started_at: { gte: fromDate, lte: toDate },
      deleted_at: null,
      // Drift-detection sentinel traces are internal bookkeeping — not exportable
      final_outcome: { not: 'drift_sentinel' },
    };
    if (agent_id) where.agent_id = agent_id;

    const total = await db.auditTrace.count({ where });
    if (total > 100000) {
      return reply.status(413).send({
        error: 'export_too_large',
        message: `Export contains ${total} traces (max 100,000). Use a smaller date range.`,
        status: 413,
        request_id: request.id,
      });
    }

    const traces = await db.auditTrace.findMany({
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

  // GET /api/v1/audit/export?from=&to=&format=json|csv — SIEM-ready audit event export (P4.5)
  app.get('/audit/export', { preHandler: [requireRole('reviewer', 'admin')] }, async (request, reply) => {
    const { from, to, format = 'json' } = request.query as Record<string, string>;
    const db = request.tenantPrisma! as unknown as PrismaClient;

    if (!from || !to) throw new ValidationError('from and to query params are required');
    if (format !== 'json' && format !== 'csv') {
      throw new ValidationError('format must be json or csv');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError('Invalid date format. Use ISO 8601.');
    }

    const where = {
      timestamp: { gte: fromDate, lte: toDate },
      deleted_at: null,
    };

    const total = await db.auditEvent.count({ where });
    if (total > 100000) {
      return reply.status(413).send({
        error: 'export_too_large',
        message: `Export contains ${total} events (max 100,000). Use a smaller date range.`,
        status: 413,
        request_id: request.id,
      });
    }

    const events = await db.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        trace_id: true,
        agent_id: true,
        event_type: true,
        actor_type: true,
        actor_name: true,
        description: true,
        status: true,
        timestamp: true,
        policy_version: true,
        integrity_hash: true,
      },
    });

    const filename = `audit-events-${from.split('T')[0]}-to-${to.split('T')[0]}`;

    if (format === 'csv') {
      const header = 'event_id,trace_id,agent_id,event_type,actor_type,actor_name,description,status,timestamp,policy_version,integrity_hash';
      const rows = events.map(e => [
        e.id,
        e.trace_id,
        e.agent_id,
        e.event_type,
        e.actor_type,
        csvEscape(e.actor_name),
        csvEscape(e.description),
        e.status,
        e.timestamp.toISOString(),
        e.policy_version ?? '',
        e.integrity_hash ?? '',
      ].join(','));

      const csv = [header, ...rows].join('\n');

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}.csv"`)
        .header('X-Total-Count', String(total))
        .send(csv);
    }

    // JSON format
    const data = events.map(e => ({
      event_id: e.id,
      trace_id: e.trace_id,
      agent_id: e.agent_id,
      event_type: e.event_type,
      actor_type: e.actor_type,
      actor_name: e.actor_name,
      description: e.description,
      status: e.status,
      timestamp: e.timestamp.toISOString(),
      policy_version: e.policy_version,
      integrity_hash: e.integrity_hash,
    }));

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${filename}.json"`)
      .header('X-Total-Count', String(total))
      .send(data);
  });
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
