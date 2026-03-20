import { z } from 'zod';
import { DataClassificationSchema, PolicyEffectSchema } from '../enums';

export const PolicyRuleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  policy_name: z.string().min(1),
  authorized_integration: z.string().min(1),
  operation: z.string().min(1),
  resource_scope: z.string().min(1),
  data_classification: DataClassificationSchema,
  policy_effect: PolicyEffectSchema,
  rationale: z.string().min(10).max(1000),
  priority: z.number().int(),
  conditions: z.record(z.string(), z.unknown()).nullable(),
  max_session_ttl: z.number().int().positive().nullable(),
  is_active: z.boolean(),
  policy_version: z.number().int().nonnegative(),
  modified_by: z.string().min(1),
  modified_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PolicyRuleInput = z.infer<typeof PolicyRuleSchema>;

export const PolicyRuleVersionSchema = z.object({
  id: z.string().uuid(),
  policy_rule_id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  policy_name: z.string().min(1),
  operation: z.string().min(1),
  authorized_integration: z.string().min(1),
  resource_scope: z.string().min(1),
  data_classification: DataClassificationSchema,
  policy_effect: PolicyEffectSchema,
  rationale: z.string().min(10).max(1000),
  priority: z.number().int(),
  conditions: z.record(z.string(), z.unknown()).nullable(),
  max_session_ttl: z.number().int().positive().nullable(),
  modified_by: z.string().min(1),
  modified_at: z.string().datetime(),
  change_summary: z.string().nullable(),
});

export type PolicyRuleVersionInput = z.infer<typeof PolicyRuleVersionSchema>;

export const PolicyRuleCreateSchema = PolicyRuleSchema.omit({
  id: true,
  tenant_id: true,
  policy_version: true,
  created_at: true,
  updated_at: true,
  is_active: true,
});

export type PolicyRuleCreateInput = z.infer<typeof PolicyRuleCreateSchema>;

export const PolicyRuleUpdateSchema = PolicyRuleSchema.pick({ id: true }).merge(
  PolicyRuleSchema.omit({ id: true }).partial(),
);

export type PolicyRuleUpdateInput = z.infer<typeof PolicyRuleUpdateSchema>;
