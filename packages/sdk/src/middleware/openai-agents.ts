import type { GovernedToolConfig } from './langchain.js';
import { evaluateGovernance, recordOutcome } from './langchain.js';

export type { GovernedToolConfig };

/**
 * Interface representing an OpenAI function tool definition.
 * Used to avoid a hard dependency on the openai package.
 */
interface OpenAIFunctionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
    strict?: boolean;
  };
}

/**
 * A handler function that the OpenAI Agents SDK calls when a tool is invoked.
 */
type OpenAIToolHandler = (args: unknown) => Promise<unknown>;

/**
 * Wraps an OpenAI function tool handler with governance.
 * The tool definition object is returned unchanged; only the handler is wrapped.
 *
 * @param tool - The OpenAI function tool definition (type: 'function')
 * @param handler - The handler function that executes the tool
 * @param config - Governance configuration
 * @returns An object with the original tool definition and a governed handler
 */
export function governOpenAITool(
  tool: OpenAIFunctionTool,
  handler: OpenAIToolHandler,
  config: GovernedToolConfig
): { tool: OpenAIFunctionTool; handler: OpenAIToolHandler } {
  const toolName = tool.function.name;

  const governedHandler: OpenAIToolHandler = async (args: unknown) => {
    const decision = await evaluateGovernance(
      config.client,
      toolName,
      { ...config, target_integration: config.target_integration ?? toolName },
      { input: args, tool_description: tool.function.description }
    );

    try {
      const result = await handler(args);
      await recordOutcome(config.client, decision.trace_id);
      return result;
    } catch (error) {
      await recordOutcome(config.client, decision.trace_id, error);
      throw error;
    }
  };

  return { tool, handler: governedHandler };
}
