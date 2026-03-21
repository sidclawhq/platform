import type { DataClassification, EvaluateResponse } from '@agent-identity/shared';
import { AgentIdentityClient } from '../client/agent-identity-client.js';
import { ActionDeniedError, ApprovalExpiredError } from '../errors.js';

interface GovernanceConfig {
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: DataClassification;
  context?: Record<string, unknown>;
  /** Options for approval waiting (if the action requires approval) */
  approvalOptions?: {
    timeout?: number;
    pollInterval?: number;
  };
}

export type { GovernanceConfig };

/**
 * Wraps an async function with governance checks.
 * Before execution: evaluates the action against the policy engine.
 * - If allowed: executes the function, records outcome.
 * - If approval_required: waits for approval, then executes or throws.
 * - If denied: throws ActionDeniedError without executing.
 *
 * Returns a new function with the same signature that is governed.
 */
export function withGovernance<TArgs extends unknown[], TResult>(
  client: AgentIdentityClient,
  config: GovernanceConfig,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    // 1. Evaluate the action
    const decision: EvaluateResponse = await client.evaluate({
      operation: config.operation,
      target_integration: config.target_integration,
      resource_scope: config.resource_scope,
      data_classification: config.data_classification,
      context: config.context,
    });

    // 2. Handle deny
    if (decision.decision === 'deny') {
      throw new ActionDeniedError(
        decision.reason,
        decision.trace_id,
        decision.policy_rule_id
      );
    }

    // 3. Handle approval_required
    if (decision.decision === 'approval_required') {
      if (!decision.approval_request_id) {
        throw new Error('approval_required decision missing approval_request_id');
      }

      const approval = await client.waitForApproval(
        decision.approval_request_id,
        config.approvalOptions
      );

      if (approval.status === 'denied') {
        throw new ActionDeniedError(
          `Denied by reviewer: ${approval.decision_note ?? 'No reason provided'}`,
          decision.trace_id,
          decision.policy_rule_id
        );
      }

      if (approval.status === 'expired') {
        throw new ApprovalExpiredError(
          decision.approval_request_id,
          decision.trace_id
        );
      }

      // approved — fall through to execute
    }

    // 4. Execute the wrapped function
    try {
      const result = await fn(...args);
      await client.recordOutcome(decision.trace_id, {
        status: 'success',
      });
      return result;
    } catch (error) {
      await client.recordOutcome(decision.trace_id, {
        status: 'error',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  };
}
