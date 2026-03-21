import { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../generated/prisma/index.js';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { NotFoundError, ForbiddenError } from '../errors.js';
import { SessionManager } from '../auth/session.js';
import { requireRole } from '../middleware/require-role.js';

const UpdateUserRoleSchema = z.object({
  role: z.enum(['viewer', 'reviewer', 'admin']),
});

const sessionManager = new SessionManager(prisma);

export async function userRoutes(app: FastifyInstance) {
  // GET /api/v1/users — list users in tenant (admin only)
  app.get('/users', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const db = request.tenantPrisma! as unknown as PrismaClient;
    const query = request.query as { limit?: string; offset?: string };

    const take = Math.min(parseInt(query.limit ?? '50', 10) || 50, 100);
    const skip = parseInt(query.offset ?? '0', 10) || 0;

    const [users, total] = await Promise.all([
      db.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          last_login_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
        take,
        skip,
      }),
      db.user.count(),
    ]);

    return reply.send({
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        last_login_at: u.last_login_at?.toISOString() ?? null,
        created_at: u.created_at.toISOString(),
      })),
      pagination: { total, limit: take, offset: skip },
    });
  });

  // PATCH /api/v1/users/:id — update role (admin only)
  app.patch('/users/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const db = request.tenantPrisma! as unknown as PrismaClient;
    const { id } = request.params as { id: string };
    const body = UpdateUserRoleSchema.parse(request.body);

    // Cannot change your own role
    if (id === request.userId) {
      throw new ForbiddenError('Cannot change your own role');
    }

    const user = await db.user.findFirst({
      where: { id },
    });

    if (!user) throw new NotFoundError('User', id);

    // Use updateMany to work with tenant-scoped prisma (update requires unique where)
    await db.user.updateMany({
      where: { id },
      data: { role: body.role },
    });

    const updated = await db.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        last_login_at: true,
        created_at: true,
      },
    });

    return reply.send({
      data: {
        id: updated!.id,
        email: updated!.email,
        name: updated!.name,
        role: updated!.role,
        last_login_at: updated!.last_login_at?.toISOString() ?? null,
        created_at: updated!.created_at.toISOString(),
      },
    });
  });

  // DELETE /api/v1/users/:id — remove user from tenant (admin only)
  app.delete('/users/:id', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const db = request.tenantPrisma! as unknown as PrismaClient;
    const { id } = request.params as { id: string };

    // Cannot delete yourself
    if (id === request.userId) {
      throw new ForbiddenError('Cannot delete yourself');
    }

    const user = await db.user.findFirst({
      where: { id },
    });

    if (!user) throw new NotFoundError('User', id);

    // Invalidate all sessions for this user immediately
    await sessionManager.destroyAllForUser(id);

    // Use deleteMany to work with tenant-scoped prisma (delete requires unique where)
    await db.user.deleteMany({ where: { id } });

    return reply.status(204).send();
  });
}
