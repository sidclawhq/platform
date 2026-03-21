import { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../generated/prisma/index.js';
import { prisma } from '../db/client.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/v1/dashboard/overview
  app.get('/dashboard/overview', async (request, reply) => {
    const tenantId = request.tenantId!;
    const db = request.tenantPrisma! as unknown as PrismaClient;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

    const [
      totalAgents,
      activeAgents,
      totalPolicies,
      pendingApprovals,
      tracesToday,
      tracesThisWeek,
      topPendingApprovals,
      recentTraces,
      lastJobRun,
    ] = await Promise.all([
      db.agent.count({}),
      db.agent.count({ where: { lifecycle_state: 'active' } }),
      db.policyRule.count({ where: { is_active: true } }),
      db.approvalRequest.count({ where: { status: 'pending' } }),
      db.auditTrace.count({ where: { started_at: { gte: todayStart } } }),
      db.auditTrace.count({ where: { started_at: { gte: weekStart } } }),
      db.approvalRequest.findMany({
        where: { status: 'pending' },
        include: { agent: { select: { name: true } } },
        orderBy: { requested_at: 'asc' },
        take: 5,
      }),
      db.auditTrace.findMany({
        include: { agent: { select: { name: true } } },
        orderBy: { started_at: 'desc' },
        take: 10,
      }),
      // BackgroundJob is unscoped — use global prisma
      prisma.backgroundJob.findFirst({
        orderBy: { last_run_at: 'desc' },
        select: { last_run_at: true },
      }),
    ]);

    // Average approval time via raw query (Prisma doesn't support date diff in aggregates)
    let avgApprovalTimeMinutes: number | null = null;
    try {
      const result = await prisma.$queryRaw<[{ avg_minutes: number | null }]>`
        SELECT AVG(EXTRACT(EPOCH FROM (decided_at - requested_at)) / 60) as avg_minutes
        FROM "ApprovalRequest"
        WHERE tenant_id = ${tenantId}
          AND status IN ('approved', 'denied')
          AND decided_at IS NOT NULL
      `;
      avgApprovalTimeMinutes = result[0]?.avg_minutes ? Math.round(Number(result[0].avg_minutes)) : null;
    } catch {
      avgApprovalTimeMinutes = null;
    }

    // System health
    let dbStatus: 'healthy' | 'degraded' | 'unreachable' = 'healthy';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'unreachable';
    }

    const jobsStatus = lastJobRun?.last_run_at
      ? (Date.now() - lastJobRun.last_run_at.getTime() < 300000 ? 'healthy' : 'stale')
      : 'stale';

    return reply.send({
      stats: {
        total_agents: totalAgents,
        active_agents: activeAgents,
        total_policies: totalPolicies,
        pending_approvals: pendingApprovals,
        traces_today: tracesToday,
        traces_this_week: tracesThisWeek,
        avg_approval_time_minutes: avgApprovalTimeMinutes,
      },
      pending_approvals: topPendingApprovals.map(a => ({
        id: a.id,
        agent_name: a.agent.name,
        operation: a.requested_operation,
        risk_classification: a.risk_classification,
        requested_at: a.requested_at.toISOString(),
        time_pending_seconds: Math.floor((Date.now() - a.requested_at.getTime()) / 1000),
      })),
      recent_traces: recentTraces.map(t => ({
        trace_id: t.id,
        agent_name: t.agent.name,
        operation: t.requested_operation,
        final_outcome: t.final_outcome,
        started_at: t.started_at.toISOString(),
      })),
      system_health: {
        api: 'healthy' as const,
        database: dbStatus,
        background_jobs: jobsStatus,
      },
    });
  });

  // GET /api/v1/search?q=
  app.get('/search', async (request, reply) => {
    const { q } = request.query as { q: string };
    const db = request.tenantPrisma! as unknown as PrismaClient;

    if (!q || q.length < 2) {
      return reply.send({ results: { agents: [], traces: [], policies: [], approvals: [] }, total: 0 });
    }

    const [agents, traces, policies, approvals] = await Promise.all([
      db.agent.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { owner_name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true },
        take: 5,
      }),
      db.auditTrace.findMany({
        where: {
          OR: [
            { requested_operation: { contains: q, mode: 'insensitive' } },
            { target_integration: { contains: q, mode: 'insensitive' } },
            { id: { startsWith: q } },
          ],
        },
        include: { agent: { select: { name: true } } },
        take: 5,
        orderBy: { started_at: 'desc' },
      }),
      db.policyRule.findMany({
        where: {
          is_active: true,
          OR: [
            { policy_name: { contains: q, mode: 'insensitive' } },
            { rationale: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { agent: { select: { name: true } } },
        take: 5,
      }),
      db.approvalRequest.findMany({
        where: {
          OR: [
            { requested_operation: { contains: q, mode: 'insensitive' } },
            { target_integration: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { agent: { select: { name: true } } },
        take: 5,
        orderBy: { requested_at: 'desc' },
      }),
    ]);

    const results = {
      agents: agents.map(a => ({ id: a.id, name: a.name, highlight: a.name })),
      traces: traces.map(t => ({
        trace_id: t.id,
        operation: t.requested_operation,
        agent_name: t.agent.name,
        highlight: `${t.requested_operation} → ${t.target_integration}`,
      })),
      policies: policies.map(p => ({
        id: p.id,
        policy_name: p.policy_name,
        agent_name: p.agent.name,
        highlight: p.policy_name,
      })),
      approvals: approvals.map(a => ({
        id: a.id,
        operation: a.requested_operation,
        agent_name: a.agent.name,
        highlight: `${a.requested_operation} → ${a.target_integration}`,
      })),
    };

    const total = results.agents.length + results.traces.length + results.policies.length + results.approvals.length;

    return reply.send({ results, total });
  });
}
