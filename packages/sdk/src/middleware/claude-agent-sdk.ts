import type { DataClassification, EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import { ActionDeniedError, ApprovalTimeoutError, ApprovalExpiredError } from '../errors.js';
import { recordOutcome } from './langchain.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for Claude Agent SDK governance middleware.
 */
export interface ClaudeAgentGovernanceConfig {
  /** Data classification for governed tools. */
  dataClassification?: DataClassification;
  /** Resource scope sent to the policy engine. */
  resourceScope?: string;
  /** Target integration name override. Defaults to the tool name. */
  targetIntegration?: string;
  /** Whether to wait for human approval when decision is `approval_required`. */
  waitForApproval?: boolean;
  /** Timeout in milliseconds when waiting for approval (default: 300 000 = 5 min). */
  approvalTimeoutMs?: number;
  /** Polling interval in milliseconds when waiting for approval (default: 2 000). */
  approvalPollIntervalMs?: number;
}

/**
 * Result of a governed Claude Agent SDK tool execution.
 * Contains the tool result plus governance metadata.
 */
export interface GovernedClaudeAgentResult<T = unknown> {
  /** The original tool execution result. */
  result: T;
  /** The SidClaw audit trace ID for this execution. */
  traceId: string;
  /** The SidClaw policy decision that permitted this execution. */
  decision: 'allow' | 'approval_required';
}

/**
 * Duck-typed Claude Agent SDK tool definition.
 * Avoids a hard dependency on `@anthropic-ai/agent-sdk`.
 */
interface ClaudeAgentToolLike {
  /** Tool name used for policy matching. */
  name: string;
  /** Tool description. */
  description?: string;
  /** Execute function invoked by the Claude Agent SDK runtime. */
  execute: (args: unknown) => Promise<unknown>;
  /** Optional Zod-like schema for parameters. */
  parameters?: unknown;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Evaluates governance for a Claude Agent SDK tool invocation and handles the
 * full allow / deny / approval_required lifecycle.
 *
 * On `allow`: returns the EvaluateResponse immediately.
 * On `deny`: throws ActionDeniedError.
 * On `approval_required`:
 *   - If `waitForApproval` is true (default), polls until approved/denied/expired/timeout.
 *   - If approval is granted, returns the EvaluateResponse.
 *   - If approval is denied, throws ActionDeniedError.
 *   - If `waitForApproval` is false, throws ActionDeniedError with approval info.
 */
async function evaluateClaudeAgentGovernance(
  client: AgentIdentityClient,
  toolName: string,
  args: unknown,
  config?: ClaudeAgentGovernanceConfig,
): Promise<EvaluateResponse> {
  const decision = await client.evaluate({
    operation: toolName,
    target_integration: config?.targetIntegration ?? toolName,
    resource_scope: config?.resourceScope ?? 'claude_agent',
    data_classification: config?.dataClassification ?? 'internal',
    context: {
      framework: 'claude_agent_sdk',
      tool_name: toolName,
      args: typeof args === 'object' ? args : { raw: args },
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
// Public API: governClaudeAgentTool
// ---------------------------------------------------------------------------

/**
 * Wraps a Claude Agent SDK tool with SidClaw governance.
 *
 * Returns a new tool object with the same name, description, and parameters,
 * but with an `execute` function that evaluates governance before running the
 * original tool. On allow, executes and records success. On deny, throws
 * `ActionDeniedError`. On `approval_required`, waits for approval (configurable).
 *
 * @example
 * ```typescript
 * import { AgentIdentityClient } from '@sidclaw/sdk';
 * import { governClaudeAgentTool } from '@sidclaw/sdk/claude-agent-sdk';
 *
 * const sidclaw = new AgentIdentityClient({ ... });
 *
 * const searchTool = tool('search', {
 *   description: 'Search the knowledge base',
 *   parameters: z.object({ query: z.string() }),
 *   execute: async ({ query }) => {
 *     return await searchKnowledgeBase(query);
 *   },
 * });
 *
 * const governedSearch = governClaudeAgentTool(sidclaw, searchTool, {
 *   dataClassification: 'internal',
 * });
 * ```
 */
export function governClaudeAgentTool<T extends ClaudeAgentToolLike>(
  client: AgentIdentityClient,
  tool: T,
  config?: ClaudeAgentGovernanceConfig,
): T {
  const originalExecute = tool.execute.bind(tool);

  const wrappedTool = Object.create(Object.getPrototypeOf(tool));
  Object.assign(wrappedTool, tool);

  wrappedTool.execute = async (args: unknown): Promise<unknown> => {
    // 1. Evaluate governance
    const decision = await evaluateClaudeAgentGovernance(
      client,
      tool.name,
      args,
      config,
    );

    // 2. Execute the tool
    try {
      const result = await originalExecute(args);
      // 3. Record success
      await recordOutcome(client, decision.trace_id);
      return result;
    } catch (error) {
      // 3. Record error
      await recordOutcome(client, decision.trace_id, error);
      throw error;
    }
  };

  return wrappedTool as T;
}

// ---------------------------------------------------------------------------
// Public API: governClaudeAgentTools
// ---------------------------------------------------------------------------

/**
 * Wraps all tools in an array with SidClaw governance.
 * Uses each tool's name as the target integration unless overridden in config.
 *
 * @example
 * ```typescript
 * const governedTools = governClaudeAgentTools(sidclaw, [searchTool, writeTool], {
 *   dataClassification: 'confidential',
 * });
 * ```
 */
export function governClaudeAgentTools<T extends ClaudeAgentToolLike>(
  client: AgentIdentityClient,
  tools: T[],
  config?: Omit<ClaudeAgentGovernanceConfig, 'targetIntegration'>,
): T[] {
  return tools.map(tool =>
    governClaudeAgentTool(client, tool, { ...config, targetIntegration: tool.name }),
  );
}
