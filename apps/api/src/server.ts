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

const config = loadConfig();

const app = Fastify({
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
    jobRunner.start();
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
