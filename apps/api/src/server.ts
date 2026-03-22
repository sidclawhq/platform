import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { loadConfig } from './config.js';
import { registerPlugins } from './server-plugins.js';
import { JobRunner } from './jobs/runner.js';
import { expireApprovals } from './jobs/expire-approvals.js';
import { cleanupTraces } from './jobs/trace-cleanup.js';
import { processWebhookDeliveries } from './jobs/webhook-delivery.js';
import { cleanupSessions } from './jobs/session-cleanup.js';
import { auditBatch } from './jobs/audit-batch.js';
import { runHealthChecks } from './jobs/health-monitor.js';
import { sendDailyDigest } from './jobs/daily-digest.js';
import { sendWeeklyReport } from './jobs/weekly-report.js';

// Schedule-aware wrapper: runs handler once per day at a specific CET hour
function createScheduledJob(handler: () => Promise<void>, hour: number, minute = 0) {
  let lastRun = '';

  return async () => {
    const now = new Date();
    // CET is UTC+1 (simplified — does not account for CEST/summer time)
    const cetOffset = 1;
    const cetHour = (now.getUTCHours() + cetOffset) % 24;
    const todayKey = now.toISOString().slice(0, 10);

    if (cetHour === hour && now.getUTCMinutes() >= minute && lastRun !== todayKey) {
      lastRun = todayKey;
      await handler();
    }
  };
}

const config = loadConfig();

// In production, fail fast if critical config is missing
if (config.environment === 'production') {
  if (!config.sessionSecret) {
    console.error('FATAL: Missing required configuration: SESSION_SECRET');
    process.exit(1);
  }
  if (config.sessionSecret.length < 32) {
    console.error('FATAL: SESSION_SECRET must be at least 32 characters');
    process.exit(1);
  }
}

const app = Fastify({
  bodyLimit: 1_048_576,
  logger: {
    level: config.environment === 'production' ? 'info' : 'debug',
    transport: config.environment !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
});

await registerPlugins(app);

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`API server running on http://${config.host}:${config.port}`);
  app.log.info(`Swagger docs at http://${config.host}:${config.port}/docs`);

  // Start background jobs (not in test mode)
  if (config.environment !== 'test') {
    const jobRunner = new JobRunner();
    jobRunner.register({ type: 'expire_approvals', intervalMs: 60000, handler: expireApprovals });
    jobRunner.register({ type: 'trace_cleanup', intervalMs: 3600000, handler: cleanupTraces });
    jobRunner.register({ type: 'webhook_delivery', intervalMs: 10000, handler: processWebhookDeliveries });
    jobRunner.register({ type: 'session_cleanup', intervalMs: 3600000, handler: cleanupSessions });
    jobRunner.register({ type: 'audit_batch', intervalMs: 60000, handler: auditBatch });

    // Monitoring jobs
    jobRunner.register({ type: 'health_monitor', intervalMs: 15 * 60 * 1000, handler: runHealthChecks });
    jobRunner.register({
      type: 'daily_digest',
      intervalMs: 60000,
      handler: createScheduledJob(sendDailyDigest, 8, 0),
    });
    jobRunner.register({
      type: 'weekly_report',
      intervalMs: 60000,
      handler: createScheduledJob(async () => {
        const now = new Date();
        if (now.getUTCDay() === 1) { // Monday
          await sendWeeklyReport();
        }
      }, 8, 0),
    });

    jobRunner.start();
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
