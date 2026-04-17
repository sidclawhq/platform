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
import { detectDrift } from './jobs/drift-detection.js';

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
  // PUBLIC_API_URL (or API_PUBLIC_URL) is required in production because
  // /tenant/info embeds its value into dashboard copy-paste snippets. Deriving
  // from request headers under trustProxy=true is a host-header-injection
  // credential-leak primitive — refuse to boot without an explicit override.
  if (!process.env.PUBLIC_API_URL && !process.env.API_PUBLIC_URL) {
    console.error('FATAL: Missing required configuration: PUBLIC_API_URL (or API_PUBLIC_URL)');
    process.exit(1);
  }
}

const app = Fastify({
  bodyLimit: 1_048_576,
  trustProxy: true,
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
    jobRunner.register({ type: 'drift_detection', intervalMs: 3600000, handler: detectDrift });
    jobRunner.start();

    // Graceful shutdown — drain requests and stop jobs before exit
    const gracefulShutdown = async (signal: string) => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await jobRunner.stop();
      await app.close();
      process.exit(0);
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
