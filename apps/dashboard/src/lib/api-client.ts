const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";
const isDev = API_URL.includes("localhost") || API_URL.includes("127.0.0.1");

// ─── Trace Types ──────────────────────────────────────────────────────────────

export interface TraceSummary {
  id: string;
  agent_id: string;
  agent_name: string;
  authority_model: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  final_outcome: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  event_count: number;
  has_approval: boolean;
}

export interface TraceEvent {
  id: string;
  event_type: string;
  actor_type: string;
  actor_name: string;
  description: string;
  status: string;
  timestamp: string;
  policy_version: number | null;
  approval_request_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TraceApprovalRequest {
  id: string;
  status: string;
  approver_name: string | null;
  decided_at: string | null;
}

export interface TraceDetail {
  id: string;
  agent_id: string;
  agent_name: string;
  authority_model: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  parent_trace_id: string | null;
  final_outcome: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  events: TraceEvent[];
  approval_requests: TraceApprovalRequest[];
}

export interface TraceListResponse {
  data: TraceSummary[];
  pagination: { total: number; limit: number; offset: number };
}

export interface ApprovalListItem {
  id: string;
  tenant_id: string;
  trace_id: string;
  agent_id: string;
  policy_rule_id: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  risk_classification: string;
  authority_model: string;
  delegated_from: string | null;
  policy_effect: string;
  flag_reason: string;
  status: string;
  context_snapshot: Record<string, unknown> | null;
  alternatives: string[] | null;
  expires_at: string | null;
  requested_at: string;
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
  separation_of_duties_check: string;
  agent: { id: string; name: string; owner_name: string };
}

export interface ApprovalDetailResponse {
  id: string;
  tenant_id: string;
  trace_id: string;
  agent_id: string;
  policy_rule_id: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  risk_classification: string;
  authority_model: string;
  delegated_from: string | null;
  policy_effect: string;
  flag_reason: string;
  status: string;
  context_snapshot: Record<string, unknown> | null;
  alternatives: string[] | null;
  expires_at: string | null;
  requested_at: string;
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
  separation_of_duties_check: string;
  agent: {
    id: string;
    name: string;
    owner_name: string;
    owner_role: string;
    team: string;
    authority_model: string;
    identity_mode: string;
    delegation_model: string;
    autonomy_tier: string;
  };
  policy_rule: {
    id: string;
    policy_name: string;
    rationale: string;
    policy_version: number;
    data_classification: string;
    policy_effect: string;
  };
  trace_events: Array<{
    id: string;
    event_type: string;
    actor_type: string;
    actor_name: string;
    description: string;
    status: string;
    timestamp: string;
  }>;
}

export interface ApprovalListResponse {
  data: ApprovalListItem[];
  pagination: { total: number; limit: number; offset: number };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    // Dev bypass header for local development
    // TODO(P3.4): Replace with session-based auth
    if (isDev) {
      requestHeaders["X-Dev-Bypass"] = "true";
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "unknown",
        message: `HTTP ${response.status}`,
        status: response.status,
        request_id: response.headers.get("x-request-id") ?? "unknown",
      }));
      throw new ApiError(error);
    }

    return response.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  async healthCheck(): Promise<{ status: string; version: string } | null> {
    try {
      return await this.get<{ status: string; version: string }>("/health");
    } catch {
      return null;
    }
  }

  async listApprovals(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApprovalListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.get<ApprovalListResponse>(`/api/v1/approvals${qs ? `?${qs}` : ''}`);
  }

  async getApproval(id: string): Promise<ApprovalDetailResponse> {
    return this.get<ApprovalDetailResponse>(`/api/v1/approvals/${id}`);
  }

  async approveRequest(
    id: string,
    body: { approver_name: string; decision_note?: string },
  ): Promise<ApprovalDetailResponse> {
    return this.post<ApprovalDetailResponse>(`/api/v1/approvals/${id}/approve`, body);
  }

  async denyRequest(
    id: string,
    body: { approver_name: string; decision_note?: string },
  ): Promise<ApprovalDetailResponse> {
    return this.post<ApprovalDetailResponse>(`/api/v1/approvals/${id}/deny`, body);
  }

  async listTraces(params?: {
    agent_id?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.agent_id) query.set("agent_id", params.agent_id);
    if (params?.outcome) query.set("outcome", params.outcome);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.get<TraceListResponse>(`/api/v1/traces${qs ? `?${qs}` : ""}`);
  }

  async getTrace(traceId: string) {
    return this.get<TraceDetail>(`/api/v1/traces/${traceId}`);
  }
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId: string;
  public readonly details?: Record<string, unknown>;

  constructor(error: {
    error: string;
    message: string;
    status: number;
    request_id: string;
    details?: Record<string, unknown>;
  }) {
    super(error.message);
    this.name = "ApiError";
    this.code = error.error;
    this.status = error.status;
    this.requestId = error.request_id;
    this.details = error.details;
  }
}

export const api = new ApiClient();
