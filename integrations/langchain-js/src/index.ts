/**
 * LangChain.js integration for SidClaw governance.
 *
 * @example
 * ```typescript
 * import { governTools, GovernanceCallbackHandler } from '@sidclaw/langchain-governance';
 * import { AgentIdentityClient } from '@sidclaw/sdk';
 *
 * const client = new AgentIdentityClient({ apiKey: '...', apiUrl: '...', agentId: '...' });
 * const governed = governTools(myTools, { client });
 * ```
 *
 * @packageDocumentation
 */

// Re-export tool governance wrappers from the SDK
export { governTool, governTools } from '@sidclaw/sdk/langchain';
export type { GovernedToolConfig } from '@sidclaw/sdk/langchain';

// Export the callback handler (new, specific to this package)
export { GovernanceCallbackHandler } from './callbacks.js';

// Re-export commonly needed types and errors
export { AgentIdentityClient, ActionDeniedError } from '@sidclaw/sdk';
