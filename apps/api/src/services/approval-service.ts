import { randomUUID } from 'crypto';
import { PrismaClient } from '../generated/prisma/index.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors.js';
import { IntegrityService } from './integrity-service.js';

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface ApprovalDecision {
  approver_name: string;
  decision_note?: string;
}

interface ApprovalWithContext {
  id: string;
  trace_id: string;
  agent_id: string;
  policy_rule_id: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  authority_model: string;
  delegated_from: string | null;
  policy_effect: string;
  flag_reason: string;
  status: string;
  requested_at: Date;
  decided_at: Date | null;
  approver_name: string | null;
  decision_note: string | null;
  separation_of_duties_check: string;
  risk_classification: string | null;
  context_snapshot: Record<string, unknown> | null;

  agent: {
    id: string;
    name: string;
    owner_name: string;
    owner_role: string;
    team: string;
    authority_model: string;
    identity_mode: string;
    delegation_model: string;
    autonomy_tier: string;
  };
  policy_rule: {
    id: string;
    policy_name: string;
    rationale: string;
    policy_version: number;
    data_classification: string;
    policy_effect: string;
  };
  trace_events: Array<{
    id: string;
    event_type: string;
    actor_type: string;
    actor_name: string;
    description: string;
    status: string;
    timestamp: Date;
  }>;
}

export type { ApprovalDecision, ApprovalWithContext };

export class ApprovalService {
  constructor(private readonly prisma: PrismaClient) {}

