// Client
export { AgentIdentityClient } from './client/index.js';
export type {
  ClientConfig,
  ApprovalStatusResponse,
  RecordOutcomeRequest,
  WaitForApprovalOptions,
} from './client/index.js';

// Middleware — generic wrapper (framework-specific: import from '@sidclaw/sdk/langchain', etc.)
export { withGovernance } from './middleware/governance.js';
export type { GovernanceConfig } from './middleware/governance.js';

// MCP — import from '@sidclaw/sdk/mcp' to avoid requiring @modelcontextprotocol/sdk
export type { GovernanceMCPServerConfig, ToolMapping } from './mcp/index.js';

// Webhooks
export { verifyWebhookSignature } from './webhooks/index.js';

// Errors
export {
  AgentIdentityError,
  ActionDeniedError,
  ApprovalTimeoutError,
  ApprovalExpiredError,
  RateLimitError,
  ApiRequestError,
} from './errors.js';

// Types (re-export from shared)
export type { EvaluateRequest, EvaluateResponse, DataClassification, PolicyEffect } from '@sidclaw/shared';
