import { z } from 'zod';
import {
  AuthorityModelSchema,
  AutonomyTierSchema,
  DataClassificationSchema,
  DelegationModelSchema,
  EnvironmentSchema,
  IdentityModeSchema,
  LifecycleStateSchema,
} from '../enums';

export const AuthorizedIntegrationSchema = z.object({
  name: z.string().min(1),
  resource_scope: z.string().min(1),
  data_classification: DataClassificationSchema,
  allowed_operations: z.array(z.string().min(1)),
});

export type AuthorizedIntegrationInput = z.infer<typeof AuthorizedIntegrationSchema>;

export const AgentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  owner_name: z.string().min(1),
  owner_role: z.string().min(1),
  team: z.string().min(1),
  environment: EnvironmentSchema,
  authority_model: AuthorityModelSchema,
  identity_mode: IdentityModeSchema,
  delegation_model: DelegationModelSchema,
  autonomy_tier: AutonomyTierSchema,
  lifecycle_state: LifecycleStateSchema,
  authorized_integrations: z.array(AuthorizedIntegrationSchema),
  credential_config: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  next_review_date: z.string().datetime(),
  created_by: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AgentInput = z.infer<typeof AgentSchema>;

export const AgentCreateSchema = AgentSchema.omit({
  id: true,
  tenant_id: true,
  created_at: true,
  updated_at: true,
  lifecycle_state: true,
}).extend({
  authorized_integrations: z.array(AuthorizedIntegrationSchema).default([]),
  credential_config: z.record(z.string(), z.unknown()).nullable().default(null),
  metadata: z.record(z.string(), z.unknown()).nullable().default(null),
  next_review_date: z.string().datetime().nullable().default(null),
});

export type AgentCreateInput = z.infer<typeof AgentCreateSchema>;

export const AgentUpdateSchema = AgentSchema.pick({ id: true }).merge(
  AgentSchema.omit({ id: true }).partial(),
);

export type AgentUpdateInput = z.infer<typeof AgentUpdateSchema>;
