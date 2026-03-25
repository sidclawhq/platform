import type { DataClassification, EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import { ActionDeniedError, ApprovalTimeoutError, ApprovalExpiredError } from '../errors.js';
import { recordOutcome } from './langchain.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for Composio governance middleware.
 */
export interface ComposioGovernanceConfig {
  /**
   * Override data classification per Composio toolkit slug.
   * Keys are uppercase toolkit slugs (e.g., "SALESFORCE", "GMAIL").
   */
  dataClassification?: Record<string, DataClassification>;
  /** Default data classification when no per-toolkit override is set. */
  defaultClassification?: DataClassification;
  /** Resource scope sent to the policy engine. */
  resourceScope?: string;
  /** Whether to wait for human approval when decision is `approval_required`. */
  waitForApproval?: boolean;
  /** Timeout in milliseconds when waiting for approval (default: 300 000 = 5 min). */
  approvalTimeoutMs?: number;
  /** Polling interval in milliseconds when waiting for approval (default: 2 000). */
  approvalPollIntervalMs?: number;
}

/**
 * Result of a governed Composio tool execution.
 * Contains the Composio response plus governance metadata.
 */
export interface GovernedComposioResult {
  /** The original Composio execution result. */
  result: unknown;
  /** The SidClaw audit trace ID for this execution. */
  traceId: string;
  /** The SidClaw policy decision that permitted this execution. */
  decision: 'allow' | 'approval_required';
}

/**
 * Context passed to Composio beforeExecute/afterExecute modifiers.
 */
interface ComposioModifierContext {
  toolSlug: string;
  toolkitSlug: string;
  params: unknown;
}

interface ComposioAfterExecuteContext {
  toolSlug: string;
  toolkitSlug: string;
  result: unknown;
}

// ---------------------------------------------------------------------------
// Slug-to-Policy mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Composio tool slug (e.g., `GITHUB_CREATE_ISSUE`) to SidClaw policy fields.
 *
 * Convention:
 * - First segment = toolkit (target_integration): `github`
 * - Remaining segments = action (operation): `create_issue`
 */
export function mapComposioSlug(slug: string): {
  operation: string;
  target_integration: string;
} {
  const parts = slug.split('_');
  if (parts.length < 2) {
    // Single-word slug: use as both operation and integration
    const lower = slug.toLowerCase();
    return { operation: lower, target_integration: lower };
  }
  const toolkit = parts[0]!.toLowerCase();
  const action = parts.slice(1).join('_').toLowerCase();
  return { operation: action, target_integration: toolkit };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveClassification(
  toolkitSlug: string,
  config?: ComposioGovernanceConfig,
): DataClassification {
  const upper = toolkitSlug.toUpperCase();
  if (config?.dataClassification?.[upper]) {
    return config.dataClassification[upper];
  }
  return config?.defaultClassification ?? 'internal';
}

/**
 * Evaluates governance for a Composio tool slug and handles the full
 * allow / deny / approval_required lifecycle.
 *
 * On `allow`: returns the EvaluateResponse immediately.
 * On `deny`: throws ActionDeniedError.
 * On `approval_required`:
 *   - If `waitForApproval` is true (default), polls until approved/denied/expired/timeout.
 *   - If approval is granted, returns the EvaluateResponse.
 *   - If approval is denied, throws ActionDeniedError.
 *   - If `waitForApproval` is false, throws ActionDeniedError with approval info.
 */
async function evaluateComposioGovernance(
  client: AgentIdentityClient,
  slug: string,
  params: unknown,
  config?: ComposioGovernanceConfig,
): Promise<EvaluateResponse> {
  const { operation, target_integration } = mapComposioSlug(slug);
  const classification = resolveClassification(target_integration, config);

  const decision = await client.evaluate({
    operation,
    target_integration,
    resource_scope: config?.resourceScope ?? 'composio_managed',
    data_classification: classification,
    context: {
      composio_slug: slug,
      params: typeof params === 'object' ? params : { raw: params },
    },
  });

  if (decision.decision === 'allow') {
    return decision;
  }

  if (decision.decision === 'deny') {
    throw new ActionDeniedError(
      decision.reason,
      decision.trace_id,
      decision.policy_rule_id,
    );
  }

  // decision === 'approval_required'
  const shouldWait = config?.waitForApproval ?? true;

  if (!shouldWait || !decision.approval_request_id) {
    throw new ActionDeniedError(
      `Approval required: ${decision.reason}. Approval ID: ${decision.approval_request_id}`,
      decision.trace_id,
      decision.policy_rule_id,
    );
  }

  // Poll for approval
  const timeoutMs = config?.approvalTimeoutMs ?? 300_000;
  const pollIntervalMs = config?.approvalPollIntervalMs ?? 2_000;

  try {
    const status = await client.waitForApproval(decision.approval_request_id, {
      timeout: timeoutMs,
      pollInterval: pollIntervalMs,
    });

    if (status.status === 'approved') {
      return decision;
    }

    // denied
    throw new ActionDeniedError(
      `Approval denied${status.decision_note ? `: ${status.decision_note}` : ''}`,
      decision.trace_id,
      decision.policy_rule_id,
    );
  } catch (error) {
    if (error instanceof ActionDeniedError) throw error;
    if (error instanceof ApprovalTimeoutError) throw error;
    if (error instanceof ApprovalExpiredError) throw error;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public API: governComposioExecution
// ---------------------------------------------------------------------------

/**
 * Wraps a Composio `tools.execute` call with SidClaw governance.
 *
 * Returns a function with the same signature as `composio.tools.execute()`
 * but with policy evaluation before execution and audit logging after.
 *
 * @example
 * ```typescript
 * import { AgentIdentityClient } from '@sidclaw/sdk';
 * import { governComposioExecution } from '@sidclaw/sdk/composio';
 * import { Composio } from '@composio/core';
 *
 * const sidclaw = new AgentIdentityClient({ ... });
 * const composio = new Composio({ apiKey: '...' });
 *
 * const execute = governComposioExecution(sidclaw, composio, {
 *   dataClassification: { SALESFORCE: 'confidential', GITHUB: 'internal' },
 * });
 *
 * // Uses SidClaw governance before executing via Composio
 * const result = await execute('GITHUB_CREATE_ISSUE', {
 *   userId: 'user_123',
 *   arguments: { owner: 'org', repo: 'project', title: 'Bug fix' },
 * });
 * ```
 */
export function governComposioExecution(
  client: AgentIdentityClient,
  composio: { tools: { execute: (...args: unknown[]) => Promise<unknown> } },
  config?: ComposioGovernanceConfig,
): (slug: string, params: Record<string, unknown>) => Promise<GovernedComposioResult> {
  return async (slug: string, params: Record<string, unknown>): Promise<GovernedComposioResult> => {
    // 1. Evaluate governance
    const decision = await evaluateComposioGovernance(client, slug, params, config);

    // 2. Execute via Composio
    try {
      const result = await composio.tools.execute(slug, params);
      // 3. Record success
      await recordOutcome(client, decision.trace_id);
      return { result, traceId: decision.trace_id, decision: decision.decision as 'allow' | 'approval_required' };
    } catch (error) {
      // 3. Record error
      await recordOutcome(client, decision.trace_id, error);
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Public API: createComposioGovernanceModifiers
// ---------------------------------------------------------------------------

/**
 * In-flight governance state keyed by `toolSlug` so that `afterExecute`
 * can record the outcome to the correct trace.
 */
interface InflightEntry {
  traceId: string;
}

/**
 * Creates `beforeExecute` and `afterExecute` modifier functions for
 * Composio's modifier system.
 *
 * The `beforeExecute` modifier evaluates governance. If the action is
 * denied, it throws `ActionDeniedError`, preventing execution. The
 * `afterExecute` modifier records the outcome to the SidClaw audit trace.
 *
 * @example
 * ```typescript
 * const modifiers = createComposioGovernanceModifiers(sidclaw, {
 *   dataClassification: { GMAIL: 'confidential' },
 * });
 *
 * const result = await composio.tools.execute('GMAIL_SEND_EMAIL', {
 *   userId: 'user_123',
 *   arguments: { to: 'user@example.com', subject: 'Hello' },
 * }, modifiers);
 * ```
 */
export function createComposioGovernanceModifiers(
  client: AgentIdentityClient,
  config?: ComposioGovernanceConfig,
): {
  beforeExecute: (ctx: ComposioModifierContext) => Promise<unknown>;
  afterExecute: (ctx: ComposioAfterExecuteContext) => Promise<unknown>;
} {
  // Track in-flight governance decisions so afterExecute can record outcome
  const inflight = new Map<string, InflightEntry>();

  return {
    beforeExecute: async (ctx: ComposioModifierContext): Promise<unknown> => {
      const decision = await evaluateComposioGovernance(
        client,
        ctx.toolSlug,
        ctx.params,
        config,
      );

      inflight.set(ctx.toolSlug, { traceId: decision.trace_id });

      // Return params to continue execution
      return ctx.params;
    },

    afterExecute: async (ctx: ComposioAfterExecuteContext): Promise<unknown> => {
      const entry = inflight.get(ctx.toolSlug);
      if (entry) {
        inflight.delete(ctx.toolSlug);
        await recordOutcome(client, entry.traceId);
      }
      return ctx.result;
    },
  };
}
