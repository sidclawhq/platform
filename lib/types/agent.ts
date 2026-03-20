import {
  AuthorityModel,
  AutonomyTier,
  DataClassification,
  DelegationModel,
  Environment,
  IdentityMode,
  LifecycleState,
} from './enums';

export interface AuthorizedIntegration {
  name: string;
  resource_scope: string;
  data_classification: DataClassification;
  allowed_operations: string[];
}

export interface Agent {
  id: string;
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
  next_review_date: string;
  recent_activity_state: string;
}
