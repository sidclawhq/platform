import { z } from 'zod';
import { ApiKeyScopeSchema } from '../enums';

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  key_prefix: z.string().min(1),
  key_hash: z.string().min(1),
  scopes: z.array(ApiKeyScopeSchema),
  expires_at: z.string().datetime().nullable(),
  last_used_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type ApiKeyInput = z.infer<typeof ApiKeySchema>;
