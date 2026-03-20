import { ApprovalStatusExtended, AuthorityModel, DataClassification, PolicyEffect, RiskClassification, SeparationOfDutiesCheck } from '../enums';

export interface ApprovalRequest {
  id: string;
  tenant_id: string;
  trace_id: string;
  agent_id: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: DataClassification;
  risk_classification: RiskClassification;
  authority_model: AuthorityModel;
  delegated_from: string | null;
  policy_effect: PolicyEffect;
  flag_reason: string;
  status: ApprovalStatusExtended;
  context_snapshot: Record<string, unknown> | null;
  alternatives: string[] | null;
  expires_at: string | null;
  requested_at: string;
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
  separation_of_duties_check: SeparationOfDutiesCheck;
}
