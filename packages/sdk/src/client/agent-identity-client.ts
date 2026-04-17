import type { EvaluateRequest, EvaluateResponse } from '@sidclaw/shared';
import type { ApprovalStatusExtended } from '@sidclaw/shared';
import { ApiRequestError, RateLimitError } from '../errors.js';
import { ApprovalTimeoutError, ApprovalExpiredError } from '../errors.js';

interface ClientConfig {
  apiKey: string;
  apiUrl: string;
  agentId: string;
  /** Max retries for transient failures (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 500) */
  retryBaseDelayMs?: number;
}

interface ApprovalStatusResponse {
  id: string;
  status: ApprovalStatusExtended;
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
}

interface RecordOutcomeRequest {
  status: 'success' | 'error';
  metadata?: Record<string, unknown>;
  // Added 2026-04-16 — hooks + cost-attribution telemetry. All optional.
  outcome_summary?: string;
  error_classification?: 'timeout' | 'permission' | 'not_found' | 'runtime';
  exit_code?: number;
  tokens_in?: number;
  tokens_out?: number;
  tokens_cache_read?: number;
  model?: string;
  cost_estimate?: number;
}

interface RecordTelemetryRequest {
  tokens_in?: number;
  tokens_out?: number;
  tokens_cache_read?: number;
  model?: string;
  cost_estimate?: number;
  outcome_summary?: string;
}

interface WaitForApprovalOptions {
  /** Timeout in ms (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Poll interval in ms (default: 2000 = 2 seconds) */
  pollInterval?: number;
}

export type {
  ClientConfig,
  ApprovalStatusResponse,
  RecordOutcomeRequest,
  RecordTelemetryRequest,
  WaitForApprovalOptions,
};

export class AgentIdentityClient {
  private readonly config: Required<ClientConfig>;

  constructor(config: ClientConfig) {
    this.config = {
      maxRetries: 3,
      retryBaseDelayMs: 500,
      ...config,
    };
  }

  /**
   * Evaluate an action against the policy engine.
   * Returns the policy decision, trace ID, and (if approval required) the approval request ID.
   */
  async evaluate(action: EvaluateRequest): Promise<EvaluateResponse> {
    return this.request<EvaluateResponse>('POST', '/api/v1/evaluate', {
      agent_id: this.config.agentId,
      ...action,
    });
  }

  /**
   * Poll for approval status until it's decided or timeout is reached.
   * Resolves with the approval status response.
   * Throws ApprovalTimeoutError if timeout is reached.
   * Throws ApprovalExpiredError if the approval expired server-side.
   */
  async waitForApproval(
    approvalRequestId: string,
    options: WaitForApprovalOptions = {}
  ): Promise<ApprovalStatusResponse> {
    const { timeout = 300000, pollInterval = 2000 } = options;
    const startTime = Date.now();

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeout) {
        throw new ApprovalTimeoutError(
          approvalRequestId,
          'unknown',
          timeout
        );
      }

      const status = await this.request<ApprovalStatusResponse>(
        'GET',
        `/api/v1/approvals/${approvalRequestId}/status`
      );

      if (status.status === 'approved' || status.status === 'denied') {
        return status;
      }

      if (status.status === 'expired') {
        throw new ApprovalExpiredError(approvalRequestId, 'unknown');
      }

      // Still pending — wait and poll again
      await this.sleep(pollInterval);
    }
  }

  /**
   * Record the outcome of an action after it was executed (or failed).
   * Called after evaluate() returned 'allow' or after waitForApproval() returned 'approved'.
   */
  async recordOutcome(
    traceId: string,
    outcome: RecordOutcomeRequest
  ): Promise<void> {
    await this.request('POST', `/api/v1/traces/${traceId}/outcome`, outcome);
  }

  /**
   * Attach token usage or cost data to a trace AFTER its outcome has been
   * recorded. Used for late-arriving LLM telemetry (e.g. from a Stop hook).
   */
  async recordTelemetry(
    traceId: string,
    telemetry: RecordTelemetryRequest
  ): Promise<void> {
    await this.request('PATCH', `/api/v1/traces/${traceId}/telemetry`, telemetry);
  }

  /**
   * Internal HTTP request method with retry logic for transient failures.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const url = `${this.config.apiUrl}${path}`;
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        };

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.ok) {
          // Handle 204 No Content
          if (response.status === 204) return undefined as T;
          return await response.json() as T;
        }

        // Parse error response
        const errorBody = await response.json().catch(() => ({
          error: 'unknown',
          message: `HTTP ${response.status}`,
          status: response.status,
          request_id: response.headers.get('x-request-id') ?? 'unknown',
        })) as { error: string; message: string; status: number; request_id: string };

        // Don't retry client errors (4xx) except 429 (rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new ApiRequestError(
            errorBody.message,
            response.status,
            errorBody.error,
            errorBody.request_id
          );
        }

        // Handle 429 with Retry-After header
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
          const details = (errorBody as Record<string, unknown>).details as
            | { limit?: number; remaining?: number }
            | undefined;
          lastError = new RateLimitError(
            errorBody.message,
            retryAfter,
            details?.limit ?? 0,
            details?.remaining ?? 0,
            errorBody.request_id
          );
          if (attempt < this.config.maxRetries) {
            await this.sleep(retryAfter * 1000);
            continue;
          }
          throw lastError;
        }

        // Retry on 5xx
        lastError = new ApiRequestError(
          errorBody.message,
          response.status,
          errorBody.error,
          errorBody.request_id
        );
      } catch (error) {
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
          throw error; // Don't retry client errors
        }
        if (error instanceof RateLimitError) {
          throw error; // Already exhausted retries
        }
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Exponential backoff before retry (for 5xx and network errors)
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
        // Add jitter: 0.5x to 1.5x the delay
        const jitteredDelay = delay * (0.5 + Math.random());
        await this.sleep(jitteredDelay);
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
