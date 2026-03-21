import type { ToolMapping } from './config.js';

/**
 * Matches a tool name against a ToolMapping using glob-like patterns.
 * Supports: exact match, trailing wildcard ("db_*"), leading wildcard ("*_query").
 */
export function findMapping(toolName: string, mappings: ToolMapping[]): ToolMapping | undefined {
  const exact = mappings.find(m => m.toolName === toolName);
  if (exact) return exact;

  for (const mapping of mappings) {
    if (mapping.toolName.includes('*')) {
      const regex = new RegExp('^' + mapping.toolName.replace(/\*/g, '.*') + '$');
      if (regex.test(toolName)) return mapping;
    }
  }

  return undefined;
}

/**
 * Derives resource_scope from tool arguments when no explicit mapping exists.
 * Checks common scope-indicating keys in priority order.
 */
export function deriveResourceScope(toolName: string, args: Record<string, unknown>): string {
  const scopeKeys = ['path', 'file', 'table', 'database', 'collection', 'bucket', 'resource', 'url', 'endpoint'];
  for (const key of scopeKeys) {
    if (typeof args[key] === 'string') return args[key] as string;
  }
  return toolName;
}
