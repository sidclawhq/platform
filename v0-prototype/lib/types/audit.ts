import { ActorType, AuthorityModel, EventType, TraceOutcome } from './enums';

export interface AuditTrace {
  trace_id: string;
  agent_id: string;
  authority_model: AuthorityModel;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  started_at: string;
  completed_at: string | null;
  final_outcome: TraceOutcome;
}

export interface AuditEvent {
  id: string;
  trace_id: string;
  agent_id: string;
  approval_request_id: string | null;
  timestamp: string;
  event_type: EventType;
  actor_type: ActorType;
  actor_name: string;
  description: string;
  status: string;
  policy_version: string | null;
  correlation_id: string | null;
}
