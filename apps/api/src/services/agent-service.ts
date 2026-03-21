import type { PrismaClient, Prisma } from '../generated/prisma/index.js';
import type { AgentCreateInput, AgentUpdateInput } from '@agent-identity/shared';
import { NotFoundError, ValidationError } from '../errors.js';
import { WebhookService } from './webhook-service.js';

// Valid lifecycle transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [], // terminal state — no transitions out
};

interface AgentListFilters {
  environment?: string;
  lifecycle_state?: string;
  authority_model?: string;
  autonomy_tier?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class AgentService {
  private readonly webhookService: WebhookService;

  constructor(private readonly prisma: PrismaClient) {
    this.webhookService = new WebhookService(prisma);
  }

  async create(tenantId: string, data: AgentCreateInput) {
    // Strip credential_config — not in Prisma schema yet
    const { credential_config, metadata, authorized_integrations, ...rest } = data as AgentCreateInput & { credential_config?: unknown };

    return this.prisma.agent.create({
      data: {
        tenant_id: tenantId,
        ...rest,
        authorized_integrations: authorized_integrations as Prisma.InputJsonValue,
        metadata: metadata === null ? undefined : (metadata as Prisma.InputJsonValue),
        lifecycle_state: 'active', // enforced, not settable
      },
    });
  }

  async list(tenantId: string, filters: AgentListFilters) {
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (filters.environment) where.environment = filters.environment;
    if (filters.lifecycle_state) where.lifecycle_state = filters.lifecycle_state;
    if (filters.authority_model) where.authority_model = filters.authority_model;
    if (filters.autonomy_tier) where.autonomy_tier = filters.autonomy_tier;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { owner_name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = filters.offset ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.agent.count({ where }),
    ]);

    return { data, pagination: { total, limit, offset } };
  }

  async getById(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenant_id: tenantId },
    });
    if (!agent) throw new NotFoundError('Agent', agentId);
    return agent;
  }

  async getDetail(tenantId: string, agentId: string) {
    const agent = await this.getById(tenantId, agentId);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const [policyCounts, pendingApprovals, tracesLast7Days, lastTrace, recentTraces, recentApprovals] = await Promise.all([
      this.prisma.policyRule.groupBy({
        by: ['policy_effect'],
        where: { agent_id: agentId, tenant_id: tenantId, is_active: true },
        _count: true,
      }),
      this.prisma.approvalRequest.count({
        where: { agent_id: agentId, tenant_id: tenantId, status: 'pending' },
      }),
      this.prisma.auditTrace.count({
        where: { agent_id: agentId, tenant_id: tenantId, started_at: { gte: sevenDaysAgo }, deleted_at: null },
      }),
      this.prisma.auditTrace.findFirst({
        where: { agent_id: agentId, tenant_id: tenantId, deleted_at: null },
        orderBy: { started_at: 'desc' },
        select: { started_at: true },
      }),
      this.prisma.auditTrace.findMany({
        where: { agent_id: agentId, tenant_id: tenantId, deleted_at: null },
        orderBy: { started_at: 'desc' },
        take: 10,
        select: { id: true, requested_operation: true, final_outcome: true, started_at: true },
      }),
      this.prisma.approvalRequest.findMany({
        where: { agent_id: agentId, tenant_id: tenantId },
        orderBy: { requested_at: 'desc' },
        take: 5,
        select: { id: true, requested_operation: true, status: true, requested_at: true },
      }),
    ]);

    const policyCount = {
      allow: policyCounts.find(p => p.policy_effect === 'allow')?._count ?? 0,
      approval_required: policyCounts.find(p => p.policy_effect === 'approval_required')?._count ?? 0,
      deny: policyCounts.find(p => p.policy_effect === 'deny')?._count ?? 0,
    };

    return {
      data: {
        ...agent,
        stats: {
          policy_count: policyCount,
          pending_approvals: pendingApprovals,
          traces_last_7_days: tracesLast7Days,
          last_activity_at: lastTrace?.started_at?.toISOString() ?? null,
        },
        recent_traces: recentTraces.map(t => ({
          trace_id: t.id,
          operation: t.requested_operation,
          final_outcome: t.final_outcome,
          started_at: t.started_at.toISOString(),
        })),
        recent_approvals: recentApprovals.map(a => ({
          id: a.id,
          operation: a.requested_operation,
          status: a.status,
          requested_at: a.requested_at.toISOString(),
        })),
      },
    };
  }

  async update(tenantId: string, agentId: string, data: Partial<AgentUpdateInput>) {
    await this.getById(tenantId, agentId); // throws NotFoundError
    // Do not allow updating lifecycle_state via PATCH — use lifecycle endpoints
    // Also strip credential_config — not in Prisma schema yet
    const { lifecycle_state, credential_config, id, tenant_id, ...updateData } = data as Record<string, unknown>;
    return this.prisma.agent.update({
      where: { id: agentId },
      data: updateData,
    });
  }

  async changeLifecycle(
    tenantId: string,
    agentId: string,
    targetState: string,
    action: string, // 'suspend' | 'revoke' | 'reactivate'
  ) {
    const agent = await this.getById(tenantId, agentId);
    const currentState = agent.lifecycle_state;

    // Validate transition
    const allowed = VALID_TRANSITIONS[currentState] ?? [];
    if (!allowed.includes(targetState)) {
      throw new ValidationError(
        `Cannot ${action} agent: invalid transition from '${currentState}' to '${targetState}'`,
        {
          error: 'invalid_lifecycle_transition',
          current_state: currentState,
          attempted_action: action,
          target_state: targetState,
          valid_transitions: allowed,
        },
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.agent.update({
        where: { id: agentId },
        data: { lifecycle_state: targetState },
      });

      // Create a pseudo-trace for the lifecycle event (FK constraint requires a real trace)
      const trace = await tx.auditTrace.create({
        data: {
          tenant_id: tenantId,
          agent_id: agentId,
          authority_model: agent.authority_model,
          requested_operation: `lifecycle:${action}`,
          target_integration: 'system',
          resource_scope: '*',
          final_outcome: 'executed',
          completed_at: new Date(),
        },
      });

      const event = await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: agentId,
          event_type: 'lifecycle_changed',
          actor_type: 'human_reviewer',
          actor_name: 'Dashboard User', // TODO(P3.4): Use authenticated user
          description: `Agent lifecycle changed: ${currentState} → ${targetState} (${action})`,
          status: targetState,
          metadata: {
            previous_state: currentState,
            new_state: targetState,
            action,
          },
        },
      });

      return { data: updated, event };
    });

    // Webhook dispatch — AFTER transaction commits
    const webhookEvent = targetState === 'suspended' ? 'agent.suspended' as const : 'agent.revoked' as const;
    if (targetState === 'suspended' || targetState === 'revoked') {
      this.webhookService.dispatch(tenantId, webhookEvent, {
        agent: {
          id: agentId,
          name: agent.name,
          previous_state: currentState,
          new_state: targetState,
        },
      }).catch(() => {});
    }

    return result;
  }
}
