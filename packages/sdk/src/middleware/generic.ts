import type { DataClassification } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import { evaluateGovernance, recordOutcome } from './langchain.js';

interface MethodMapping {
  operation?: string;
  target_integration: string;
  resource_scope?: string;
  data_classification?: DataClassification;
  skip?: boolean;
}

/**
 * Wraps methods of a plain object with governance.
 * Useful for wrapping service classes or API clients.
 *
 * Each method listed in methodMappings is wrapped with governance evaluation.
 * Methods marked with `skip: true` or non-function properties are left unchanged.
 * The method name is used as the default operation if not specified in the mapping.
 *
 * @param obj - The object whose methods to wrap
 * @param client - The AgentIdentityClient instance
 * @param methodMappings - A map of method name to governance config for that method
 */
export function governObject<T extends Record<string, unknown>>(
  obj: T,
  client: AgentIdentityClient,
  methodMappings: Record<string, MethodMapping>
): T {
  const governed = Object.create(Object.getPrototypeOf(obj)) as T;
  Object.assign(governed, obj);

  for (const [method, mapping] of Object.entries(methodMappings)) {
    if (mapping.skip || typeof obj[method] !== 'function') continue;

    const original = (obj[method] as Function).bind(obj);
    const operation = mapping.operation ?? method;

    (governed as Record<string, unknown>)[method] = async (...args: unknown[]): Promise<unknown> => {
      const decision = await evaluateGovernance(
        client,
        operation,
        {
          client,
          target_integration: mapping.target_integration,
          resource_scope: mapping.resource_scope,
          data_classification: mapping.data_classification,
        },
        { args }
      );

      try {
        const result = await original(...args);
        await recordOutcome(client, decision.trace_id);
        return result;
      } catch (error) {
        await recordOutcome(client, decision.trace_id, error);
        throw error;
      }
    };
  }

  return governed;
}
