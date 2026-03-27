import type { DataClassification, EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import { ActionDeniedError, ApprovalTimeoutError, ApprovalExpiredError } from '../errors.js';
import { recordOutcome } from './langchain.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Duck-typed NemoClaw tool definition.
 * Any object with a `name` and either an `execute` or `invoke` method.
 * Avoids a hard dependency on NemoClaw packages.
 */
export interface NemoClawToolLike {
  /** Tool name used for policy matching. */
  name: string;
  /** Tool description. */
  description?: string;
  /** Execute function (primary method). */
  execute?: (args: unknown) => Promise<unknown>;
  /** Invoke function (alternative method). */
  invoke?: (args: unknown) => Promise<unknown>;
  /** Optional schema for parameters. */
  parameters?: unknown;
}

/**
 * Configuration for NemoClaw governance middleware.
 */
export interface NemoClawGovernanceConfig {
  /**
   * Data classification for governed tools.
   * Can be a single DataClassification (applied to all tools)
   * or a Record<string, DataClassification> keyed by tool name.
   */
  dataClassification?: DataClassification | Record<string, DataClassification>;
  /** Default data classification when tool is not in per-tool Record. Defaults to `'internal'`. */
  defaultClassification?: DataClassification;
  /** Resource scope sent to the policy engine. Defaults to `'nemoclaw_sandbox'`. */
  resourceScope?: string;
  /** Optional sandbox name, included in the context object sent to evaluate. */
  sandboxName?: string;
  /** Whether to wait for human approval when decision is `approval_required`. Defaults to `false`. */
  waitForApproval?: boolean;
  /** Timeout in milliseconds when waiting for approval (default: 300 000 = 5 min). */
  approvalTimeoutMs?: number;
  /** Polling interval in milliseconds when waiting for approval (default: 2 000). */
  approvalPollIntervalMs?: number;
}

/**
 * Configuration for generating an MCP proxy config (openclaw.json).
 */
export interface NemoClawProxyConfig {
  /** SidClaw API key. */
  apiKey: string;
  /** SidClaw agent ID. */
  agentId: string;
  /** Command for the upstream MCP server (e.g., 'npx', 'node'). */
  upstreamCommand: string;
  /** Arguments for the upstream MCP server command. */
  upstreamArgs: string[];
  /** SidClaw API URL. Defaults to `'https://api.sidclaw.com'`. */
  apiUrl?: string;
  /** Server name in the generated config. Defaults to `'governed'`. */
  serverName?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveClassification(
  toolName: string,
  config?: NemoClawGovernanceConfig,
): DataClassification {
  const dc = config?.dataClassification;
  if (!dc) {
    return config?.defaultClassification ?? 'internal';
  }
  // Single string classification applies to all tools
  if (typeof dc === 'string') {
    return dc;
  }
  // Record<string, DataClassification>: look up by tool name
  if (dc[toolName]) {
    return dc[toolName];
  }
  return config?.defaultClassification ?? 'internal';
}

/**
 * Evaluates governance for a NemoClaw tool invocation and handles the full
 * allow / deny / approval_required lifecycle.
 *
 * On `allow`: returns the EvaluateResponse immediately.
 * On `deny`: throws ActionDeniedError.
 * On `approval_required`:
 *   - If `waitForApproval` is true, polls until approved/denied/expired/timeout.
 *   - If approval is granted, returns the EvaluateResponse.
 *   - If approval is denied, throws ActionDeniedError.
 *   - If `waitForApproval` is false (default), throws ActionDeniedError with approval info.
 */
async function evaluateNemoClawGovernance(
  client: AgentIdentityClient,
  toolName: string,
  args: unknown,
  config?: NemoClawGovernanceConfig,
): Promise<EvaluateResponse> {
  const classification = resolveClassification(toolName, config);

  const context: Record<string, unknown> = {
    tool_name: toolName,
    tool_params: typeof args === 'object' ? args : { raw: args },
    runtime: 'nemoclaw',
  };

  if (config?.sandboxName) {
    context.sandbox_name = config.sandboxName;
  }

  const decision = await client.evaluate({
    operation: toolName,
    target_integration: 'nemoclaw',
    resource_scope: config?.resourceScope ?? 'nemoclaw_sandbox',
    data_classification: classification,
    context,
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
  const shouldWait = config?.waitForApproval ?? false;

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
// Public API: governNemoClawTool
// ---------------------------------------------------------------------------

/**
 * Wraps a single NemoClaw tool with SidClaw governance.
 *
 * Returns a new tool object with the same name, description, and parameters,
 * but with `execute` and/or `invoke` functions that evaluate governance before
 * running the original tool. On allow, executes and records success. On deny,
 * throws `ActionDeniedError`. On `approval_required`, waits for approval
 * (configurable, defaults to false).
 *
 * The returned tool has a `__sidclaw_governed: true` property for identification.
 *
 * @example
 * ```typescript
 * import { AgentIdentityClient } from '@sidclaw/sdk';
 * import { governNemoClawTool } from '@sidclaw/sdk/nemoclaw';
 *
 * const sidclaw = new AgentIdentityClient({ ... });
 *
 * const queryTool = {
 *   name: 'run_query',
 *   execute: async (args) => sandbox.runQuery(args.sql),
 * };
 *
 * const governed = governNemoClawTool(sidclaw, queryTool, {
 *   sandboxName: 'finance-sandbox-01',
 *   dataClassification: 'confidential',
 * });
 * ```
 */
export function governNemoClawTool<T extends NemoClawToolLike>(
  client: AgentIdentityClient,
  tool: T,
  config?: NemoClawGovernanceConfig,
): T & { __sidclaw_governed: true } {
  const wrappedTool = Object.create(Object.getPrototypeOf(tool));
  Object.assign(wrappedTool, tool);
  wrappedTool.__sidclaw_governed = true;

  // Wrap execute method if present
  if (tool.execute) {
    const originalExecute = tool.execute.bind(tool);
    wrappedTool.execute = async (args: unknown): Promise<unknown> => {
      const decision = await evaluateNemoClawGovernance(client, tool.name, args, config);

      try {
        const result = await originalExecute(args);
        await recordOutcome(client, decision.trace_id);
        return result;
      } catch (error) {
        await recordOutcome(client, decision.trace_id, error);
        throw error;
      }
    };
  }

  // Wrap invoke method if present
  if (tool.invoke) {
    const originalInvoke = tool.invoke.bind(tool);
    wrappedTool.invoke = async (args: unknown): Promise<unknown> => {
      const decision = await evaluateNemoClawGovernance(client, tool.name, args, config);

      try {
        const result = await originalInvoke(args);
        await recordOutcome(client, decision.trace_id);
        return result;
      } catch (error) {
        await recordOutcome(client, decision.trace_id, error);
        throw error;
      }
    };
  }

  return wrappedTool as T & { __sidclaw_governed: true };
}

// ---------------------------------------------------------------------------
// Public API: governNemoClawTools
// ---------------------------------------------------------------------------

/**
 * Wraps all tools in an array with SidClaw governance.
 *
 * @example
 * ```typescript
 * const governedTools = governNemoClawTools(sidclaw, [queryTool, deployTool], {
 *   dataClassification: 'confidential',
 *   sandboxName: 'prod-sandbox',
 * });
 * ```
 */
export function governNemoClawTools<T extends NemoClawToolLike>(
  client: AgentIdentityClient,
  tools: T[],
  config?: NemoClawGovernanceConfig,
): (T & { __sidclaw_governed: true })[] {
  return tools.map(tool => governNemoClawTool(client, tool, config));
}

// ---------------------------------------------------------------------------
// Public API: createNemoClawProxy
// ---------------------------------------------------------------------------

/**
 * Generates an `openclaw.json`-compatible MCP server configuration for routing
 * NemoClaw tools through the `sidclaw-mcp-proxy`.
 *
 * @example
 * ```typescript
 * import { createNemoClawProxy } from '@sidclaw/sdk/nemoclaw';
 *
 * const config = createNemoClawProxy({
 *   apiKey: 'ai_test123',
 *   agentId: 'agent-001',
 *   upstreamCommand: 'npx',
 *   upstreamArgs: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/db'],
 * });
 * // Write to openclaw.json
 * ```
 */
export function createNemoClawProxy(config: NemoClawProxyConfig): {
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env: Record<string, string>;
  }>;
} {
  const serverName = config.serverName ?? 'governed';
  const apiUrl = config.apiUrl ?? 'https://api.sidclaw.com';

  return {
    mcpServers: {
      [serverName]: {
        command: 'npx',
        args: ['-y', '@sidclaw/sdk', 'mcp-proxy'],
        env: {
          SIDCLAW_API_KEY: config.apiKey,
          SIDCLAW_AGENT_ID: config.agentId,
          SIDCLAW_API_URL: apiUrl,
          SIDCLAW_UPSTREAM_CMD: config.upstreamCommand,
          SIDCLAW_UPSTREAM_ARGS: config.upstreamArgs.join(','),
        },
      },
    },
  };
}
