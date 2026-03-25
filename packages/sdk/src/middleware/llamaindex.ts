import type { DataClassification } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import { evaluateGovernance, recordOutcome, type GovernedToolConfig } from './langchain.js';

// ---------------------------------------------------------------------------
// Types — duck-typed to avoid hard dependency on llamaindex
// ---------------------------------------------------------------------------

/**
 * Duck-typed interface for a LlamaIndex tool.
 * Matches both `FunctionTool` and `QueryEngineTool`.
 * No import from `llamaindex` is needed.
 */
interface LlamaIndexToolLike {
  metadata: {
    name: string;
    description: string;
    [key: string]: unknown;
  };
  call: (...args: unknown[]) => Promise<unknown>;
  [key: string]: unknown;
}

/**
 * Configuration for LlamaIndex tool governance.
 */
export interface LlamaIndexGovernanceConfig {
  /** Override the target integration name (default: tool metadata name). */
  target_integration?: string;
  /** Resource scope sent to the policy engine (default: "*"). */
  resource_scope?: string;
  /** Data classification for the tool (default: "internal"). */
  data_classification?: DataClassification;
}

// ---------------------------------------------------------------------------
// Public API: governLlamaIndexTool
// ---------------------------------------------------------------------------

/**
 * Wraps a LlamaIndex tool with SidClaw governance.
 *
 * The wrapped tool preserves the original metadata (name, description,
 * parameters) but evaluates SidClaw policies before execution and records
 * the outcome after.
 *
 * Uses duck typing — no import from `llamaindex` is required.
 *
 * @example
 * ```typescript
 * import { AgentIdentityClient } from '@sidclaw/sdk';
 * import { governLlamaIndexTool } from '@sidclaw/sdk/llamaindex';
 * import { FunctionTool } from 'llamaindex';
 *
 * const client = new AgentIdentityClient({ ... });
 *
 * const searchTool = FunctionTool.from({
 *   name: 'search_docs',
 *   description: 'Search documentation',
 *   fn: async ({ query }: { query: string }) => doSearch(query),
 * });
 *
 * const governed = governLlamaIndexTool(client, searchTool);
 * ```
 */
export function governLlamaIndexTool<T extends LlamaIndexToolLike>(
  client: AgentIdentityClient,
  tool: T,
  config?: LlamaIndexGovernanceConfig,
): T {
  const originalCall = tool.call.bind(tool);
  const toolName = tool.metadata.name;
  const toolDescription = tool.metadata.description;

  const governedConfig: GovernedToolConfig = {
    client,
    target_integration: config?.target_integration ?? toolName,
    resource_scope: config?.resource_scope ?? '*',
    data_classification: config?.data_classification ?? 'internal',
  };

  const wrappedTool = Object.create(Object.getPrototypeOf(tool));
  Object.assign(wrappedTool, tool);

  wrappedTool.call = async (...args: unknown[]): Promise<unknown> => {
    const decision = await evaluateGovernance(
      client,
      toolName,
      governedConfig,
      { input: args[0], tool_description: toolDescription },
    );

    try {
      const result = await originalCall(...args);
      await recordOutcome(client, decision.trace_id);
      return result;
    } catch (error) {
      await recordOutcome(client, decision.trace_id, error);
      throw error;
    }
  };

  return wrappedTool as T;
}

// ---------------------------------------------------------------------------
// Public API: governLlamaIndexTools
// ---------------------------------------------------------------------------

/**
 * Wraps all LlamaIndex tools in an array with SidClaw governance.
 * Uses each tool's `metadata.name` as the `target_integration`.
 *
 * @example
 * ```typescript
 * import { governLlamaIndexTools } from '@sidclaw/sdk/llamaindex';
 *
 * const tools = [searchTool, calculatorTool, emailTool];
 * const governed = governLlamaIndexTools(client, tools, {
 *   data_classification: 'confidential',
 * });
 * ```
 */
export function governLlamaIndexTools<T extends LlamaIndexToolLike>(
  client: AgentIdentityClient,
  tools: T[],
  config?: Omit<LlamaIndexGovernanceConfig, 'target_integration'>,
): T[] {
  return tools.map(tool =>
    governLlamaIndexTool(client, tool, {
      ...config,
      target_integration: tool.metadata.name,
    }),
  );
}
