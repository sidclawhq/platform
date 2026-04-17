import type { PrismaClient } from '../generated/prisma/index.js';
import { createHmac } from 'node:crypto';
import { safeFetch, UrlSafetyError } from '../lib/url-safety.js';
import { WebhookEventTypeValues, type WebhookEventType } from '@sidclaw/shared';

// Re-export so other modules keep importing from the service barrel, but the
// source of truth is `@sidclaw/shared` — avoids drift between local unions
// and the shared Zod enum used for webhook-create validation and response
// shape validation.
export type { WebhookEventType };
export const VALID_WEBHOOK_EVENT_TYPES: readonly WebhookEventType[] = WebhookEventTypeValues;

export class WebhookService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Dispatches a webhook event. Creates delivery records for all matching endpoints.
   * This MUST be called AFTER the primary transaction commits.
   * Failures here do NOT affect the primary operation.
   */
  async dispatch(tenantId: string, event: WebhookEventType, data: Record<string, unknown>): Promise<void> {
    try {
      const endpoints = await this.prisma.webhookEndpoint.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
          events: { has: event },
        },
      });

      if (endpoints.length === 0) return;

      const payload = {
        id: crypto.randomUUID(),
        event,
        timestamp: new Date().toISOString(),
        tenant_id: tenantId,
        data,
      };

      await this.prisma.webhookDelivery.createMany({
        data: endpoints.map(endpoint => ({
          endpoint_id: endpoint.id,
          event_type: event,
          payload: payload as any,
          status: 'pending',
        })),
      });
    } catch (error) {
      // Log but don't throw — webhook dispatch failures must not affect primary operations
      console.error('Webhook dispatch error:', error);
    }
  }

  /**
   * Delivers a single pending webhook.
   */
  async deliver(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });

    if (!delivery || delivery.status === 'delivered') return;

    const payload = JSON.stringify(delivery.payload);
    const signature = 'sha256=' + createHmac('sha256', delivery.endpoint.secret).update(payload).digest('hex');

    try {
      // safeFetch does: (a) SSRF validation via assertUrlIsSafe, (b) pins the
      // socket dial to the pre-resolved IP so DNS can't rebind between check
      // and fetch, (c) rejects on 3xx responses. Any SSRF violation (including
      // redirect-to-private) throws UrlSafetyError.
      let response: Response;
      try {
        response = await safeFetch(delivery.endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-ID': delivery.id,
            'X-Webhook-Timestamp': new Date().toISOString(),
            'X-Webhook-Signature': signature,
          },
          body: payload,
          timeoutMs: 10_000,
        });
      } catch (safetyError) {
        if (safetyError instanceof UrlSafetyError) {
          // SSRF violations are permanent — do not retry, mark as failed.
          // This covers pre-flight rejection AND redirect-to-private (reason='redirect_blocked').
          const message = `blocked by SSRF guard: ${safetyError.reason} — ${safetyError.message}`;
          await this.prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
              status: 'failed',
              http_status: null,
              response_body: message.substring(0, 1000),
              attempts: delivery.attempts + 1,
            },
          });
          return;
        }
        // Network errors, timeouts, etc. — retryable.
        await this.scheduleRetry(deliveryId, delivery.attempts + 1, null, String(safetyError));
        return;
      }

      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await this.prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'delivered',
            http_status: response.status,
            response_body: responseBody.substring(0, 1000),
            delivered_at: new Date(),
            attempts: delivery.attempts + 1,
          },
        });
      } else {
        await this.scheduleRetry(deliveryId, delivery.attempts + 1, response.status, responseBody);
      }
    } catch (error) {
      await this.scheduleRetry(deliveryId, delivery.attempts + 1, null, String(error));
    }
  }

  private async scheduleRetry(deliveryId: string, attempts: number, httpStatus: number | null, responseBody: string) {
    const retryDelays = [60, 300, 1800, 7200]; // 1m, 5m, 30m, 2h
    const maxAttempts = 5;

    if (attempts >= maxAttempts) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'failed',
          http_status: httpStatus,
          response_body: responseBody.substring(0, 1000),
          attempts,
        },
      });
      return;
    }

    const delaySeconds = retryDelays[attempts - 1] ?? 7200;
    const nextRetry = new Date(Date.now() + delaySeconds * 1000);

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'retrying',
        http_status: httpStatus,
        response_body: responseBody.substring(0, 1000),
        attempts,
        next_retry_at: nextRetry,
      },
    });
  }
}
