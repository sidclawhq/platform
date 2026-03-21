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
}
