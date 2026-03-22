# Task: Monitoring, Health Checks & Automated Reports

## Context

You are working on the **SidClaw** platform. Read these files first:

1. `apps/api/src/routes/admin.ts` — the admin usage endpoint (super admin only)
2. `apps/api/src/services/email-service.ts` — existing Resend email integration
3. `apps/api/src/jobs/runner.ts` — existing background job runner
4. `apps/api/src/config.ts` — environment configuration

The platform is deployed on Railway with 7 services. We need automated monitoring that:
- Checks service health every 15 minutes, emails the admin if anything is down
- Sends a daily business digest at 8am CET
- Sends a weekly comprehensive report on Monday 8am CET

All monitoring runs inside the existing API service as background jobs — no new services needed.

## What To Do

### Part 1: Health Check Job (`apps/api/src/jobs/health-monitor.ts`)

```typescript
import { EmailService } from '../services/email-service';

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

interface HealthCheckResult {
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
      const body = await response.json().catch(() => null);
      const isHealthy = body?.status === 'healthy';
      return {
        name: service.name,
        url: service.url,
        status: isHealthy ? 'healthy' : 'degraded',
        httpStatus,
        responseTimeMs,
        error: isHealthy ? null : `Health check returned: ${body?.status ?? 'unknown'}`,
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
        serviceState[s.name].lastAlerted = now;
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
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
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
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
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
```

### Part 2: Daily Digest Job (`apps/api/src/jobs/daily-digest.ts`)

```typescript
import { prisma } from '../db/client';
import { EmailService } from '../services/email-service';

export async function sendDailyDigest(): Promise<void> {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) return;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  // Gather metrics
  const [
    totalTenants,
    newTenantsToday,
    totalUsers,
    payingTenants,
    tracesToday,
    tracesWeek,
    pendingApprovals,
    approvedToday,
    deniedToday,
    totalAgents,
    totalPolicies,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { created_at: { gte: oneDayAgo } } }),
    prisma.user.count(),
    prisma.tenant.count({ where: { plan: { not: 'free' } } }),
    prisma.auditTrace.count({ where: { started_at: { gte: oneDayAgo } } }),
    prisma.auditTrace.count({ where: { started_at: { gte: sevenDaysAgo } } }),
    prisma.approvalRequest.count({ where: { status: 'pending' } }),
    prisma.approvalRequest.count({ where: { status: 'approved', decided_at: { gte: oneDayAgo } } }),
    prisma.approvalRequest.count({ where: { status: 'denied', decided_at: { gte: oneDayAgo } } }),
    prisma.agent.count(),
    prisma.policyRule.count({ where: { is_active: true } }),
  ]);

  // Top active tenants (by traces today)
  const activeTenants = await prisma.auditTrace.groupBy({
    by: ['tenant_id'],
    where: { started_at: { gte: oneDayAgo } },
    _count: true,
    orderBy: { _count: { tenant_id: 'desc' } },
    take: 5,
  });

  const tenantNames = await prisma.tenant.findMany({
    where: { id: { in: activeTenants.map(t => t.tenant_id) } },
    select: { id: true, name: true, plan: true },
  });

  const topActive = activeTenants.map(t => {
    const tenant = tenantNames.find(n => n.id === t.tenant_id);
    return `${tenant?.name ?? t.tenant_id} (${tenant?.plan}) — ${t._count} traces`;
  }).join('\n  ');

  // New signups with details
  const newSignups = await prisma.tenant.findMany({
    where: { created_at: { gte: oneDayAgo } },
    include: {
      users: { select: { email: true, name: true }, take: 1 },
      _count: { select: { agents: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const signupLines = newSignups.map(t => {
    const user = t.users[0];
    return `${t.name} — ${user?.email ?? 'no user'} (${t._count.agents} agents)`;
  }).join('\n  ') || 'None';

  // Format email
  const date = now.toLocaleDateString('en-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const emailService = new EmailService();
  await emailService.send({
    to: [adminEmail],
    subject: `📊 SidClaw Daily Digest — ${now.toISOString().split('T')[0]}`,
    text: `
SidClaw Daily Digest — ${date}

PLATFORM
  Tenants: ${totalTenants} (${newTenantsToday} new today)
  Users: ${totalUsers}
  Paying: ${payingTenants}
  Agents: ${totalAgents}
  Policies: ${totalPolicies}

