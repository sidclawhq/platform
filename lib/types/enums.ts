export type Environment = 'dev' | 'test' | 'prod';

export type AuthorityModel = 'self' | 'delegated' | 'hybrid';

export type IdentityMode = 'service_identity' | 'delegated_identity' | 'hybrid_identity';

export type DelegationModel = 'self' | 'on_behalf_of_user' | 'on_behalf_of_owner' | 'mixed';

export type AutonomyTier = 'low' | 'medium' | 'high';

export type LifecycleState = 'active' | 'suspended' | 'revoked';

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export type PolicyEffect = 'allow' | 'approval_required' | 'deny';

export type ApprovalStatus = 'pending' | 'approved' | 'denied';

export type SeparationOfDutiesCheck = 'pass' | 'fail' | 'not_applicable';

export type TraceOutcome = 'pending' | 'executed' | 'blocked' | 'denied' | 'completed_with_approval';

export type ActorType = 'agent' | 'policy_engine' | 'approval_service' | 'human_reviewer' | 'system';

export type EventType =
  | 'trace_initiated'
  | 'identity_resolved'
  | 'delegation_resolved'
  | 'policy_evaluated'
  | 'sensitive_operation_detected'
  | 'approval_required'
  | 'approval_granted'
  | 'approval_denied'
  | 'operation_executed'
  | 'operation_blocked'
  | 'trace_closed';
