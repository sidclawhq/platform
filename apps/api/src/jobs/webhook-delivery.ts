import { prisma } from '../db/client.js';
import { WebhookService } from '../services/webhook-service.js';

export async function processWebhookDeliveries(): Promise<void> {
  const webhookService = new WebhookService(prisma);

  // Pick up pending deliveries
  const pending = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "WebhookDelivery"
    WHERE status = 'pending'
    LIMIT 20
    FOR UPDATE SKIP LOCKED
  `;

  // Pick up retries
  const retries = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "WebhookDelivery"
    WHERE status = 'retrying'
      AND next_retry_at < NOW()
    LIMIT 10
    FOR UPDATE SKIP LOCKED
  `;

  const allIds = [...pending, ...retries].map(d => d.id);
  if (allIds.length === 0) return;

  // Deliver in parallel
  await Promise.allSettled(allIds.map(id => webhookService.deliver(id)));
}
