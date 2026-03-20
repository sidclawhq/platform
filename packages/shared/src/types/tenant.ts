import { PlanTier } from '../enums';

export interface TenantSettings {
  default_approval_ttl_seconds: number;
  default_data_classification: string;
  notification_email: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: PlanTier;
  settings: TenantSettings;
  onboarding_state: Record<string, boolean>;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}
