import { randomUUID } from 'crypto';
import { prisma } from '../db/client.js';
import type { PrismaClient } from '../generated/prisma/index.js';
import { logger } from '../logger.js';
import { IntegrityService } from '../services/integrity-service.js';
import { WebhookService } from '../services/webhook-service.js';

export async function expireApprovals(): Promise<void> {
  const webhookService = new WebhookService(prisma);
  // Find pending approvals past their expiration time
  // Use SELECT ... FOR UPDATE SKIP LOCKED to prevent duplicate processing
  const expired = await prisma.$queryRaw<Array<{ id: string; trace_id: string; agent_id: string; tenant_id: string }>>`
    SELECT id, trace_id, agent_id, tenant_id
    FROM "ApprovalRequest"
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  `;

  for (const approval of expired) {
    await prisma.$transaction(async (tx) => {
      const integrity = new IntegrityService(tx as unknown as PrismaClient);

      // Update approval status
      await tx.approvalRequest.update({
        where: { id: approval.id },
        data: { status: 'expired', decided_at: new Date() },
      });

      // Lock trace for hash chain serialization
      await tx.$queryRaw`SELECT id FROM "AuditTrace" WHERE id = ${approval.trace_id} FOR UPDATE`;

      // Create audit event: approval_expired
      const expiredEventId = randomUUID();
      const expiredTimestamp = new Date();
      const expiredHash = await integrity.computeEventHash(
        tx as unknown as PrismaClient,
        approval.trace_id,
        {
          id: expiredEventId,
          event_type: 'approval_expired',
          actor_type: 'system',
          actor_name: 'Approval Expiry Job',
          description: 'Approval request expired — TTL exceeded without reviewer action',
          status: 'expired',
          timestamp: expiredTimestamp,
        },
      );
      await tx.auditEvent.create({
        data: {
          id: expiredEventId,
          tenant_id: approval.tenant_id,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          approval_request_id: approval.id,
          event_type: 'approval_expired',
          actor_type: 'system',
          actor_name: 'Approval Expiry Job',
          description: 'Approval request expired — TTL exceeded without reviewer action',
          status: 'expired',
          timestamp: expiredTimestamp,
          integrity_hash: expiredHash,
        },
      });

      // Create trace_closed event
      const closeEventId = randomUUID();
      const closeTimestamp = new Date();
      const closeHash = await integrity.computeEventHash(
        tx as unknown as PrismaClient,
        approval.trace_id,
        {
          id: closeEventId,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: 'Trace completed with outcome: expired',
          status: 'closed',
          timestamp: closeTimestamp,
        },
      );
      await tx.auditEvent.create({
        data: {
          id: closeEventId,
          tenant_id: approval.tenant_id,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: 'Trace completed with outcome: expired',
          status: 'closed',
          timestamp: closeTimestamp,
          integrity_hash: closeHash,
        },
      });

      // Finalize trace
      await tx.auditTrace.update({
        where: { id: approval.trace_id },
        data: {
          final_outcome: 'expired',
          completed_at: new Date(),
          integrity_hash: closeHash,
        },
      });
    });

    // Webhook dispatch — AFTER transaction commits
    webhookService.dispatch(approval.tenant_id, 'approval.expired', {
      approval_request: {
        id: approval.id,
        trace_id: approval.trace_id,
        agent_id: approval.agent_id,
      },
    }).catch(() => {});
  }

  if (expired.length > 0) {
    logger.info({ count: expired.length }, 'Expired pending approvals');
  }
}
