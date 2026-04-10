import { prisma } from '../db/client.js';
import { logger } from '../logger.js';

export async function cleanupTraces(): Promise<void> {
  // Find free-plan tenants
  const freeTenants = await prisma.tenant.findMany({
    where: { plan: 'free' },
    select: { id: true, settings: true },
  });

  for (const tenant of freeTenants) {
    const settings = tenant.settings as Record<string, unknown>;
    const retentionDays = (settings?.trace_retention_days as number) ?? 7;
    const cutoff = new Date(Date.now() - retentionDays * 86400000);

    // Soft-delete old traces that are NOT pending approval
    const traces = await prisma.auditTrace.findMany({
      where: {
        tenant_id: tenant.id,
        started_at: { lt: cutoff },
        deleted_at: null,
        final_outcome: { notIn: ['in_progress'] },  // don't delete active traces
      },
      select: { id: true },
      take: 1000,
    });

    if (traces.length === 0) continue;

    const traceIds = traces.map(t => t.id);

    // Check none have pending approvals
    const pendingCount = await prisma.approvalRequest.count({
      where: { trace_id: { in: traceIds }, status: 'pending' },
    });

    if (pendingCount > 0) {
      // Filter out traces with pending approvals
      const pendingTraceIds = await prisma.approvalRequest.findMany({
        where: { trace_id: { in: traceIds }, status: 'pending' },
        select: { trace_id: true },
      });
      const excludeIds = new Set(pendingTraceIds.map(p => p.trace_id));
      const safeTraceIds = traceIds.filter(id => !excludeIds.has(id));
      if (safeTraceIds.length === 0) continue;

      await prisma.auditEvent.updateMany({
        where: { trace_id: { in: safeTraceIds }, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      await prisma.auditTrace.updateMany({
        where: { id: { in: safeTraceIds } },
        data: { deleted_at: new Date() },
      });
    } else {
      await prisma.auditEvent.updateMany({
        where: { trace_id: { in: traceIds }, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      await prisma.auditTrace.updateMany({
        where: { id: { in: traceIds } },
        data: { deleted_at: new Date() },
      });
    }

    logger.info({ count: traces.length, tenantId: tenant.id }, 'Soft-deleted traces for tenant');
  }
}
