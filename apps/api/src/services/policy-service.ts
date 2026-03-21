import type { PrismaClient } from '../generated/prisma/index.js';
import { Prisma } from '../generated/prisma/index.js';
import type { PolicyRuleCreateInput, PolicyRuleUpdateInput } from '@agent-identity/shared';
import { NotFoundError } from '../errors.js';
import { WebhookService } from './webhook-service.js';

export class PolicyService {
  private readonly webhookService: WebhookService;

  constructor(private readonly prisma: PrismaClient) {
    this.webhookService = new WebhookService(prisma);
  }

  async create(tenantId: string, data: PolicyRuleCreateInput) {
    return this.prisma.policyRule.create({
      data: {
        tenant_id: tenantId,
        ...data,
        conditions: data.conditions != null ? data.conditions as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
        policy_version: 1,
        is_active: true,
      },
    });
  }

  async list(tenantId: string, filters: {
    agent_id?: string;
    effect?: string;
    data_classification?: string;
    is_active?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { tenant_id: tenantId };
    if (filters.agent_id) where.agent_id = filters.agent_id;
    if (filters.effect) where.policy_effect = filters.effect;
    if (filters.data_classification) where.data_classification = filters.data_classification;
    if (filters.is_active !== undefined) where.is_active = filters.is_active;
    else where.is_active = true; // default: only active policies
    if (filters.search) {
      where.OR = [
        { policy_name: { contains: filters.search, mode: 'insensitive' } },
        { rationale: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const limit = Math.min(filters.limit ?? 50, 100);
    const offset = filters.offset ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.policyRule.findMany({
        where,
        include: { agent: { select: { id: true, name: true } } },
        orderBy: [{ agent_id: 'asc' }, { priority: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.policyRule.count({ where }),
    ]);

    return { data, pagination: { total, limit, offset } };
  }

  async getById(tenantId: string, policyId: string) {
    const policy = await this.prisma.policyRule.findFirst({
      where: { id: policyId, tenant_id: tenantId },
      include: { agent: { select: { id: true, name: true } } },
    });
    if (!policy) throw new NotFoundError('PolicyRule', policyId);
    return policy;
  }

  async update(tenantId: string, policyId: string, data: PolicyRuleUpdateInput, modifiedBy: string) {
    const existing = await this.getById(tenantId, policyId);
    const changeSummary = this.generateChangeSummary(existing, data);

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Snapshot current state to PolicyRuleVersion
      await tx.policyRuleVersion.create({
        data: {
          policy_rule_id: existing.id,
          version: existing.policy_version,
          policy_name: existing.policy_name,
          operation: existing.operation,
          target_integration: existing.target_integration,
          resource_scope: existing.resource_scope,
          data_classification: existing.data_classification,
          policy_effect: existing.policy_effect,
          rationale: existing.rationale,
          priority: existing.priority,
          max_session_ttl: existing.max_session_ttl,
          modified_by: existing.modified_by,
          modified_at: existing.modified_at,
          change_summary: changeSummary,
        },
      });

      // 2. Update the policy rule with incremented version
      const { conditions: dataConditions, ...dataWithoutConditions } = data;
      const result = await tx.policyRule.update({
        where: { id: policyId },
        data: {
          ...dataWithoutConditions,
          ...(dataConditions !== undefined ? {
            conditions: dataConditions != null ? dataConditions as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
          } : {}),
          policy_version: existing.policy_version + 1,
          modified_by: modifiedBy,
          modified_at: new Date(),
        },
        include: { agent: { select: { id: true, name: true } } },
      });

      // 3. Create pseudo audit trace + event for policy change
      const trace = await tx.auditTrace.create({
        data: {
          tenant_id: tenantId,
          agent_id: existing.agent_id,
          authority_model: 'self',
          requested_operation: 'policy_update',
          target_integration: 'governance',
          resource_scope: policyId,
          final_outcome: 'executed',
          completed_at: new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: existing.agent_id,
          event_type: 'policy_evaluated',
          actor_type: 'human_reviewer',
          actor_name: modifiedBy,
          description: `Policy "${existing.policy_name}" updated: v${existing.policy_version} → v${result.policy_version}`,
          status: 'updated',
          policy_version: result.policy_version,
          metadata: {
            change_summary: changeSummary,
            previous_version: existing.policy_version,
            policy_rule_id: policyId,
          },
        },
      });

      return result;
    });

    // Webhook dispatch — AFTER transaction commits
    this.webhookService.dispatch(tenantId, 'policy.updated', {
      policy: {
        id: policyId,
        policy_name: updated.policy_name,
        change_summary: changeSummary,
      },
    }).catch(() => {});

    return updated;
  }

  async softDelete(tenantId: string, policyId: string, modifiedBy: string) {
    await this.getById(tenantId, policyId);
    return this.prisma.policyRule.update({
      where: { id: policyId },
      data: {
        is_active: false,
        modified_by: modifiedBy,
        modified_at: new Date(),
      },
    });
  }

  async getVersions(tenantId: string, policyId: string, limit = 20, offset = 0) {
    await this.getById(tenantId, policyId); // verify access

    const [data, total] = await Promise.all([
      this.prisma.policyRuleVersion.findMany({
        where: { policy_rule_id: policyId },
        orderBy: { version: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.policyRuleVersion.count({ where: { policy_rule_id: policyId } }),
    ]);

    return { data, pagination: { total, limit, offset } };
  }

  async testEvaluate(tenantId: string, input: {
    agent_id: string;
    operation: string;
    target_integration: string;
    resource_scope: string;
    data_classification: string;
  }) {
    // Dry-run: evaluate without creating a trace
    const { PolicyEngine } = await import('./policy-engine.js');
    const engine = new PolicyEngine(this.prisma);
    return engine.evaluate(input.agent_id, tenantId, {
      operation: input.operation,
      target_integration: input.target_integration,
      resource_scope: input.resource_scope,
      data_classification: input.data_classification as any,
    });
  }

  private generateChangeSummary(
    existing: any,
    updates: Record<string, unknown>
  ): string {
    const changes: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && existing[key] !== value) {
        changes.push(`${key}: '${existing[key]}' → '${value}'`);
      }
    }
    return changes.length > 0 ? changes.join('; ') : 'No changes detected';
  }
}
