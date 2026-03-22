const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

// ─── Agent Types ─────────────────────────────────────────────────────────────

export interface AuthorizedIntegration {
  name: string;
  resource_scope: string;
  data_classification: string;
  allowed_operations: string[];
}

export interface AgentSummary {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  owner_name: string;
  owner_role: string;
  team: string;
  environment: string;
  authority_model: string;
  identity_mode: string;
  delegation_model: string;
  autonomy_tier: string;
  lifecycle_state: string;
  authorized_integrations: AuthorizedIntegration[];
  metadata: Record<string, unknown> | null;
  next_review_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AgentListResponse {
  data: AgentSummary[];
  pagination: { total: number; limit: number; offset: number };
}

export interface AgentDetail extends AgentSummary {
  stats: {
    policy_count: { allow: number; approval_required: number; deny: number };
    pending_approvals: number;
    traces_last_7_days: number;
    last_activity_at: string | null;
  };
  recent_traces: Array<{
    trace_id: string;
    operation: string;
    final_outcome: string;
    started_at: string;
  }>;
  recent_approvals: Array<{
    id: string;
    operation: string;
    status: string;
    requested_at: string;
  }>;
}

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

export interface TraceVerifyResult {
  verified: boolean;
  total_events: number;
  verified_events: number;
  broken_at: {
    event_id: string;
    event_type: string;
    expected_hash: string;
    actual_hash: string;
  } | null;
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
  context_snippet: string | null;
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

export interface ApprovalListMeta {
  oldest_pending_seconds: number | null;
  count_by_risk: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface ApprovalListResponse {
  data: (ApprovalListItem & { time_pending_seconds: number })[];
  pagination: { total: number; limit: number; offset: number };
  meta: ApprovalListMeta;
}

// ─── Policy Types ────────────────────────────────────────────────────────────

export interface PolicyTestInput {
  agent_id: string;
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
}

export interface PolicyTestResult {
  effect: string;
  rule_id: string | null;
  rationale: string;
  policy_version: number | null;
}

export interface PolicyRuleVersion {
  id: string;
  policy_rule_id: string;
  version: number;
  policy_name: string;
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  policy_effect: string;
  rationale: string;
  priority: number;
  conditions: Record<string, unknown> | null;
  max_session_ttl: number | null;
  modified_by: string;
  modified_at: string;
  change_summary: string | null;
}

export interface PolicyVersionListResponse {
  data: PolicyRuleVersion[];
  pagination: { total: number; limit: number; offset: number };
}

export interface PolicyListItem {
  id: string;
  tenant_id: string;
  agent_id: string;
  policy_name: string;
  target_integration: string;
  operation: string;
  resource_scope: string;
  data_classification: string;
  policy_effect: string;
  rationale: string;
  priority: number;
  conditions: Record<string, unknown> | null;
  max_session_ttl: number | null;
  is_active: boolean;
  policy_version: number;
  modified_by: string;
  modified_at: string;
  created_at: string;
  updated_at: string;
  agent: { id: string; name: string };
}

export interface PolicyListResponse {
  data: PolicyListItem[];
  pagination: { total: number; limit: number; offset: number };
}

// ─── Dashboard Types ─────────────────────────────────────────────────────────

export interface DashboardOverviewResponse {
  stats: {
    total_agents: number;
    active_agents: number;
    total_policies: number;
    pending_approvals: number;
    traces_today: number;
    traces_this_week: number;
    avg_approval_time_minutes: number | null;
  };
  pending_approvals: Array<{
    id: string;
    agent_name: string;
    operation: string;
    risk_classification: string | null;
    requested_at: string;
    time_pending_seconds: number;
  }>;
  recent_traces: Array<{
    trace_id: string;
    agent_name: string;
    operation: string;
    final_outcome: string;
    started_at: string;
  }>;
  system_health: {
    api: 'healthy' | 'degraded';
    database: 'healthy' | 'degraded' | 'unreachable';
    background_jobs: 'healthy' | 'stale';
  };
}

export interface SearchResponse {
  results: {
    agents: Array<{ id: string; name: string; highlight: string }>;
    traces: Array<{ trace_id: string; operation: string; agent_name: string; highlight: string }>;
    policies: Array<{ id: string; policy_name: string; agent_name: string; highlight: string }>;
    approvals: Array<{ id: string; operation: string; agent_name: string; highlight: string }>;
  };
  total: number;
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

