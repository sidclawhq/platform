import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';

export async function adminRoutes(app: FastifyInstance) {
  // GET /api/v1/admin/usage — platform-wide usage stats
  // SUPER ADMIN endpoint — only accessible with a special admin API key
  // NOT accessible to regular tenant admins
  app.get('/admin/usage', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const superAdminKey = process.env['SUPER_ADMIN_KEY'];
    if (!superAdminKey || authHeader !== `Bearer ${superAdminKey}`) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Super admin access required', status: 403 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const oneDayAgo = new Date(Date.now() - 86400000);

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        created_at: true,
        stripe_customer_id: true,
        _count: {
          select: {
            users: true,
            agents: true,
            policy_rules: true,
            api_keys: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const enriched = await Promise.all(tenants.map(async (tenant) => {
      const [tracesToday, tracesWeek, lastTrace] = await Promise.all([
        prisma.auditTrace.count({
          where: { tenant_id: tenant.id, started_at: { gte: oneDayAgo } },
        }),
        prisma.auditTrace.count({
          where: { tenant_id: tenant.id, started_at: { gte: sevenDaysAgo } },
        }),
        prisma.auditTrace.findFirst({
          where: { tenant_id: tenant.id },
          orderBy: { started_at: 'desc' },
          select: { started_at: true },
        }),
      ]);

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        created_at: tenant.created_at.toISOString(),
        stripe_customer_id: tenant.stripe_customer_id,
        agents: tenant._count.agents,
        users: tenant._count.users,
        policies: tenant._count.policy_rules,
        api_keys: tenant._count.api_keys,
        traces_today: tracesToday,
        traces_this_week: tracesWeek,
        last_active: lastTrace?.started_at?.toISOString() ?? null,
        is_paying: tenant.plan !== 'free',
      };
    }));

    const summary = {
      total_tenants: tenants.length,
      paying_tenants: tenants.filter(t => t.plan !== 'free').length,
      free_tenants: tenants.filter(t => t.plan === 'free').length,
      total_traces_today: enriched.reduce((sum, t) => sum + t.traces_today, 0),
      total_traces_week: enriched.reduce((sum, t) => sum + t.traces_this_week, 0),
      active_today: enriched.filter(t => t.traces_today > 0).length,
      active_this_week: enriched.filter(t => t.traces_this_week > 0).length,
    };

    return reply.send({ summary, tenants: enriched });
  });
}
