import type { PrismaClient } from '../generated/prisma/index.js';
import type { PolicyEffect, DataClassification } from '@agent-identity/shared';

interface EvaluateAction {
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: DataClassification;
}

interface PolicyDecision {
  effect: PolicyEffect;
  rule_id: string | null;
  rationale: string;
  policy_version: number | null;
}

export type { EvaluateAction, PolicyDecision };

export class PolicyEngine {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Evaluate an action for a given agent against the policy rules.
   *
   * Evaluation order:
   * 1. Check agent lifecycle state — deny if not active
   * 2. Load all active policy rules for the agent, ordered by priority DESC
   * 3. Find the first matching rule
   * 4. If no match: default deny (secure by default)
   */
  async evaluate(agentId: string, tenantId: string, action: EvaluateAction): Promise<PolicyDecision> {
    // Step 1: Lifecycle check
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenant_id: tenantId },
      select: { lifecycle_state: true, name: true },
    });

    if (!agent) {
      return {
        effect: 'deny',
        rule_id: null,
        rationale: `Agent '${agentId}' not found`,
        policy_version: null,
      };
    }

    if (agent.lifecycle_state !== 'active') {
      return {
        effect: 'deny',
        rule_id: null,
        rationale: `Agent '${agent.name}' is ${agent.lifecycle_state} — all actions are denied`,
        policy_version: null,
      };
    }

    // Step 2: Load active policy rules, highest priority first
    const rules = await this.prisma.policyRule.findMany({
      where: {
        agent_id: agentId,
        tenant_id: tenantId,
        is_active: true,
      },
      orderBy: { priority: 'desc' },
    });

    // Step 3: Find first matching rule
    for (const rule of rules) {
      if (this.matchesRule(rule, action)) {
        return {
          effect: rule.policy_effect as PolicyEffect,
          rule_id: rule.id,
          rationale: rule.rationale,
          policy_version: rule.policy_version,
        };
      }
    }

    // Step 4: No match — default deny
    return {
      effect: 'deny',
      rule_id: null,
      rationale: `No policy rule matches this action — denied by default (secure by default)`,
      policy_version: null,
    };
  }

  /**
   * Check if a policy rule matches an action.
   *
   * Matching criteria:
   * 1. Operation: exact match
   * 2. Target integration: exact match
   * 3. Resource scope: exact match OR rule has wildcard '*'
   * 4. Data classification: rule applies to its level and below
   *    Hierarchy: restricted(4) > confidential(3) > internal(2) > public(1)
   *    A rule for 'confidential' matches actions classified as confidential, internal, or public.
   *    A rule for 'restricted' matches everything.
   *    A rule for 'public' matches only 'public' actions.
   */
  private matchesRule(
    rule: { operation: string; target_integration: string; resource_scope: string; data_classification: string },
    action: EvaluateAction
  ): boolean {
    // 1. Operation must match exactly
    if (rule.operation !== action.operation) return false;

    // 2. Target integration must match exactly
    if (rule.target_integration !== action.target_integration) return false;

    // 3. Resource scope: exact match or wildcard
    if (rule.resource_scope !== '*' && rule.resource_scope !== action.resource_scope) return false;

    // 4. Data classification hierarchy
    const ruleLevel = this.classificationLevel(rule.data_classification as DataClassification);
    const actionLevel = this.classificationLevel(action.data_classification);
    if (actionLevel > ruleLevel) return false;

    return true;
  }

  /**
   * Returns the numeric level for a data classification.
   * Higher number = more sensitive.
   */
  private classificationLevel(classification: DataClassification): number {
    const levels: Record<DataClassification, number> = {
      public: 1,
      internal: 2,
      confidential: 3,
      restricted: 4,
    };
    return levels[classification] ?? 0;
  }
}