ACTIVITY (24h)
  Evaluations: ${tracesToday}
  Evaluations (7d): ${tracesWeek}
  Approved: ${approvedToday}
  Denied: ${deniedToday}
  Pending now: ${pendingApprovals}

NEW SIGNUPS
  ${signupLines}

TOP ACTIVE TENANTS
  ${topActive || 'No activity'}

---
SidClaw — https://api.sidclaw.com/health
    `.trim(),
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; color: #333;">
        <h2 style="margin-bottom: 4px;">SidClaw Daily Digest</h2>
        <p style="color: #888; font-size: 13px; margin-top: 0;">${date}</p>

        <h3 style="font-size: 14px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px;">Platform</h3>
        <table style="font-size: 14px; width: 100%;">
          <tr><td style="color: #888; width: 140px;">Tenants</td><td><strong>${totalTenants}</strong> ${newTenantsToday > 0 ? `<span style="color: #22C55E;">(+${newTenantsToday} new)</span>` : ''}</td></tr>
          <tr><td style="color: #888;">Users</td><td>${totalUsers}</td></tr>
          <tr><td style="color: #888;">Paying</td><td><strong style="color: ${payingTenants > 0 ? '#22C55E' : '#888'};">${payingTenants}</strong></td></tr>
          <tr><td style="color: #888;">Agents</td><td>${totalAgents}</td></tr>
          <tr><td style="color: #888;">Policies</td><td>${totalPolicies}</td></tr>
        </table>

        <h3 style="font-size: 14px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 20px;">Activity (24h)</h3>
        <table style="font-size: 14px; width: 100%;">
          <tr><td style="color: #888; width: 140px;">Evaluations</td><td><strong>${tracesToday}</strong> (${tracesWeek} this week)</td></tr>
          <tr><td style="color: #888;">Approved</td><td style="color: #22C55E;">${approvedToday}</td></tr>
          <tr><td style="color: #888;">Denied</td><td style="color: #EF4444;">${deniedToday}</td></tr>
          <tr><td style="color: #888;">Pending now</td><td style="color: ${pendingApprovals > 0 ? '#F59E0B' : '#888'};">${pendingApprovals}</td></tr>
        </table>

        ${newSignups.length > 0 ? `
        <h3 style="font-size: 14px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 20px;">New Signups</h3>
        <ul style="font-size: 13px; padding-left: 20px;">
          ${newSignups.map(t => `<li>${t.name} — ${t.users[0]?.email ?? 'no user'} (${t._count.agents} agents)</li>`).join('')}
        </ul>` : ''}

        ${topActive ? `
        <h3 style="font-size: 14px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 20px;">Most Active</h3>
        <ol style="font-size: 13px; padding-left: 20px;">
          ${activeTenants.map(t => {
            const tenant = tenantNames.find(n => n.id === t.tenant_id);
            return `<li>${tenant?.name ?? 'Unknown'} <span style="color: #888;">(${tenant?.plan})</span> — ${t._count} evaluations</li>`;
          }).join('')}
        </ol>` : ''}

        <p style="margin-top: 24px; font-size: 12px; color: #aaa;">
          <a href="https://api.sidclaw.com/health" style="color: #3B82F6;">Health Check</a> ·
          <a href="https://app.sidclaw.com" style="color: #3B82F6;">Dashboard</a> ·
          <a href="https://railway.app" style="color: #3B82F6;">Railway</a> ·
          <a href="https://dashboard.stripe.com" style="color: #3B82F6;">Stripe</a>
        </p>
      </div>
    `,
  }).catch(err => console.error('[DailyDigest] Failed to send:', err));

  console.log(`[DailyDigest] Sent to ${adminEmail}`);
}
```

### Part 3: Weekly Report Job (`apps/api/src/jobs/weekly-report.ts`)

```typescript
import { prisma } from '../db/client';
import { EmailService } from '../services/email-service';

