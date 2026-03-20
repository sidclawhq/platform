import { z } from 'zod';
import {
  ActorTypeSchema,
  AuthorityModelSchema,
  EventTypeSchema,
  TraceOutcomeExtendedSchema,
} from '../enums';

export const AuditTraceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  authority_model: AuthorityModelSchema,
  requested_operation: z.string().min(1),
  target_integration: z.string().min(1),
  resource_scope: z.string().min(1),
  parent_trace_id: z.string().uuid().nullable(),
  credential_id: z.string().uuid().nullable(),
  integrity_hash: z.string().nullable(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  final_outcome: TraceOutcomeExtendedSchema,
});

export type AuditTraceInput = z.infer<typeof AuditTraceSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  trace_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  approval_request_id: z.string().uuid().nullable(),
  timestamp: z.string().datetime(),
  event_type: EventTypeSchema,
  actor_type: ActorTypeSchema,
  actor_name: z.string().min(1),
  description: z.string().min(1),
  status: z.string().min(1),
  policy_version: z.number().int().nullable(),
  correlation_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  integrity_hash: z.string().nullable(),
});

export type AuditEventInput = z.infer<typeof AuditEventSchema>;
