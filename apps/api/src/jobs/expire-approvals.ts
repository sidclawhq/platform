import { prisma } from '../db/client.js';
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
      // Update approval status
      await tx.approvalRequest.update({
        where: { id: approval.id },
        data: { status: 'expired', decided_at: new Date() },
      });

      // Create audit event: approval_expired
      await tx.auditEvent.create({
        data: {
          tenant_id: approval.tenant_id,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          approval_request_id: approval.id,
          event_type: 'approval_expired',
          actor_type: 'system',
          actor_name: 'Approval Expiry Job',
          description: 'Approval request expired — TTL exceeded without reviewer action',
          status: 'expired',
        },
      });

      // Create trace_closed event
      await tx.auditEvent.create({
        data: {
          tenant_id: approval.tenant_id,
          trace_id: approval.trace_id,
          agent_id: approval.agent_id,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: 'Trace completed with outcome: expired',
          status: 'closed',
        },
      });

      // Finalize trace
      await tx.auditTrace.update({
        where: { id: approval.trace_id },
        data: { final_outcome: 'expired', completed_at: new Date() },
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
    console.log(`Expired ${expired.length} approval(s)`);
  }
}
