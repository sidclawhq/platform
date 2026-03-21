export class AgentIdentityError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId?: string;

  constructor(message: string, code: string, status: number, requestId?: string) {
    super(message);
    this.name = 'AgentIdentityError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export class ActionDeniedError extends AgentIdentityError {
  public readonly reason: string;
  public readonly traceId: string;
  public readonly policyRuleId: string | null;

  constructor(reason: string, traceId: string, policyRuleId: string | null, requestId?: string) {
    super(`Action denied: ${reason}`, 'action_denied', 403, requestId);
    this.name = 'ActionDeniedError';
    this.reason = reason;
    this.traceId = traceId;
    this.policyRuleId = policyRuleId;
  }
}

export class ApprovalTimeoutError extends AgentIdentityError {
  public readonly approvalRequestId: string;
  public readonly traceId: string;
  public readonly timeoutMs: number;

  constructor(approvalRequestId: string, traceId: string, timeoutMs: number) {
    super(`Approval timed out after ${timeoutMs}ms`, 'approval_timeout', 408);
    this.name = 'ApprovalTimeoutError';
    this.approvalRequestId = approvalRequestId;
    this.traceId = traceId;
    this.timeoutMs = timeoutMs;
  }
}

export class ApprovalExpiredError extends AgentIdentityError {
  public readonly approvalRequestId: string;
  public readonly traceId: string;

  constructor(approvalRequestId: string, traceId: string) {
    super('Approval request expired', 'approval_expired', 410);
    this.name = 'ApprovalExpiredError';
    this.approvalRequestId = approvalRequestId;
    this.traceId = traceId;
  }
}

export class ApiRequestError extends AgentIdentityError {
  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message, code, status, requestId);
    this.name = 'ApiRequestError';
  }
}
