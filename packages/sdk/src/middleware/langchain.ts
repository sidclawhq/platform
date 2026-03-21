import type { DataClassification, EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import { ActionDeniedError } from '../errors.js';

/**
 * Configuration for governing framework tools.
 */
export interface GovernedToolConfig {
  client: AgentIdentityClient;
  target_integration?: string;
  resource_scope?: string;
  data_classification?: DataClassification;
}

/**
 * Evaluates an action against governance policies and handles deny/approval_required.
 * Returns the decision (with trace_id) on allow so the caller can record outcome.
 * Throws ActionDeniedError on deny or approval_required.
 *
 * Shared by all framework wrappers.
 */
export async function evaluateGovernance(
  client: AgentIdentityClient,
  operation: string,
  config: GovernedToolConfig,
  context?: Record<string, unknown>
): Promise<EvaluateResponse> {
  const decision = await client.evaluate({
    operation,
    target_integration: config.target_integration ?? operation,
    resource_scope: config.resource_scope ?? '*',
    data_classification: config.data_classification ?? 'internal',
    context,
  });

  if (decision.decision === 'deny') {
    throw new ActionDeniedError(
      decision.reason,
      decision.trace_id,
      decision.policy_rule_id
    );
  }

  if (decision.decision === 'approval_required') {
    throw new ActionDeniedError(
      `Approval required: ${decision.reason}. Approval ID: ${decision.approval_request_id}`,
      decision.trace_id,
      decision.policy_rule_id
    );
  }

  return decision;
}

/**
 * Records the outcome of an action after execution.
 */
export async function recordOutcome(
  client: AgentIdentityClient,
  traceId: string,
  error?: unknown
): Promise<void> {
  if (error) {
    await client.recordOutcome(traceId, {
      status: 'error',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
  } else {
    await client.recordOutcome(traceId, { status: 'success' });
  }
}

// ---- LangChain.js wrapper ----

/**
 * Interface representing a LangChain-compatible tool.
 * Used to avoid a hard dependency on @langchain/core.
 */
interface LangChainToolLike {
  name: string;
  description: string;
  schema?: unknown;
  returnDirect?: boolean;
  metadata?: Record<string, unknown>;
  invoke(input: unknown, config?: unknown): Promise<unknown>;
}

/**
 * Wraps a LangChain Tool with governance.
 * Evaluates before execution, records outcome after.
 * Throws ActionDeniedError on deny or approval_required.
 *
 * The wrapped tool preserves the original name, description, and schema.
 */
export function governTool<T extends LangChainToolLike>(
  tool: T,
  config: GovernedToolConfig
): T {
  const originalInvoke = tool.invoke.bind(tool);

  const wrappedTool = Object.create(Object.getPrototypeOf(tool));
  Object.assign(wrappedTool, tool);

  wrappedTool.invoke = async (input: unknown, runConfig?: unknown): Promise<unknown> => {
    const decision = await evaluateGovernance(
      config.client,
      tool.name,
      { ...config, target_integration: config.target_integration ?? tool.name },
      { input, tool_description: tool.description }
    );

    try {
      const result = await originalInvoke(input, runConfig);
      await recordOutcome(config.client, decision.trace_id);
      return result;
    } catch (error) {
      await recordOutcome(config.client, decision.trace_id, error);
      throw error;
    }
  };

  return wrappedTool as T;
}

/**
 * Wraps all tools in an array with governance.
 * Uses each tool's name as the target_integration.
 */
export function governTools<T extends LangChainToolLike>(
  tools: T[],
  config: Omit<GovernedToolConfig, 'target_integration'>
): T[] {
  return tools.map(tool =>
    governTool(tool, { ...config, target_integration: tool.name })
  );
}