    // Add CSRF token for state-changing requests
    if (typeof document !== "undefined" && ["POST", "PATCH", "PUT", "DELETE"].includes(method ?? "GET")) {
      const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
      if (csrfToken) {
        requestHeaders["X-CSRF-Token"] = csrfToken;
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    // Global 401 handler — redirect to login
    if (response.status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=true";
      }
      const error = await response.json().catch(() => ({
        error: "unauthorized",
        message: "Session expired",
        status: 401,
        request_id: response.headers.get("x-request-id") ?? "unknown",
      }));
      throw new ApiError(error);
    }

    // 402 — plan limit reached, trigger upgrade modal
    if (response.status === 402) {
      const errorBody = await response.json().catch(() => ({
        error: "plan_limit_reached",
        message: "Plan limit reached",
        status: 402,
        request_id: response.headers.get("x-request-id") ?? "unknown",
      }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sidclaw:plan-limit", {
          detail: {
            limitName: errorBody.details?.limit ?? "resources",
            current: errorBody.details?.current ?? 0,
            max: errorBody.details?.max ?? 0,
          },
        }));
      }
      throw new ApiError(errorBody);
    }

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

  async getApprovalCount(status?: string): Promise<{ count: number }> {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    const qs = query.toString();
    return this.get<{ count: number }>(`/api/v1/approvals/count${qs ? `?${qs}` : ''}`);
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
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.agent_id) query.set("agent_id", params.agent_id);
    if (params?.outcome) query.set("outcome", params.outcome);
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.get<TraceListResponse>(`/api/v1/traces${qs ? `?${qs}` : ""}`);
  }

  async getTrace(traceId: string) {
    return this.get<TraceDetail>(`/api/v1/traces/${traceId}`);
  }

  async exportTrace(traceId: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/traces/${traceId}/export?format=json`,
      {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );
    if (!response.ok) throw new ApiError(await response.json());
    return response.blob();
  }

  // ─── Agent Methods ──────────────────────────────────────────────────────────

  async listAgents(params?: {
    environment?: string;
    lifecycle_state?: string;
    authority_model?: string;
    autonomy_tier?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AgentListResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const qs = query.toString();
    return this.get<AgentListResponse>(`/api/v1/agents${qs ? `?${qs}` : ''}`);
  }

  async getAgent(id: string): Promise<{ data: AgentDetail }> {
    return this.get<{ data: AgentDetail }>(`/api/v1/agents/${id}`);
  }

  async suspendAgent(id: string): Promise<{ data: AgentSummary }> {
    return this.post<{ data: AgentSummary }>(`/api/v1/agents/${id}/suspend`, {});
  }

  async revokeAgent(id: string): Promise<{ data: AgentSummary }> {
    return this.post<{ data: AgentSummary }>(`/api/v1/agents/${id}/revoke`, {});
  }

  async reactivateAgent(id: string): Promise<{ data: AgentSummary }> {
    return this.post<{ data: AgentSummary }>(`/api/v1/agents/${id}/reactivate`, {});
  }

  async createAgent(data: Record<string, unknown>): Promise<{ data: AgentSummary }> {
    return this.post<{ data: AgentSummary }>('/api/v1/agents', data);
  }

  // ─── Policy Methods ─────────────────────────────────────────────────────────

  async listPolicies(params?: {
    agent_id?: string;
    effect?: string;
    data_classification?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<PolicyListResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const qs = query.toString();
    return this.get<PolicyListResponse>(`/api/v1/policies${qs ? `?${qs}` : ''}`);
  }

  async getPolicy(id: string): Promise<{ data: PolicyListItem }> {
    return this.get<{ data: PolicyListItem }>(`/api/v1/policies/${id}`);
  }

  async createPolicy(data: Record<string, unknown>): Promise<{ data: PolicyListItem }> {
    return this.post<{ data: PolicyListItem }>('/api/v1/policies', data);
  }

  async updatePolicy(id: string, data: Record<string, unknown>): Promise<{ data: PolicyListItem }> {
    return this.patch<{ data: PolicyListItem }>(`/api/v1/policies/${id}`, data);
  }

  async deletePolicy(id: string): Promise<{ data: PolicyListItem }> {
    return this.delete<{ data: PolicyListItem }>(`/api/v1/policies/${id}`);
  }

  async testPolicy(data: PolicyTestInput): Promise<PolicyTestResult> {
    return this.post<PolicyTestResult>('/api/v1/policies/test', data);
  }

  async getPolicyVersions(policyId: string, params?: { limit?: number; offset?: number }): Promise<PolicyVersionListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.get<PolicyVersionListResponse>(`/api/v1/policies/${policyId}/versions${qs ? `?${qs}` : ''}`);
  }

  // ─── Dashboard Methods ────────────────────────────────────────────────────

  async getOverview() {
    return this.get<DashboardOverviewResponse>('/api/v1/dashboard/overview');
  }

  async search(query: string) {
    return this.get<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(query)}`);
  }

