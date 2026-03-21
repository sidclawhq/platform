import { PrismaClient } from '../generated/prisma/index.js';
import { createHash, randomBytes } from 'node:crypto';
import { ConflictError } from '../errors.js';

export interface ProvisionResult {
  user: { id: string; email: string; name: string; role: string; tenant_id: string };
  tenant: { id: string; name: string; slug: string; plan: string };
  apiKey: string;
}

const DEFAULT_ONBOARDING_STATE = {
  copy_api_key: false,
  register_agent: false,
  create_policy: false,
  run_evaluation: false,
  see_trace: false,
};

const DEFAULT_API_KEY_SCOPES = ['evaluate', 'traces:read', 'traces:write', 'approvals:read'];

export async function provisionNewUser(
  prisma: PrismaClient,
  params: {
    email: string;
    name: string;
    authProvider: string;
    authProviderId: string | null;
    passwordHash: string | null;
  }
): Promise<ProvisionResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: params.email } });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const tenantName = `${params.name}'s workspace`;
    const tenantSlug =
      params.email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9]/g, '-') +
      '-' +
      Date.now().toString(36);

    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        plan: 'free',
        settings: {
          default_approval_ttl_seconds: 86400,
          default_data_classification: 'internal',
          notification_email: params.email,
          notifications_enabled: true,
        },
        onboarding_state: DEFAULT_ONBOARDING_STATE,
      },
    });

    const user = await tx.user.create({
      data: {
        tenant_id: tenant.id,
        email: params.email,
        name: params.name,
        role: 'admin',
        auth_provider: params.authProvider,
        auth_provider_id: params.authProviderId,
        password_hash: params.passwordHash,
      },
    });

    const rawKey = 'ai_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    await tx.apiKey.create({
      data: {
        tenant_id: tenant.id,
        name: 'Default Key',
        key_prefix: rawKey.substring(0, 12),
        key_hash: keyHash,
        scopes: DEFAULT_API_KEY_SCOPES,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: tenant.id,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
      apiKey: rawKey,
    };
  });
}
