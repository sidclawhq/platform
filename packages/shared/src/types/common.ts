import { DataClassification, PolicyEffect } from '../enums';

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
  trace_id?: string;
  request_id: string;
}

export interface EvaluateRequest {
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: DataClassification;
  context?: Record<string, unknown>;
}

export interface EvaluateResponse {
  decision: PolicyEffect;
  trace_id: string;
  approval_request_id: string | null;
  reason: string;
  policy_rule_id: string | null;
}
