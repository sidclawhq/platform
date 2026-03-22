import { z } from 'zod';
import { DataClassificationSchema, PolicyEffectSchema } from '../enums';

export const PolicyRuleSchema = z.object({
  id: z.string().min(1),
  tenant_id: z.string().min(1),
  agent_id: z.string().min(1),
  policy_name: z.string().min(1),
  target_integration: z.string().min(1),
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
  id: z.string().min(1),
  policy_rule_id: z.string().min(1),
  version: z.number().int().nonnegative(),
  policy_name: z.string().min(1),
  operation: z.string().min(1),
  target_integration: z.string().min(1),
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
}).extend({
  // Override to make these optional with defaults for create:
  conditions: z.record(z.string(), z.unknown()).nullable().optional().default(null),
  max_session_ttl: z.number().int().positive().nullable().optional().default(null),
  modified_at: z.string().datetime().optional().default(() => new Date().toISOString()),
  priority: z.number().int().optional().default(100),
});

export type PolicyRuleCreateInput = z.infer<typeof PolicyRuleCreateSchema>;

/** Schema for PATCH /policies/:id body — partial of mutable policy fields */
export const PolicyRuleUpdateSchema = PolicyRuleSchema.pick({
  policy_name: true,
  target_integration: true,
  operation: true,
  resource_scope: true,
  data_classification: true,
  policy_effect: true,
  rationale: true,
  priority: true,
  conditions: true,
  max_session_ttl: true,
}).partial();

export type PolicyRuleUpdateInput = z.infer<typeof PolicyRuleUpdateSchema>;
