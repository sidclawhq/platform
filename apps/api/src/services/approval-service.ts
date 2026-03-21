import { PrismaClient } from '../generated/prisma/index.js';
import { AppError, ConflictError, NotFoundError } from '../errors.js';

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
    tenantId: string,
    decision: ApprovalDecision,
  ): Promise<ApprovalWithContext> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Load approval request
      const approval = await tx.approvalRequest.findFirst({
        where: { id: approvalRequestId, tenant_id: tenantId },
        include: { agent: { select: { owner_name: true, name: true } } },
      });

      if (!approval) throw new NotFoundError('ApprovalRequest', approvalRequestId);

      // 2. Check if already decided
      if (approval.status !== 'pending') {
        throw new ConflictError(`Approval request is already ${approval.status}`);
      }

      // 3. Separation of duties check
      if (decision.approver_name === approval.agent.owner_name) {
        await tx.approvalRequest.update({
          where: { id: approval.id },
          data: { separation_of_duties_check: 'fail' },
        });
        throw new AppError(
          'separation_of_duties_violation',
          403,
          'Agent owner cannot self-approve (separation of duties violation)',
        );
      }

      // 4. Approve
      await tx.approvalRequest.update({
        where: { id: approval.id },
        data: {
          status: 'approved',
          decided_at: new Date(),
          approver_name: decision.approver_name,
          decision_note: decision.decision_note ?? null,
          separation_of_duties_check: 'pass',
        },
      });

      // 5. Create AuditEvent: approval_granted
      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          approval_request_id: approval.id,
          event_type: 'approval_granted',
          actor_type: 'human_reviewer',
          actor_name: decision.approver_name,
          description: decision.decision_note
            ? `Approved by ${decision.approver_name}: ${decision.decision_note}`
            : `Approved by ${decision.approver_name}`,
          status: 'approved',
        },
      });

      // 6. Trace stays in_progress — agent still needs to execute
      // (trace is finalized when SDK calls POST /traces/:id/outcome)

      // 7. Return with context
      return this.getApprovalWithContext(approvalRequestId, tenantId, tx as unknown as PrismaClient);
    });
  }

  async deny(
    approvalRequestId: string,
    tenantId: string,
    decision: ApprovalDecision,
  ): Promise<ApprovalWithContext> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Load approval request
      const approval = await tx.approvalRequest.findFirst({
        where: { id: approvalRequestId, tenant_id: tenantId },
      });

      if (!approval) throw new NotFoundError('ApprovalRequest', approvalRequestId);

      // 2. Check if already decided
      if (approval.status !== 'pending') {
        throw new ConflictError(`Approval request is already ${approval.status}`);
      }

      // 3. Deny
      await tx.approvalRequest.update({
        where: { id: approval.id },
        data: {
          status: 'denied',
          decided_at: new Date(),
          approver_name: decision.approver_name,
          decision_note: decision.decision_note ?? null,
        },
      });

      // 4. Create AuditEvent: approval_denied
      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          approval_request_id: approval.id,
          event_type: 'approval_denied',
          actor_type: 'human_reviewer',
          actor_name: decision.approver_name,
          description: decision.decision_note
            ? `Denied by ${decision.approver_name}: ${decision.decision_note}`
            : `Denied by ${decision.approver_name}`,
          status: 'denied',
        },
      });

      // 5. Create AuditEvent: trace_closed
      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: 'Trace completed with outcome: denied',
          status: 'closed',
        },
      });

      // 6. Finalize trace
      await tx.auditTrace.update({
        where: { id: approval.trace_id },
        data: {
          final_outcome: 'denied',
          completed_at: new Date(),
        },
      });

      // 7. Return with context
      return this.getApprovalWithContext(approvalRequestId, tenantId, tx as unknown as PrismaClient);
    });
  }

  async getApprovalWithContext(
    approvalRequestId: string,
    tenantId: string,
    db?: PrismaClient,
  ): Promise<ApprovalWithContext> {
    const client = db ?? this.prisma;

    const approval = await client.approvalRequest.findFirst({
      where: { id: approvalRequestId, tenant_id: tenantId },
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
      where: { trace_id: approval.trace_id, tenant_id: tenantId },
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
    };
  }

  async list(tenantId: string, filters: {
    status?: string;
    agent_id?: string;
    limit?: number;
    offset?: number;
  }) {
    const where = {
      tenant_id: tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.agent_id ? { agent_id: filters.agent_id } : {}),
    };

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    const [data, total] = await Promise.all([
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
    ]);

    return {
      data,
      pagination: { total, limit, offset },
    };
  }
}
