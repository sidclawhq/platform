import { z } from 'zod';
import { PlanTierSchema } from '../enums';

export const TenantSettingsSchema = z.object({
  default_approval_ttl_seconds: z.number().int().positive(),
  default_data_classification: z.string().min(1),
  notification_email: z.string().email().nullable(),
});

export type TenantSettingsInput = z.infer<typeof TenantSettingsSchema>;

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  plan: PlanTierSchema,
  settings: TenantSettingsSchema,
  onboarding_state: z.record(z.string(), z.boolean()),
  stripe_customer_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type TenantInput = z.infer<typeof TenantSchema>;
