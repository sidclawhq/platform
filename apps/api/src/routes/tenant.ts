import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';
import { requireRole } from '../middleware/require-role.js';

const UpdateTenantSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.object({
    default_approval_ttl_seconds: z.number().int().min(60).max(604800).optional(),
    default_data_classification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
    notification_email: z.string().email().nullable().optional(),
    notifications_enabled: z.boolean().optional(),
  }).optional(),
}).strict();

function formatTenantResponse(tenant: {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: unknown;
}) {
  const settings = tenant.settings as Record<string, unknown>;
  return {
    data: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      settings: {
        default_approval_ttl_seconds: (settings.default_approval_ttl_seconds as number) ?? 86400,
        default_data_classification: (settings.default_data_classification as string) ?? 'internal',
        notification_email: (settings.notification_email as string | null) ?? null,
        notifications_enabled: (settings.notifications_enabled as boolean) ?? false,
      },
    },
  };
}

export async function tenantRoutes(app: FastifyInstance) {
  // GET /api/v1/tenant/info — returns the runtime's canonical API URL plus
  // tenant id/name. Used by the dashboard's Connect page to derive the
  // `apiBaseUrl` that appears in copy-paste snippets, without relying on
  // `window.location` heuristics (which misfire on custom self-hosted
  // domains).
  app.get('/tenant/info', async (request, reply) => {
    const tenantId = request.tenantId!;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, plan: true },
    });
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    // PUBLIC_API_URL (or API_PUBLIC_URL) must be an explicit server-side
    // override; deriving from request headers under trustProxy=true is a
    // host-header-injection sink — an attacker could send X-Forwarded-Host
    // to poison the api_url string this endpoint returns, and the dashboard
    // Connect page would then embed the attacker host into copy-paste
    // snippets that leak API keys.
    //
    // Production startup in server.ts fails fast if neither env is set.
    // In development we fall back to the request's protocol + host (NOT
    // hostname, which drops the port under Fastify 5), so localhost:3001
    // produces working snippets.
    const configuredApiUrl =
      (process.env.PUBLIC_API_URL ?? '').replace(/\/+$/, '') ||
      (process.env.API_PUBLIC_URL ?? '').replace(/\/+$/, '');
    const publicApiUrl =
      configuredApiUrl || `${request.protocol}://${request.host}`;

    return reply.send({
      data: {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_slug: tenant.slug,
        plan: tenant.plan,
        api_url: publicApiUrl,
      },
    });
  });

  // GET /api/v1/tenant/settings — any authenticated user can read
  app.get('/tenant/settings', async (request, reply) => {
    const tenantId = request.tenantId!;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    return reply.send(formatTenantResponse(tenant));
  });

  // PATCH /api/v1/tenant/settings — admin only
  app.patch('/tenant/settings', {
    preHandler: requireRole('admin'),
  }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const body = UpdateTenantSettingsSchema.parse(request.body);

    const existing = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!existing) throw new NotFoundError('Tenant', tenantId);

    const currentSettings = existing.settings as Record<string, unknown>;
    const updatedSettings = body.settings
      ? { ...currentSettings, ...body.settings }
      : currentSettings;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        settings: updatedSettings as Parameters<typeof prisma.tenant.update>[0]['data']['settings'],
      },
    });

    return reply.send(formatTenantResponse(updated));
  });

  // GET /api/v1/tenant/onboarding — returns onboarding state with auto-detection
  app.get('/tenant/onboarding', async (request, reply) => {
    const tenantId = request.tenantId!;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboarding_state: true },
    });

    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const state = tenant.onboarding_state as Record<string, boolean>;

    // Auto-detect completed steps
    const [agentCount, policyCount, traceCount] = await Promise.all([
      prisma.agent.count({ where: { tenant_id: tenantId } }),
      prisma.policyRule.count({ where: { tenant_id: tenantId } }),
      prisma.auditTrace.count({ where: { tenant_id: tenantId } }),
    ]);

    const resolved = {
      copy_api_key: state.copy_api_key ?? false,
      register_agent: (state.register_agent ?? false) || agentCount > 0,
      create_policy: (state.create_policy ?? false) || policyCount > 0,
      run_evaluation: (state.run_evaluation ?? false) || traceCount > 0,
      see_trace: state.see_trace ?? false,
    };

    return reply.send({ data: resolved });
  });

  const UpdateOnboardingSchema = z.object({
    copy_api_key: z.boolean().optional(),
    register_agent: z.boolean().optional(),
    create_policy: z.boolean().optional(),
    run_evaluation: z.boolean().optional(),
    see_trace: z.boolean().optional(),
  }).strict();

  // PATCH /api/v1/tenant/onboarding — update step completion
  app.patch('/tenant/onboarding', async (request, reply) => {
    const tenantId = request.tenantId!;
    const body = UpdateOnboardingSchema.parse(request.body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboarding_state: true },
    });
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const currentState = tenant.onboarding_state as Record<string, boolean>;
    const updatedState = { ...currentState, ...body };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { onboarding_state: updatedState },
    });

    return reply.send({ data: updatedState });
  });
}
