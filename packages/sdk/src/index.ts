// Client
export { AgentIdentityClient } from './client/index.js';
export type {
  ClientConfig,
  ApprovalStatusResponse,
  RecordOutcomeRequest,
  WaitForApprovalOptions,
} from './client/index.js';

// Middleware
export { withGovernance, governTool, governTools, governVercelTool, governVercelTools, governOpenAITool, governCrewAITool, governObject } from './middleware/index.js';
export type { GovernanceConfig, GovernedToolConfig } from './middleware/index.js';

// MCP
export { GovernanceMCPServer } from './mcp/index.js';
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
