import { z } from 'zod';
import {
  ApprovalStatusExtendedSchema,
  AuthorityModelSchema,
  DataClassificationSchema,
  PolicyEffectSchema,
  RiskClassificationSchema,
  SeparationOfDutiesCheckSchema,
} from '../enums';

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  trace_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  requested_operation: z.string().min(1),
  target_integration: z.string().min(1),
  resource_scope: z.string().min(1),
  data_classification: DataClassificationSchema,
  risk_classification: RiskClassificationSchema,
  authority_model: AuthorityModelSchema,
  delegated_from: z.string().nullable(),
  policy_effect: PolicyEffectSchema,
  flag_reason: z.string().min(1),
  status: ApprovalStatusExtendedSchema,
  context_snapshot: z.record(z.string(), z.unknown()).nullable(),
  alternatives: z.array(z.string()).nullable(),
  expires_at: z.string().datetime().nullable(),
  requested_at: z.string().datetime(),
  decided_at: z.string().datetime().nullable(),
  approver_name: z.string().nullable(),
  decision_note: z.string().nullable(),
  separation_of_duties_check: SeparationOfDutiesCheckSchema,
});

export type ApprovalRequestInput = z.infer<typeof ApprovalRequestSchema>;

export const ApprovalDecisionSchema = z.object({
  approver_name: z.string().min(1),
  decision_note: z.string().optional(),
});

export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionSchema>;
