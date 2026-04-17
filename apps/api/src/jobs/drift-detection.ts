import { prisma } from '../db/client.js';
import { logger } from '../logger.js';
import { DriftDetectionService } from '../services/drift-detection-service.js';
import { WebhookService } from '../services/webhook-service.js';

/**
 * Periodic drift detection — runs hourly, scans every tenant's agents, and
 * dispatches `agent.drift_detected` webhook events when statistical
 * anomalies appear.
 */
export async function detectDrift(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, plan: true },
  });

  const service = new DriftDetectionService(prisma);
  const webhookService = new WebhookService(prisma);

  for (const tenant of tenants) {
    try {
      const signals = await service.detectForTenant(tenant.id);
      if (signals.length === 0) continue;

      logger.info(
        { tenantId: tenant.id, signals: signals.length },
        'drift signals detected',
      );

      for (const signal of signals) {
        // Fire-and-forget — webhook failure must not block further detection
        webhookService
          .dispatch(tenant.id, 'agent.drift_detected', {
            agent_id: signal.agent_id,
            trigger: signal.trigger,
            severity: signal.severity,
            detail: signal.detail,
            recent_window_minutes: signal.recent_window_minutes,
            historical_window_hours: signal.historical_window_hours,
            metrics: signal.metrics,
            detected_at: new Date().toISOString(),
          })
          .catch((err) => {
            logger.warn({ err, signal }, 'drift webhook dispatch failed');
          });
      }
    } catch (err) {
      logger.error(
        { err, tenantId: tenant.id },
        'drift detection failed for tenant',
      );
    }
  }
}
