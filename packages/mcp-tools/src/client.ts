/**
 * Minimal HTTP client for the SidClaw REST API — used by the MCP tools server.
 *
 * Kept dependency-free (global fetch) so the server works on any Node 18+
 * runtime without pulling in an HTTP library.
 */

export interface SidClawConfig {
  baseUrl: string;
  apiKey: string;
}

export class SidClawApiError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `SidClaw API error ${status}`);
    this.name = 'SidClawApiError';
  }
}

async function request<T>(
  config: SidClawConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'User-Agent': 'sidclaw-mcp-tools/0.1',
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as Record<string, unknown>).message)
        : `HTTP ${response.status}`;
    throw new SidClawApiError(response.status, data, message);
  }
  return data as T;
}

export class SidClawClient {
  constructor(private config: SidClawConfig) {}

  evaluate(payload: {
    agent_id: string;
    operation: string;
    target_integration: string;
    resource_scope: string;
    data_classification: 'public' | 'internal' | 'confidential' | 'restricted';
    context?: Record<string, unknown>;
  }) {
    return request<{
      decision: string;
      trace_id: string;
      approval_request_id: string | null;
      reason: string;
      policy_rule_id: string | null;
    }>(this.config, 'POST', '/api/v1/evaluate', payload);
  }

  recordOutcome(
    traceId: string,
    payload: {
      status: 'success' | 'error';
      outcome_summary?: string;
      error_classification?: 'timeout' | 'permission' | 'not_found' | 'runtime';
      exit_code?: number;
      tokens_in?: number;
      tokens_out?: number;
      tokens_cache_read?: number;
      model?: string;
      cost_estimate?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    return request<void>(
      this.config,
      'POST',
      `/api/v1/traces/${encodeURIComponent(traceId)}/outcome`,
      payload,
    );
  }

  async waitForApproval(
    approvalId: string,
    timeoutSeconds: number,
    pollInterval = 3,
  ): Promise<{ status: string; approver_name?: string; decision_note?: string }> {
    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      try {
        const res = await request<{
          status: string;
          approver_name?: string;
          decision_note?: string;
        }>(
          this.config,
          'GET',
          `/api/v1/approvals/${encodeURIComponent(approvalId)}/status`,
        );
        if (['approved', 'denied', 'expired', 'cancelled'].includes(res.status)) {
          return res;
        }
      } catch {
        // transient error — fall through to next poll
      }
      await new Promise((r) => setTimeout(r, pollInterval * 1000));
    }
    return { status: 'timeout' };
  }

  listPolicies(agentId?: string) {
    const query = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : '';
    return request<{ data: Array<Record<string, unknown>> }>(
      this.config,
      'GET',
      `/api/v1/policies${query}`,
    );
  }

  listTraces(agentId?: string, limit = 50) {
    const parts: string[] = [`limit=${limit}`];
    if (agentId) parts.push(`agent_id=${encodeURIComponent(agentId)}`);
    return request<{ data: Array<Record<string, unknown>> }>(
      this.config,
      'GET',
      `/api/v1/traces?${parts.join('&')}`,
    );
  }

  health() {
    return request<{ status: string }>(this.config, 'GET', '/health');
  }
}
