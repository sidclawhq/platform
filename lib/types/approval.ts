import {
  ApprovalStatus,
  AuthorityModel,
  DataClassification,
  PolicyEffect,
  SeparationOfDutiesCheck,
} from './enums';

export interface ApprovalRequest {
  id: string;
  trace_id: string;
  agent_id: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: DataClassification;
  authority_model: AuthorityModel;
  delegated_from: string | null;
  policy_effect: PolicyEffect;
  flag_reason: string;
  status: ApprovalStatus;
  requested_at: string;
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
  separation_of_duties_check: SeparationOfDutiesCheck;
}
