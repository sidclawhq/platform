import { DataClassification, PolicyEffect } from './enums';

export interface PolicyRule {
  id: string;
  agent_id: string;
  policy_name: string;
  authorized_integration: string;
  operation: string;
  resource_scope: string;
  data_classification: DataClassification;
  policy_effect: PolicyEffect;
  rationale: string;
  policy_version: string;
  modified_by: string;
  modified_at: string;
  max_session_ttl: string | null;
}
