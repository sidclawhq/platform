import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { prisma } from '../db/client.js';
import { UnauthorizedError } from '../errors.js';

async function authPluginImpl(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Skip auth for health check and docs
    if (request.url === '/health' || request.url.startsWith('/docs')) {
      return;
    }

    // TODO(P3.4): Remove dev bypass when session auth is implemented
    if (process.env['NODE_ENV'] === 'development' && request.headers['x-dev-bypass'] === 'true') {
      const tenant = await prisma.tenant.findFirst();
      const user = await prisma.user.findFirst({ where: { role: 'admin' } });
      if (tenant && user) {
        request.tenantId = tenant.id;
        request.userId = user.id;
        request.userRole = user.role;
        return;
      }
    }

    // API key authentication
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const rawKey = authHeader.slice(7);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { key_hash: keyHash },
      include: { tenant: true },
    });

    if (!apiKey) {
      throw new UnauthorizedError('Invalid API key');
    }

    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      throw new UnauthorizedError('API key has expired');
    }

    request.tenantId = apiKey.tenant_id;

    // Debounced last_used_at update (once per minute per key)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    if (!apiKey.last_used_at || apiKey.last_used_at < oneMinuteAgo) {
      // Fire and forget — don't block the request
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { last_used_at: new Date() },
      }).catch(() => {}); // ignore errors
    }
  });
}

export const authPlugin = fp(authPluginImpl, { name: 'auth-plugin' });
