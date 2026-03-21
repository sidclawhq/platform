import { prisma } from '../db/client.js';
import { WebhookService } from '../services/webhook-service.js';

let lastBatchAt: Date = new Date();

export async function auditBatch(): Promise<void> {
  const webhookService = new WebhookService(prisma);
  const cutoff = lastBatchAt;
  const now = new Date();

  // Find all audit events created since last batch
  const events = await prisma.auditEvent.findMany({
    where: {
      timestamp: { gt: cutoff },
      deleted_at: null,
    },
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      tenant_id: true,
      trace_id: true,
      agent_id: true,
      event_type: true,
      actor_type: true,
      actor_name: true,
      description: true,
      status: true,
      timestamp: true,
      policy_version: true,
      integrity_hash: true,
    },
    take: 10000,
  });

  if (events.length === 0) {
    lastBatchAt = now;
    return;
  }

  // Group events by tenant_id for dispatching
  const byTenant = new Map<string, typeof events>();
  for (const event of events) {
    const existing = byTenant.get(event.tenant_id) ?? [];
    existing.push(event);
    byTenant.set(event.tenant_id, existing);
  }

  for (const [tenantId, tenantEvents] of byTenant) {
    const payload = tenantEvents.map(e => ({
      event_id: e.id,
      trace_id: e.trace_id,
      agent_id: e.agent_id,
      event_type: e.event_type,
      actor_type: e.actor_type,
      actor_name: e.actor_name,
      description: e.description,
      status: e.status,
      timestamp: e.timestamp.toISOString(),
      policy_version: e.policy_version,
      integrity_hash: e.integrity_hash,
    }));

    webhookService.dispatch(tenantId, 'audit.batch', {
      events: payload,
      batch_start: cutoff.toISOString(),
      batch_end: now.toISOString(),
      count: payload.length,
    }).catch(() => {});
  }

  lastBatchAt = now;
}
