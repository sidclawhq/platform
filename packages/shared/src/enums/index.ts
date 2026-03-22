import { z } from 'zod';

// --- From v0 ---

export const EnvironmentValues = ['dev', 'test', 'prod'] as const;
export type Environment = (typeof EnvironmentValues)[number];
export const EnvironmentSchema = z.enum(EnvironmentValues);

export const AuthorityModelValues = ['self', 'delegated', 'hybrid'] as const;
export type AuthorityModel = (typeof AuthorityModelValues)[number];
export const AuthorityModelSchema = z.enum(AuthorityModelValues);

export const IdentityModeValues = ['service_identity', 'delegated_identity', 'hybrid_identity'] as const;
export type IdentityMode = (typeof IdentityModeValues)[number];
export const IdentityModeSchema = z.enum(IdentityModeValues);

export const DelegationModelValues = ['self', 'on_behalf_of_user', 'on_behalf_of_owner', 'mixed'] as const;
export type DelegationModel = (typeof DelegationModelValues)[number];
export const DelegationModelSchema = z.enum(DelegationModelValues);

export const AutonomyTierValues = ['low', 'medium', 'high'] as const;
export type AutonomyTier = (typeof AutonomyTierValues)[number];
export const AutonomyTierSchema = z.enum(AutonomyTierValues);

export const LifecycleStateValues = ['active', 'suspended', 'revoked'] as const;
export type LifecycleState = (typeof LifecycleStateValues)[number];
export const LifecycleStateSchema = z.enum(LifecycleStateValues);

export const DataClassificationValues = ['public', 'internal', 'confidential', 'restricted'] as const;
export type DataClassification = (typeof DataClassificationValues)[number];
export const DataClassificationSchema = z.enum(DataClassificationValues);

export const PolicyEffectValues = ['allow', 'approval_required', 'deny'] as const;
export type PolicyEffect = (typeof PolicyEffectValues)[number];
export const PolicyEffectSchema = z.enum(PolicyEffectValues);

export const ApprovalStatusValues = ['pending', 'approved', 'denied'] as const;
export type ApprovalStatus = (typeof ApprovalStatusValues)[number];
export const ApprovalStatusSchema = z.enum(ApprovalStatusValues);

export const SeparationOfDutiesCheckValues = ['pass', 'fail', 'not_applicable'] as const;
export type SeparationOfDutiesCheck = (typeof SeparationOfDutiesCheckValues)[number];
export const SeparationOfDutiesCheckSchema = z.enum(SeparationOfDutiesCheckValues);

export const TraceOutcomeValues = ['pending', 'executed', 'blocked', 'denied', 'completed_with_approval'] as const;
export type TraceOutcome = (typeof TraceOutcomeValues)[number];
export const TraceOutcomeSchema = z.enum(TraceOutcomeValues);

export const ActorTypeValues = ['agent', 'policy_engine', 'approval_service', 'human_reviewer', 'system'] as const;
export type ActorType = (typeof ActorTypeValues)[number];
export const ActorTypeSchema = z.enum(ActorTypeValues);

export const EventTypeValues = [
  'trace_initiated',
  'identity_resolved',
  'delegation_resolved',
  'policy_evaluated',
  'sensitive_operation_detected',
  'approval_required',
  'approval_granted',
  'approval_denied',
  'operation_executed',
  'operation_blocked',
  'trace_closed',
] as const;
export type EventType = (typeof EventTypeValues)[number];
export const EventTypeSchema = z.enum(EventTypeValues);

// --- New for production ---

export const ApprovalStatusExtendedValues = ['pending', 'approved', 'denied', 'expired'] as const;
export type ApprovalStatusExtended = (typeof ApprovalStatusExtendedValues)[number];
export const ApprovalStatusExtendedSchema = z.enum(ApprovalStatusExtendedValues);

export const TraceOutcomeExtendedValues = ['pending', 'executed', 'blocked', 'denied', 'completed_with_approval', 'expired'] as const;
export type TraceOutcomeExtended = (typeof TraceOutcomeExtendedValues)[number];
export const TraceOutcomeExtendedSchema = z.enum(TraceOutcomeExtendedValues);

export const RiskClassificationValues = ['low', 'medium', 'high', 'critical'] as const;
export type RiskClassification = (typeof RiskClassificationValues)[number];
export const RiskClassificationSchema = z.enum(RiskClassificationValues);

export const UserRoleValues = ['admin', 'reviewer', 'viewer'] as const;
export type UserRole = (typeof UserRoleValues)[number];
export const UserRoleSchema = z.enum(UserRoleValues);

export const AuthProviderValues = ['okta', 'auth0', 'github', 'google', 'email'] as const;
export type AuthProvider = (typeof AuthProviderValues)[number];
export const AuthProviderSchema = z.enum(AuthProviderValues);

export const PlanTierValues = ['free', 'starter', 'business', 'enterprise'] as const;
export type PlanTier = (typeof PlanTierValues)[number];
export const PlanTierSchema = z.enum(PlanTierValues);

export const ApiKeyScopeValues = ['evaluate', 'traces:read', 'traces:write', 'agents:read', 'approvals:read', 'admin'] as const;
export type ApiKeyScope = (typeof ApiKeyScopeValues)[number];
export const ApiKeyScopeSchema = z.enum(ApiKeyScopeValues);

export const WebhookEventTypeValues = [
  'approval.requested',
  'approval.approved',
  'approval.denied',
  'approval.expired',
  'trace.completed',
  'agent.suspended',
  'agent.revoked',
  'policy.updated',
] as const;
export type WebhookEventType = (typeof WebhookEventTypeValues)[number];
export const WebhookEventTypeSchema = z.enum(WebhookEventTypeValues);
