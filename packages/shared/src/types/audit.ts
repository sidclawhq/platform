import { ActorType, AuthorityModel, EventType, TraceOutcomeExtended } from '../enums';

export interface AuditTrace {
  id: string;
  tenant_id: string;
  agent_id: string;
  authority_model: AuthorityModel;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  parent_trace_id: string | null;
  credential_id: string | null;
  integrity_hash: string | null;
  started_at: string;
  completed_at: string | null;
  final_outcome: TraceOutcomeExtended;
}

export interface AuditEvent {
  id: string;
  tenant_id: string;
  trace_id: string;
  agent_id: string;
  approval_request_id: string | null;
  timestamp: string;
  event_type: EventType;
  actor_type: ActorType;
  actor_name: string;
  description: string;
  status: string;
  policy_version: number | null;
  correlation_id: string | null;
  metadata: Record<string, unknown> | null;
  integrity_hash: string | null;
}