  // ─── Tenant Settings Methods ──────────────────────────────────────────────

  async getTenantSettings() {
    return this.get<{
      data: {
        id: string;
        name: string;
        slug: string;
        plan: string;
        settings: {
          default_approval_ttl_seconds: number;
          default_data_classification: string;
          notification_email: string | null;
          notifications_enabled: boolean;
        };
      };
    }>('/api/v1/tenant/settings');
  }

  async updateTenantSettings(data: { name?: string; settings?: Record<string, unknown> }) {
    return this.patch<{
      data: {
        id: string;
        name: string;
        slug: string;
        plan: string;
        settings: {
          default_approval_ttl_seconds: number;
          default_data_classification: string;
          notification_email: string | null;
          notifications_enabled: boolean;
        };
      };
    }>('/api/v1/tenant/settings', data);
  }

  // ─── Webhook Methods ──────────────────────────────────────────────────────

  async listWebhooks() {
    return this.get<{
      data: Array<{
        id: string;
        url: string;
        events: string[];
        is_active: boolean;
        description: string | null;
        created_at: string;
      }>;
    }>('/api/v1/webhooks');
  }

  async createWebhook(data: { url: string; events: string[]; description?: string }) {
    return this.post<{
      data: {
        id: string;
        url: string;
        events: string[];
        secret: string;
        is_active: boolean;
        description: string | null;
        created_at: string;
      };
    }>('/api/v1/webhooks', data);
  }

  async deleteWebhook(id: string) {
    return this.delete(`/api/v1/webhooks/${id}`);
  }

  async testWebhook(id: string) {
    return this.post<{
      delivered: boolean;
      http_status: number | null;
      response_time_ms: number;
      error?: string;
    }>(`/api/v1/webhooks/${id}/test`, {});
  }

  async getWebhookDeliveries(id: string, params?: { status?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return this.get<{
      data: Array<{
        id: string;
        event_type: string;
        status: string;
        http_status: number | null;
        attempts: number;
        created_at: string;
        delivered_at: string | null;
        next_retry_at: string | null;
      }>;
    }>(`/api/v1/webhooks/${id}/deliveries${qs ? `?${qs}` : ''}`);
  }

  // ─── Onboarding Methods ─────────────────────────────────────────────────

  async getOnboarding() {
    return this.get<{
      data: {
        copy_api_key: boolean;
        register_agent: boolean;
        create_policy: boolean;
        run_evaluation: boolean;
        see_trace: boolean;
      };
    }>('/api/v1/tenant/onboarding');
  }

  async updateOnboarding(data: Partial<{
    copy_api_key: boolean;
    register_agent: boolean;
    create_policy: boolean;
    run_evaluation: boolean;
    see_trace: boolean;
  }>) {
    return this.patch<{ data: Record<string, boolean> }>('/api/v1/tenant/onboarding', data);
  }

  // ─── Integrity & Export Methods ──────────────────────────────────────────

  async verifyTrace(traceId: string): Promise<TraceVerifyResult> {
    return this.get<TraceVerifyResult>(`/api/v1/traces/${traceId}/verify`);
  }

  async exportAuditEvents(params: {
    from: string;
    to: string;
    format: 'json' | 'csv';
  }): Promise<Blob> {
    const query = new URLSearchParams({
      from: params.from,
      to: params.to,
      format: params.format,
    });

    const response = await fetch(
      `${this.baseUrl}/api/v1/audit/export?${query}`,
      {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );
    if (!response.ok) throw new ApiError(await response.json());
    return response.blob();
  }

  async exportTracesCsv(params: {
    from: string;
    to: string;
    agent_id?: string;
  }): Promise<Blob> {
    const query = new URLSearchParams({
      from: params.from,
      to: params.to,
      format: "csv",
    });
    if (params.agent_id) query.set("agent_id", params.agent_id);

    const response = await fetch(
      `${this.baseUrl}/api/v1/traces/export?${query}`,
      {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );
    if (!response.ok) throw new ApiError(await response.json());
    return response.blob();
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
