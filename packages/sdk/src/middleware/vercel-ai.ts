import type { GovernedToolConfig } from './langchain.js';
import { evaluateGovernance, recordOutcome } from './langchain.js';

export type { GovernedToolConfig };

/**
 * Interface representing a Vercel AI SDK CoreTool.
 * Tools have a description, parameters (typically Zod schema), and an optional execute function.
 */
interface VercelAIToolLike {
  description?: string;
  parameters?: unknown;
  execute?: (args: unknown, options?: unknown) => Promise<unknown>;
  [key: string]: unknown;
}

/**
 * Wraps a Vercel AI SDK CoreTool with governance.
 * Evaluates before execution, records outcome after.
 * Throws ActionDeniedError on deny or approval_required.
 *
 * Tools without an execute function (schema-only tools) are returned unchanged.
 * The wrapped tool preserves all original properties.
 *
 * @param toolName - The name of the tool (Vercel AI tools are keyed by name in an object)
 * @param tool - The Vercel AI SDK tool definition
 * @param config - Governance configuration
 */
export function governVercelTool<T extends VercelAIToolLike>(
  toolName: string,
  tool: T,
  config: GovernedToolConfig
): T {
  const originalExecute = tool.execute;
  if (!originalExecute) return tool;

  return {
    ...tool,
    execute: async (args: unknown, options?: unknown): Promise<unknown> => {
      const decision = await evaluateGovernance(
        config.client,
        toolName,
        { ...config, target_integration: config.target_integration ?? toolName },
        { input: args, tool_description: tool.description }
      );

      try {
        const result = await originalExecute(args, options);
        await recordOutcome(config.client, decision.trace_id);
        return result;
      } catch (error) {
        await recordOutcome(config.client, decision.trace_id, error);
        throw error;
      }
    },
  } as T;
}

/**
 * Wraps all tools in a Vercel AI SDK tools object with governance.
 *
 * @param tools - An object mapping tool names to tool definitions
 * @param config - Governance configuration (target_integration will be set per-tool)
 * @returns A new tools object with all executable tools governed
 */
export function governVercelTools<T extends Record<string, VercelAIToolLike>>(
  tools: T,
  config: Omit<GovernedToolConfig, 'target_integration'>
): T {
  const governed = {} as Record<string, VercelAIToolLike>;
  for (const [name, tool] of Object.entries(tools)) {
    governed[name] = governVercelTool(name, tool, { ...config, target_integration: name });
  }
  return governed as T;
}
