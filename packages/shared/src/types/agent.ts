import { AuthorityModel, AutonomyTier, DataClassification, DelegationModel, Environment, IdentityMode, LifecycleState } from '../enums';

export interface AuthorizedIntegration {
  name: string;
  resource_scope: string;
  data_classification: DataClassification;
  allowed_operations: string[];
}

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  owner_name: string;
  owner_role: string;
  team: string;
  environment: Environment;
  authority_model: AuthorityModel;
  identity_mode: IdentityMode;
  delegation_model: DelegationModel;
  autonomy_tier: AutonomyTier;
  lifecycle_state: LifecycleState;
  authorized_integrations: AuthorizedIntegration[];
  credential_config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  next_review_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
