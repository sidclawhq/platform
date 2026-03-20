import { DataClassification, PolicyEffect } from '../enums';

export interface PolicyRule {
  id: string;
  tenant_id: string;
  agent_id: string;
  policy_name: string;
  authorized_integration: string;
  operation: string;
  resource_scope: string;
  data_classification: DataClassification;
  policy_effect: PolicyEffect;
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
}

export interface PolicyRuleVersion {
  id: string;
  policy_rule_id: string;
  version: number;
  policy_name: string;
  operation: string;
  authorized_integration: string;
  resource_scope: string;
  data_classification: DataClassification;
  policy_effect: PolicyEffect;
  rationale: string;
  priority: number;
  conditions: Record<string, unknown> | null;
  max_session_ttl: number | null;
  modified_by: string;
  modified_at: string;
  change_summary: string | null;
}