  async approve(
    approvalRequestId: string,
    decision: ApprovalDecision,
  ): Promise<ApprovalWithContext> {
    // 1. Load approval request (outside transaction — SoD check must persist even on throw)
    const approval = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalRequestId },
      include: { agent: { select: { owner_name: true, name: true } } },
    });
    if (!approval) throw new NotFoundError('ApprovalRequest', approvalRequestId);

    // 1b. Early check: if already resolved, return 409 before any permission checks
    if (approval.status !== 'pending') {
      throw new ConflictError(`Approval request is already ${approval.status}`);
    }

    // 2. Separation of duties check (outside transaction so 'fail' persists)
    let separationOfDutiesCheck: string;
    const userCountResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*)::bigint as count FROM "User" WHERE tenant_id = ${approval.tenant_id}
    `;
    const userCount = Number(userCountResult[0].count);

    if (userCount <= 1) {
      // Single-user workspace — SoD cannot be enforced
      separationOfDutiesCheck = 'not_applicable';
    } else if (normalizeName(decision.approver_name) === normalizeName(approval.agent.owner_name)) {
      // Multi-user workspace — enforce SoD (update persists outside transaction)
      await this.prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { separation_of_duties_check: 'fail' },
      });
      throw new ForbiddenError('Agent owner cannot self-approve (separation of duties violation)');
    } else {
      separationOfDutiesCheck = 'pass';
    }

    // 3. Approve in transaction (atomic)
    return this.prisma.$transaction(async (tx) => {
      const integrity = new IntegrityService(tx as unknown as PrismaClient);

      // Atomic conditional update — only succeeds if still pending and not expired
      const updated = await tx.approvalRequest.updateMany({
        where: {
          id: approval.id,
          status: 'pending',
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
        data: {
          status: 'approved',
          decided_at: new Date(),
          approver_name: decision.approver_name,
          decision_note: decision.decision_note ?? null,
          separation_of_duties_check: separationOfDutiesCheck,
        },
      });

      // 4. If no rows updated, someone else already decided
      if (updated.count === 0) {
        const current = await tx.approvalRequest.findFirst({ where: { id: approval.id } });
        throw new ConflictError(`Approval request is already ${current?.status ?? 'decided'}`);
      }

      // Lock trace for hash chain serialization
      await tx.$queryRaw`SELECT id FROM "AuditTrace" WHERE id = ${approval.trace_id} FOR UPDATE`;

      // 5. Create AuditEvent: approval_granted
      const eventId = randomUUID();
      const timestamp = new Date();
      const description = decision.decision_note
        ? `Approved by ${decision.approver_name}: ${decision.decision_note}`
        : `Approved by ${decision.approver_name}`;
      const hash = await integrity.computeEventHash(
        tx as unknown as PrismaClient,
        approval.trace_id,
        {
          id: eventId,
          event_type: 'approval_granted',
          actor_type: 'human_reviewer',
          actor_name: decision.approver_name,
          description,
          status: 'approved',
          timestamp,
        },
      );
      await tx.auditEvent.create({
        data: {
          id: eventId,
          tenant_id: approval.tenant_id,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          approval_request_id: approval.id,
          event_type: 'approval_granted',
          actor_type: 'human_reviewer',
          actor_name: decision.approver_name,
          description,
          status: 'approved',
          timestamp,
          integrity_hash: hash,
        },
      });

      // 6. Trace stays in_progress — agent still needs to execute
      // (trace is finalized when SDK calls POST /traces/:id/outcome)

      // 7. Return with context
      return this.getApprovalWithContext(approvalRequestId, tx as unknown as PrismaClient);
    });
  }

  async deny(
    approvalRequestId: string,
    decision: ApprovalDecision,
  ): Promise<ApprovalWithContext> {
    return this.prisma.$transaction(async (tx) => {
      const integrity = new IntegrityService(tx as unknown as PrismaClient);

      // 1. Load approval request
      const approval = await tx.approvalRequest.findFirst({
        where: { id: approvalRequestId },
      });

      if (!approval) throw new NotFoundError('ApprovalRequest', approvalRequestId);

      // 2. Atomic conditional deny — only succeeds if still pending and not expired
      const updated = await tx.approvalRequest.updateMany({
        where: {
          id: approval.id,
          status: 'pending',
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
        data: {
          status: 'denied',
          decided_at: new Date(),
          approver_name: decision.approver_name,
          decision_note: decision.decision_note ?? null,
        },
      });

      // 3. If no rows updated, someone else already decided
      if (updated.count === 0) {
        const current = await tx.approvalRequest.findFirst({ where: { id: approval.id } });
        throw new ConflictError(`Approval request is already ${current?.status ?? 'decided'}`);
      }

      // Lock trace for hash chain serialization
      await tx.$queryRaw`SELECT id FROM "AuditTrace" WHERE id = ${approval.trace_id} FOR UPDATE`;

      // 4. Create AuditEvent: approval_denied
      const denyEventId = randomUUID();
      const denyTimestamp = new Date();
      const denyDescription = decision.decision_note
        ? `Denied by ${decision.approver_name}: ${decision.decision_note}`
        : `Denied by ${decision.approver_name}`;
      const denyHash = await integrity.computeEventHash(
        tx as unknown as PrismaClient,
        approval.trace_id,
        {
          id: denyEventId,
          event_type: 'approval_denied',
          actor_type: 'human_reviewer',
          actor_name: decision.approver_name,
          description: denyDescription,
          status: 'denied',
          timestamp: denyTimestamp,
        },
      );
      await tx.auditEvent.create({
        data: {
          id: denyEventId,
          tenant_id: approval.tenant_id,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          approval_request_id: approval.id,
          event_type: 'approval_denied',
          actor_type: 'human_reviewer',
          actor_name: decision.approver_name,
          description: denyDescription,
          status: 'denied',
          timestamp: denyTimestamp,
          integrity_hash: denyHash,
        },
      });

      // 5. Create AuditEvent: trace_closed
      const closeEventId = randomUUID();
      const closeTimestamp = new Date(denyTimestamp.getTime() + 1);
      const closeHash = await integrity.computeEventHash(
        tx as unknown as PrismaClient,
        approval.trace_id,
        {
          id: closeEventId,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: 'Trace completed with outcome: denied',
          status: 'closed',
          timestamp: closeTimestamp,
        },
      );
      await tx.auditEvent.create({
        data: {
          id: closeEventId,
          tenant_id: approval.tenant_id,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: 'Trace completed with outcome: denied',
          status: 'closed',
          timestamp: closeTimestamp,
          integrity_hash: closeHash,
        },
      });

      // 6. Finalize trace
      await tx.auditTrace.update({
        where: { id: approval.trace_id },
        data: {
          final_outcome: 'denied',
          completed_at: new Date(),
          integrity_hash: closeHash,
        },
      });

      // 7. Return with context
      return this.getApprovalWithContext(approvalRequestId, tx as unknown as PrismaClient);
    });
  }

  async getApprovalWithContext(
    approvalRequestId: string,
    db?: PrismaClient,
  ): Promise<ApprovalWithContext> {
    const client = db ?? this.prisma;

    const approval = await client.approvalRequest.findFirst({
      where: { id: approvalRequestId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            owner_name: true,
            owner_role: true,
            team: true,
            authority_model: true,
            identity_mode: true,
            delegation_model: true,
            autonomy_tier: true,
          },
        },
        policy_rule: {
          select: {
            id: true,
            policy_name: true,
            rationale: true,
            policy_version: true,
            data_classification: true,
            policy_effect: true,
          },
        },
      },
    });

    if (!approval) throw new NotFoundError('ApprovalRequest', approvalRequestId);

    // Load trace events
    const traceEvents = await client.auditEvent.findMany({
      where: { trace_id: approval.trace_id },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        event_type: true,
        actor_type: true,
        actor_name: true,
        description: true,
        status: true,
        timestamp: true,
      },
    });

    return {
      ...approval,
      agent: approval.agent,
      policy_rule: approval.policy_rule,
      trace_events: traceEvents,
      context_snapshot: approval.context_snapshot as Record<string, unknown> | null,
    };
  }

  async list(filters: {
    status?: string;
    agent_id?: string;
    limit?: number;
    offset?: number;
  }) {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.agent_id ? { agent_id: filters.agent_id } : {}),
    };

    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);

    const pendingWhere = { status: 'pending' as const };

    const [data, total, riskCounts, oldestPending] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true, owner_name: true } },
        },
        orderBy: { requested_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.approvalRequest.count({ where }),
      this.prisma.approvalRequest.groupBy({
        by: ['risk_classification'],
        where: pendingWhere,
        _count: true,
      }),
      this.prisma.approvalRequest.findFirst({
        where: pendingWhere,
        orderBy: { requested_at: 'asc' },
        select: { requested_at: true },
      }),
    ]);

    const now = Date.now();

    const enrichedData = data.map((approval) => ({
      ...approval,
      time_pending_seconds: Math.floor((now - approval.requested_at.getTime()) / 1000),
      context_snippet: approval.context_snapshot
        ? JSON.stringify(approval.context_snapshot).substring(0, 200)
        : null,
    }));

    const meta = {
      oldest_pending_seconds: oldestPending
        ? Math.floor((now - oldestPending.requested_at.getTime()) / 1000)
        : null,
      count_by_risk: {
        low: riskCounts.find(r => r.risk_classification === 'low')?._count ?? 0,
        medium: riskCounts.find(r => r.risk_classification === 'medium')?._count ?? 0,
        high: riskCounts.find(r => r.risk_classification === 'high')?._count ?? 0,
        critical: riskCounts.find(r => r.risk_classification === 'critical')?._count ?? 0,
      },
    };

    return {
      data: enrichedData,
      pagination: { total, limit, offset },
      meta,
    };
  }

  async count(filters: { status?: string }) {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
    };

    const count = await this.prisma.approvalRequest.count({ where });
    return { count };
  }
}
