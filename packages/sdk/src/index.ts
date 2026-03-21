export { AgentIdentityClient } from './client/index.js';
export type {
  ClientConfig,
  ApprovalStatusResponse,
  RecordOutcomeRequest,
  WaitForApprovalOptions,
} from './client/index.js';
export type { EvaluateRequest, EvaluateResponse } from '@agent-identity/shared';
export { withGovernance } from './middleware/index.js';
export type { GovernanceConfig } from './middleware/index.js';
export {
  AgentIdentityError,
  ActionDeniedError,
  ApprovalTimeoutError,
  ApprovalExpiredError,
  ApiRequestError,
} from './errors.js';