export async function sendWeeklyReport(): Promise<void> {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) return;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  // This week vs last week comparison
  const [
    tenantsThisWeek,
    tenantsLastWeek,
    tracesThisWeek,
    tracesLastWeek,
    approvalsThisWeek,
    approvalsLastWeek,
    totalTenants,
    payingTenants,
    totalAgents,
    totalPolicies,
    totalUsers,
  ] = await Promise.all([
    prisma.tenant.count({ where: { created_at: { gte: oneWeekAgo } } }),
    prisma.tenant.count({ where: { created_at: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    prisma.auditTrace.count({ where: { started_at: { gte: oneWeekAgo } } }),
    prisma.auditTrace.count({ where: { started_at: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    prisma.approvalRequest.count({ where: { requested_at: { gte: oneWeekAgo } } }),
    prisma.approvalRequest.count({ where: { requested_at: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    prisma.tenant.count(),
    prisma.tenant.count({ where: { plan: { not: 'free' } } }),
    prisma.agent.count(),
    prisma.policyRule.count({ where: { is_active: true } }),
    prisma.user.count(),
  ]);

  // Tenant breakdown by plan
  const planBreakdown = await prisma.tenant.groupBy({
    by: ['plan'],
    _count: true,
  });

  const planLines = planBreakdown.map(p => `${p.plan}: ${p._count}`).join(', ');

  // Change indicators
  const signupChange = tenantsLastWeek > 0
    ? `${Math.round(((tenantsThisWeek - tenantsLastWeek) / tenantsLastWeek) * 100)}%`
    : tenantsThisWeek > 0 ? '+∞' : '0%';
  const traceChange = tracesLastWeek > 0
    ? `${Math.round(((tracesThisWeek - tracesLastWeek) / tracesLastWeek) * 100)}%`
    : tracesThisWeek > 0 ? '+∞' : '0%';

  // All tenants with activity summary
  const allTenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      created_at: true,
      _count: { select: { agents: true, users: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const tenantActivity = await Promise.all(allTenants.map(async (t) => {
    const traces = await prisma.auditTrace.count({
      where: { tenant_id: t.id, started_at: { gte: oneWeekAgo } },
    });
    return { ...t, traces_this_week: traces };
  }));

  const tenantTable = tenantActivity
    .sort((a, b) => b.traces_this_week - a.traces_this_week)
    .map(t => `${t.name} | ${t.plan} | ${t._count.agents} agents | ${t._count.users} users | ${t.traces_this_week} traces`)
    .join('\n  ');

  const emailService = new EmailService();
  await emailService.send({
    to: [adminEmail],
    subject: `📈 SidClaw Weekly Report — Week of ${oneWeekAgo.toISOString().split('T')[0]}`,
    text: `
SidClaw Weekly Report
Week of ${oneWeekAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}

SUMMARY
  Total tenants: ${totalTenants} (${tenantsThisWeek} new, ${signupChange} vs last week)
  Paying tenants: ${payingTenants}
  Plans: ${planLines}
  Total users: ${totalUsers}
  Total agents: ${totalAgents}
  Total policies: ${totalPolicies}

ACTIVITY
  Evaluations: ${tracesThisWeek} (${traceChange} vs last week)
  Approvals: ${approvalsThisWeek} (last week: ${approvalsLastWeek})

TENANT ACTIVITY
  ${tenantTable || 'No tenants yet'}

---
SidClaw
    `.trim(),
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; color: #333;">
        <h2>SidClaw Weekly Report</h2>
        <p style="color: #888; font-size: 13px;">
          ${oneWeekAgo.toISOString().split('T')[0]} → ${now.toISOString().split('T')[0]}
        </p>

        <table style="font-size: 14px; width: 100%; border-collapse: collapse;">
          <tr><td style="color: #888; padding: 4px 12px 4px 0;">New signups</td><td><strong>${tenantsThisWeek}</strong> <span style="color: ${signupChange.startsWith('+') || signupChange.startsWith('-') ? (signupChange.startsWith('+') ? '#22C55E' : '#EF4444') : '#888'};">(${signupChange})</span></td></tr>
          <tr><td style="color: #888; padding: 4px 12px 4px 0;">Evaluations</td><td><strong>${tracesThisWeek}</strong> <span style="color: ${traceChange.startsWith('+') || traceChange.startsWith('-') ? (traceChange.startsWith('+') ? '#22C55E' : '#EF4444') : '#888'};">(${traceChange})</span></td></tr>
          <tr><td style="color: #888; padding: 4px 12px 4px 0;">Paying tenants</td><td><strong style="color: ${payingTenants > 0 ? '#22C55E' : '#888'};">${payingTenants}</strong></td></tr>
          <tr><td style="color: #888; padding: 4px 12px 4px 0;">Plans</td><td>${planLines}</td></tr>
        </table>

        <h3 style="font-size: 14px; color: #666; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 4px;">All Tenants</h3>
        <table style="font-size: 12px; width: 100%; border-collapse: collapse;">
          <tr style="color: #888; text-transform: uppercase; font-size: 11px;">
            <th style="text-align: left; padding: 4px;">Tenant</th>
            <th style="text-align: left; padding: 4px;">Plan</th>
            <th style="text-align: right; padding: 4px;">Agents</th>
            <th style="text-align: right; padding: 4px;">Users</th>
            <th style="text-align: right; padding: 4px;">Traces/wk</th>
          </tr>
          ${tenantActivity.sort((a, b) => b.traces_this_week - a.traces_this_week).map(t => `
          <tr style="border-top: 1px solid #f0f0f0;">
            <td style="padding: 4px;">${t.name}</td>
            <td style="padding: 4px;"><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 4px; font-size: 11px;">${t.plan}</span></td>
            <td style="padding: 4px; text-align: right;">${t._count.agents}</td>
            <td style="padding: 4px; text-align: right;">${t._count.users}</td>
            <td style="padding: 4px; text-align: right; font-weight: ${t.traces_this_week > 0 ? 'bold' : 'normal'};">${t.traces_this_week}</td>
          </tr>`).join('')}
        </table>

        <p style="margin-top: 24px; font-size: 12px; color: #aaa;">
          <a href="https://dashboard.stripe.com" style="color: #3B82F6;">Stripe</a> ·
          <a href="https://railway.app" style="color: #3B82F6;">Railway</a> ·
          <a href="https://app.sidclaw.com" style="color: #3B82F6;">Dashboard</a>
        </p>
      </div>
    `,
  }).catch(err => console.error('[WeeklyReport] Failed to send:', err));

  console.log(`[WeeklyReport] Sent to ${adminEmail}`);
}
```

### Part 4: Register Jobs in the Runner

Update `apps/api/src/server.ts` or `server-plugins.ts` to register the new jobs:

```typescript
import { runHealthChecks } from './jobs/health-monitor';
import { sendDailyDigest } from './jobs/daily-digest';
import { sendWeeklyReport } from './jobs/weekly-report';

// In the job runner registration (after app.listen):
if (config.environment !== 'test') {
  // Existing jobs
  jobRunner.register({ type: 'expire_approvals', intervalMs: 60000, handler: expireApprovals });
  jobRunner.register({ type: 'trace_cleanup', intervalMs: 3600000, handler: cleanupTraces });
  jobRunner.register({ type: 'webhook_delivery', intervalMs: 10000, handler: processWebhookDeliveries });
  // Session cleanup (if exists)

  // New monitoring jobs
  jobRunner.register({ type: 'health_monitor', intervalMs: 15 * 60 * 1000, handler: runHealthChecks });  // every 15 min
  jobRunner.register({ type: 'daily_digest', intervalMs: 86400000, handler: sendDailyDigest });  // every 24h
  jobRunner.register({ type: 'weekly_report', intervalMs: 7 * 86400000, handler: sendWeeklyReport });  // every 7 days
}
```

**Note on timing:** The `intervalMs` approach means the daily/weekly jobs run on a fixed interval from server start, not at a specific time of day. This is acceptable for now — the digest will arrive at whatever time the server started + 24h multiples.

For exact scheduling (8am CET), you'd need a cron-like scheduler. A simple approach:

```typescript
// Schedule-aware wrapper
function createScheduledJob(handler: () => Promise<void>, hour: number, minute: number = 0) {
  let lastRun: string | null = null;

  return async () => {
    const now = new Date();
    // Convert to CET (UTC+1, or UTC+2 in summer)
    const cetOffset = 1; // Simplification — use 1 for CET
    const cetHour = (now.getUTCHours() + cetOffset) % 24;
    const todayKey = now.toISOString().split('T')[0];

    if (cetHour === hour && now.getUTCMinutes() >= minute && lastRun !== todayKey) {
      lastRun = todayKey;
      await handler();
    }
  };
}

// Register with short interval (check every minute)
jobRunner.register({
  type: 'daily_digest',
  intervalMs: 60000,  // check every minute
  handler: createScheduledJob(sendDailyDigest, 8, 0),  // 8:00 CET
});

jobRunner.register({
  type: 'weekly_report',
  intervalMs: 60000,
  handler: createScheduledJob(async () => {
    // Only run on Mondays
    const now = new Date();
    if (now.getUTCDay() === 1) { // Monday
      await sendWeeklyReport();
    }
  }, 8, 0),
});
```

Use this schedule-aware approach instead of the raw interval for daily and weekly jobs.

### Part 5: Environment Variables

Add to `apps/api/.env.example`:

```
# Monitoring (required for alerts and reports)
ADMIN_ALERT_EMAIL=hello@sidclaw.com    # where to send health alerts and digests
```

Add `ADMIN_ALERT_EMAIL` to Railway API service env vars.

Add to `apps/api/src/config.ts`:

```typescript
adminAlertEmail: z.string().email().optional(),
```

### Part 6: Test the Jobs

Create `apps/api/src/jobs/__tests__/health-monitor.test.ts`:

```typescript
describe('Health Monitor', () => {
  it('detects healthy services');
  it('detects down services (timeout)');
  it('detects down services (non-200 status)');
  it('sends alert email when service goes down');
  it('sends recovery email when service comes back up');
  it('does not spam alerts (30 min cooldown)');
  it('does not send email when ADMIN_ALERT_EMAIL is not set');
});
```

Create `apps/api/src/jobs/__tests__/daily-digest.test.ts`:

```typescript
describe('Daily Digest', () => {
  it('sends email with correct metrics');
  it('includes new signups');
  it('includes top active tenants');
  it('does not send when ADMIN_ALERT_EMAIL is not set');
});
```

Mock the `EmailService.send()` method and the `fetch` function in health check tests.

### Part 7: Manual Trigger Endpoint (Optional but Helpful)

Add an admin endpoint to trigger reports manually:

```typescript
// In admin routes:
app.post('/admin/send-digest', async (request, reply) => {
  // Verify super admin key
  if (request.headers.authorization !== `Bearer ${process.env.SUPER_ADMIN_KEY}`) {
    return reply.status(403).send({ error: 'Forbidden' });
  }
  await sendDailyDigest();
  return reply.send({ sent: true });
});

app.post('/admin/send-weekly', async (request, reply) => {
  if (request.headers.authorization !== `Bearer ${process.env.SUPER_ADMIN_KEY}`) {
    return reply.status(403).send({ error: 'Forbidden' });
  }
  await sendWeeklyReport();
  return reply.send({ sent: true });
});

app.post('/admin/health-check', async (request, reply) => {
  if (request.headers.authorization !== `Bearer ${process.env.SUPER_ADMIN_KEY}`) {
    return reply.status(403).send({ error: 'Forbidden' });
  }
  await runHealthChecks();
  return reply.send({ checked: true });
});
```

This lets you test the emails anytime:

```bash
curl -X POST -H "Authorization: Bearer $SUPER_ADMIN_KEY" https://api.sidclaw.com/api/v1/admin/send-digest
```

## Acceptance Criteria

- [ ] Health monitor: checks 7 service URLs every 15 minutes
- [ ] Health monitor: sends email alert when any service is down
- [ ] Health monitor: sends recovery email when service comes back
- [ ] Health monitor: 30-minute cooldown between repeat alerts (no spam)
- [ ] Daily digest: sends at ~8am CET with platform metrics, signups, active tenants
- [ ] Weekly report: sends Monday ~8am CET with week-over-week comparisons
- [ ] All emails use Resend (existing EmailService)
- [ ] Graceful degradation: no crashes if ADMIN_ALERT_EMAIL is not set
- [ ] Manual trigger endpoints work (admin only)
- [ ] All tests pass
- [ ] `turbo build` succeeds
- [ ] Jobs register correctly in the runner (verify in server startup logs)

## Constraints

- Do NOT create new services or cron jobs — use the existing API background job runner
- Do NOT install new email providers — use the existing Resend integration
- Health checks must not block the API — they run asynchronously in the background
- All monitoring code goes in `apps/api/src/jobs/`
- Follow code style: files in `kebab-case.ts`, strict TypeScript
