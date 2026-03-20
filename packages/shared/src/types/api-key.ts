import { ApiKeyScope } from '../enums';

export interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: ApiKeyScope[];
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}
