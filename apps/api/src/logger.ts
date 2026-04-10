import pino from 'pino';

const environment = process.env['NODE_ENV'] ?? 'development';

/**
 * Shared structured logger for use outside Fastify request context
 * (background jobs, standalone services, startup routines).
 *
 * Inside route handlers, prefer `request.log` or `app.log` instead.
 */
export const logger = pino({
  level: environment === 'production' ? 'info' : 'debug',
  transport: environment !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
