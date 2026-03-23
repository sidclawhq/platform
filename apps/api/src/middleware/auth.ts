import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import * as cookie from 'cookie';
import { prisma } from '../db/client.js';
import { SessionManager } from '../auth/session.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';

const sessionManager = new SessionManager(prisma);

// ─── Scope enforcement ────────────────────────────────────────────────────────

const ROUTE_SCOPES: Record<string, string> = {
  'POST /api/v1/evaluate': 'evaluate',
  'GET /api/v1/traces': 'traces:read',
  'GET /api/v1/traces/': 'traces:read',
  'GET /api/v1/traces/export': 'traces:read',
  'POST /api/v1/traces/': 'traces:write',
  'GET /api/v1/agents': 'agents:read',
  'GET /api/v1/agents/': 'agents:read',
  'GET /api/v1/approvals': 'approvals:read',
  'GET /api/v1/approvals/': 'approvals:read',
};

function checkScope(method: string, url: string, scopes: string[]): boolean {
  // '*' scope (legacy seed keys) and 'admin' scope allow everything
  if (scopes.includes('admin') || scopes.includes('*')) return true;

  // Find matching route scope
  const routeKey = `${method} ${url}`;
  for (const [pattern, requiredScope] of Object.entries(ROUTE_SCOPES)) {
    if (routeKey.startsWith(pattern)) {
      return scopes.includes(requiredScope);
    }
  }

  // Routes not in the mapping require 'admin' scope for API key auth
  return scopes.includes('admin');
}

async function authPluginImpl(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Skip auth for health check, docs, auth routes, Stripe webhook, and integration callbacks
    if (
      request.url === '/health' ||
      request.url.startsWith('/docs') ||
      request.url.startsWith('/api/v1/auth/') ||
      request.url.startsWith('/api/v1/billing/webhook') ||
      request.url.startsWith('/api/v1/admin/usage') ||
      request.url.startsWith('/api/v1/integrations/')
    ) {
      return;
    }

    // Method 1: API key auth (for SDK)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
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
      request.tenantPlan = apiKey.tenant.plan;

      // Scope enforcement
      const scopes = (apiKey.scopes as string[]) ?? ['*'];
      if (!checkScope(request.method, request.url, scopes)) {
        throw new ForbiddenError(
          `API key does not have the required scope for ${request.method} ${request.url}`
        );
      }
      request.apiKeyScopes = scopes;

      // Debounced last_used_at update (once per minute per key)
      const oneMinuteAgo = new Date(Date.now() - 60000);
      if (!apiKey.last_used_at || apiKey.last_used_at < oneMinuteAgo) {
        prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { last_used_at: new Date() },
        }).catch(() => {}); // Fire and forget
      }

      return;
    }

    // Method 2: Session auth (for dashboard)
    const cookies = cookie.parse(request.headers.cookie ?? '');
    const sessionId = cookies['session'];
    if (sessionId) {
      const session = await sessionManager.validate(sessionId);
      if (!session) {
        throw new UnauthorizedError('Session expired');
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { tenant: { select: { name: true, plan: true } } },
      });
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      request.tenantId = session.tenantId;
      request.tenantPlan = user.tenant.plan;
      request.userId = user.id;
      request.userRole = user.role;

      // CSRF check for state-changing requests
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) {
        const csrfHeader = request.headers['x-csrf-token'] as string | undefined;
        const csrfCookie = cookies['csrf_token'];
        if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
          throw new ForbiddenError('Invalid CSRF token');
        }
      }

      return;
    }

    throw new UnauthorizedError('Authentication required');
  });
}

export const authPlugin = fp(authPluginImpl, { name: 'auth-plugin' });
