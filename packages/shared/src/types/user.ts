import { AuthProvider, UserRole } from '../enums';

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: UserRole;
  auth_provider: AuthProvider;
  auth_provider_id: string | null;
  password_hash: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}
