import { z } from 'zod';
import { AuthProviderSchema, UserRoleSchema } from '../enums';

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  auth_provider: AuthProviderSchema,
  auth_provider_id: z.string().nullable(),
  password_hash: z.string().nullable(),
  last_login_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UserInput = z.infer<typeof UserSchema>;
