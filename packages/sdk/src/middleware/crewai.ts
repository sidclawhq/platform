import type { GovernedToolConfig } from './langchain.js';
import { evaluateGovernance, recordOutcome } from './langchain.js';

export type { GovernedToolConfig };

/**
 * Interface representing a CrewAI-compatible tool.
 * CrewAI tools typically have a name, description, and a callable function.
 */
interface CrewAIToolLike {
  name: string;
  description: string;
  func: (input: unknown) => Promise<unknown>;
}

/**
 * Wraps a CrewAI tool with governance.
 * Evaluates before execution, records outcome after.
 * Throws ActionDeniedError on deny or approval_required.
 *
 * The wrapped tool preserves the original name and description.
 */
export function governCrewAITool<T extends CrewAIToolLike>(
  tool: T,
  config: GovernedToolConfig
): T {
  const originalFunc = tool.func;

  const wrappedTool = { ...tool };
  wrappedTool.func = async (input: unknown): Promise<unknown> => {
    const decision = await evaluateGovernance(
      config.client,
      tool.name,
      { ...config, target_integration: config.target_integration ?? tool.name },
      { input, tool_description: tool.description }
    );

    try {
      const result = await originalFunc(input);
      await recordOutcome(config.client, decision.trace_id);
      return result;
    } catch (error) {
      await recordOutcome(config.client, decision.trace_id, error);
      throw error;
    }
  };

  return wrappedTool as T;
}
