import type { DataClassification, EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import { ActionDeniedError, ApprovalTimeoutError, ApprovalExpiredError } from '../errors.js';
import { recordOutcome } from './langchain.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for Google ADK governance middleware.
 */
export interface GoogleADKGovernanceConfig {
  /** Override data classification per tool name. */
  dataClassification?: Record<string, DataClassification>;
  /** Default data classification when no per-tool override is set. */
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
 * Result of a governed Google ADK tool execution.
 * Contains the tool response plus governance metadata.
 */
export interface GovernedGoogleADKResult {
  /** The original tool execution result. */
  result: unknown;
  /** The SidClaw audit trace ID for this execution. */
  traceId: string;
  /** The SidClaw policy decision that permitted this execution. */
  decision: 'allow' | 'approval_required';
}

/**
 * Duck-typed interface for a Google ADK tool (TypeScript).
 * We do NOT import from @google/adk — this uses structural typing only.
 */
interface GoogleADKToolLike {
  name: string;
  description?: string;
  execute: (params: unknown) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveClassification(
  toolName: string,
  config?: GoogleADKGovernanceConfig,
): DataClassification {
  if (config?.dataClassification?.[toolName]) {
    return config.dataClassification[toolName];
  }
  return config?.defaultClassification ?? 'internal';
}

/**
 * Evaluates governance for a Google ADK tool and handles the full
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
async function evaluateGoogleADKGovernance(
  client: AgentIdentityClient,
  toolName: string,
  params: unknown,
  config?: GoogleADKGovernanceConfig,
): Promise<EvaluateResponse> {
  const classification = resolveClassification(toolName, config);

  const decision = await client.evaluate({
    operation: toolName,
    target_integration: 'google_adk',
    resource_scope: config?.resourceScope ?? 'google_adk',
    data_classification: classification,
    context: {
      google_adk_tool: toolName,
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
// Public API: governGoogleADKTool
// ---------------------------------------------------------------------------

/**
 * Wraps a Google ADK tool with SidClaw governance.
 *
 * The tool's `execute` function is intercepted: before execution,
 * SidClaw evaluates the policy. On allow, executes. On deny, throws
 * ActionDeniedError. On approval_required, waits (configurable).
 *
 * @example
 * ```typescript
 * import { AgentIdentityClient } from '@sidclaw/sdk';
 * import { governGoogleADKTool } from '@sidclaw/sdk/google-adk';
 *
 * const sidclaw = new AgentIdentityClient({ ... });
 *
 * const searchDocs = new Tool({
 *   name: 'search_docs',
 *   description: 'Search documentation',
 *   execute: async (params) => doSearch(params.query),
 * });
 *
 * const governed = governGoogleADKTool(sidclaw, searchDocs, {
 *   dataClassification: { search_docs: 'internal' },
 * });
 *
 * // governed.execute() now goes through SidClaw policy evaluation first
 * ```
 */
export function governGoogleADKTool(
  client: AgentIdentityClient,
  tool: GoogleADKToolLike,
  config?: GoogleADKGovernanceConfig,
): GoogleADKToolLike & { __sidclaw_governed: true } {
  const originalExecute = tool.execute.bind(tool);

  const governedTool: GoogleADKToolLike & { __sidclaw_governed: true } = {
    ...tool,
    __sidclaw_governed: true,
    execute: async (params: unknown): Promise<unknown> => {
      // 1. Evaluate governance
      const decision = await evaluateGoogleADKGovernance(client, tool.name, params, config);

      // 2. Execute the original tool
      try {
        const result = await originalExecute(params);
        // 3. Record success
        await recordOutcome(client, decision.trace_id);
        return result;
      } catch (error) {
        // 3. Record error
        await recordOutcome(client, decision.trace_id, error);
        throw error;
      }
    },
  };

  return governedTool;
}

// ---------------------------------------------------------------------------
// Public API: governGoogleADKTools
// ---------------------------------------------------------------------------

/**
 * Wraps an array of Google ADK tools with SidClaw governance.
 * Convenience function that calls `governGoogleADKTool` for each tool.
 *
 * @example
 * ```typescript
 * import { governGoogleADKTools } from '@sidclaw/sdk/google-adk';
 *
 * const governedTools = governGoogleADKTools(sidclaw, [searchDocs, createTicket], {
 *   defaultClassification: 'internal',
 * });
 *
 * const agent = new Agent({ tools: governedTools });
 * ```
 */
export function governGoogleADKTools(
  client: AgentIdentityClient,
  tools: GoogleADKToolLike[],
  config?: GoogleADKGovernanceConfig,
): (GoogleADKToolLike & { __sidclaw_governed: true })[] {
  return tools.map(tool => governGoogleADKTool(client, tool, config));
}
