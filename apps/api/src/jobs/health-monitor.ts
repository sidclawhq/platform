import { EmailService } from '../services/email-service.js';

const SERVICES = [
  { name: 'API', url: 'https://api.sidclaw.com/health', expectJson: true },
  { name: 'Dashboard', url: 'https://app.sidclaw.com', expectStatus: [200, 307, 308] },
  { name: 'Docs', url: 'https://docs.sidclaw.com', expectStatus: [200] },
  { name: 'Landing', url: 'https://sidclaw.com', expectStatus: [200] },
  { name: 'Demo (Atlas)', url: 'https://demo.sidclaw.com', expectStatus: [200] },
  { name: 'Demo (DevOps)', url: 'https://demo-devops.sidclaw.com', expectStatus: [200] },
  { name: 'Demo (Healthcare)', url: 'https://demo-health.sidclaw.com', expectStatus: [200] },
];

// Track state between checks to avoid alert fatigue
const serviceState: Record<string, { down: boolean; since: Date | null; lastAlerted: Date | null }> = {};

export interface HealthCheckResult {
  name: string;
  url: string;
  status: 'healthy' | 'down' | 'degraded';
  httpStatus: number | null;
  responseTimeMs: number;
  error: string | null;
}

async function checkService(service: typeof SERVICES[0]): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(service.url, {
      signal: controller.signal,
      redirect: 'manual', // don't follow redirects — check the status code directly
    });
    clearTimeout(timeout);

    const responseTimeMs = Date.now() - start;
    const httpStatus = response.status;

    if (service.expectJson) {
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      const isHealthy = body?.status === 'healthy';
      return {
        name: service.name,
        url: service.url,
        status: isHealthy ? 'healthy' : 'degraded',
        httpStatus,
        responseTimeMs,
        error: isHealthy ? null : `Health check returned: ${String(body?.status ?? 'unknown')}`,
      };
    }

    const expectedStatuses = service.expectStatus ?? [200];
    const isUp = expectedStatuses.includes(httpStatus);

    return {
      name: service.name,
      url: service.url,
      status: isUp ? 'healthy' : 'down',
      httpStatus,
      responseTimeMs,
      error: isUp ? null : `Expected status ${expectedStatuses.join('/')}, got ${httpStatus}`,
    };
  } catch (error) {
    return {
      name: service.name,
      url: service.url,
      status: 'down',
      httpStatus: null,
      responseTimeMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runHealthChecks(): Promise<void> {
  const results = await Promise.all(SERVICES.map(checkService));
  const downServices = results.filter(r => r.status !== 'healthy');
  const allHealthy = downServices.length === 0;

  // Update state tracking
  const now = new Date();
  for (const result of results) {
    const state = serviceState[result.name] ?? { down: false, since: null, lastAlerted: null };

    if (result.status !== 'healthy') {
      if (!state.down) {
        // Just went down
        state.down = true;
        state.since = now;
        state.lastAlerted = null; // trigger immediate alert
      }
    } else {
      if (state.down) {
        // Just recovered — send recovery email
        await sendRecoveryAlert(result.name, state.since!, now);
      }
      state.down = false;
      state.since = null;
      state.lastAlerted = null;
    }

    serviceState[result.name] = state;
  }

  // Send alert for down services (only if not alerted in last 30 minutes)
  if (downServices.length > 0) {
    const needsAlert = downServices.filter(s => {
      const state = serviceState[s.name];
      if (!state?.lastAlerted) return true;
      return now.getTime() - state.lastAlerted.getTime() > 30 * 60 * 1000; // 30 min cooldown
    });

    if (needsAlert.length > 0) {
      await sendDownAlert(needsAlert, results);
      for (const s of needsAlert) {
        serviceState[s.name]!.lastAlerted = now;
      }
    }
  }

  // Log
  const statusLine = results.map(r => `${r.name}:${r.status === 'healthy' ? '✓' : '✗'}`).join(' ');
  if (!allHealthy) {
    console.warn(`[HealthCheck] ${statusLine}`);
  }
}

async function sendDownAlert(downServices: HealthCheckResult[], allResults: HealthCheckResult[]) {
  const adminEmail = process.env['ADMIN_ALERT_EMAIL'];
  if (!adminEmail) return;

  const emailService = new EmailService();

  const serviceRows = allResults.map(r => {
    const icon = r.status === 'healthy' ? '✅' : r.status === 'degraded' ? '⚠️' : '❌';
    const time = r.responseTimeMs ? `${r.responseTimeMs}ms` : 'timeout';
    return `${icon} ${r.name} — ${r.status} (${time})${r.error ? `: ${r.error}` : ''}`;
  }).join('\n');

  await emailService.send({
    to: [adminEmail],
    subject: `🚨 SidClaw: ${downServices.length} service(s) down`,
    text: `Service health alert:\n\n${serviceRows}\n\nCheck Railway dashboard: https://railway.app`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
        <h2 style="color: #EF4444;">Service Health Alert</h2>
        <p>${downServices.length} service(s) are down or degraded:</p>
        <pre style="background: #f5f5f5; padding: 16px; border-radius: 8px; font-size: 13px;">${serviceRows}</pre>
        <p><a href="https://railway.app" style="color: #3B82F6;">Open Railway Dashboard →</a></p>
      </div>
    `,
  }).catch(err => console.error('[HealthCheck] Failed to send alert email:', err));
}

async function sendRecoveryAlert(serviceName: string, downSince: Date, recoveredAt: Date) {
  const adminEmail = process.env['ADMIN_ALERT_EMAIL'];
  if (!adminEmail) return;

  const downtimeMinutes = Math.round((recoveredAt.getTime() - downSince.getTime()) / 60000);
  const emailService = new EmailService();

  await emailService.send({
    to: [adminEmail],
    subject: `✅ SidClaw: ${serviceName} recovered (was down ${downtimeMinutes}m)`,
    text: `${serviceName} is back online.\nDowntime: ${downtimeMinutes} minutes (${downSince.toISOString()} → ${recoveredAt.toISOString()})`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
        <h2 style="color: #22C55E;">${serviceName} Recovered</h2>
        <p>Downtime: <strong>${downtimeMinutes} minutes</strong></p>
        <p style="color: #666; font-size: 13px;">Down since: ${downSince.toISOString()}<br>Recovered: ${recoveredAt.toISOString()}</p>
      </div>
    `,
  }).catch(err => console.error('[HealthCheck] Failed to send recovery email:', err));
}
