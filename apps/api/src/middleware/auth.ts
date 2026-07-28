import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import * as cookie from 'cookie';
import { prisma } from '../db/client.js';
import { SessionManager } from '../auth/session.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';
import { ROUTE_SCOPES } from '@sidclaw/shared/scopes';

const sessionManager = new SessionManager(prisma);

// ─── Scope enforcement ────────────────────────────────────────────────────────

// Route → scope map is single-sourced in @sidclaw/shared/scopes so the mint
// side (api-keys Zod schema, dashboard picker) and the enforce side cannot
// drift apart again. They previously disagreed: 'approvals:write' was required
// here but issuable nowhere, so the CLI could never approve anything.
const SCOPE_BY_ROUTE = new Map<string, string>(Object.entries(ROUTE_SCOPES));

function checkScope(request: FastifyRequest, scopes: string[]): boolean {
  // '*' scope (legacy seed keys) and 'admin' scope allow everything
  if (scopes.includes('admin') || scopes.includes('*')) return true;

  // Match on the Fastify ROUTE PATTERN, not the raw URL.
  //
  // The previous implementation did `routeKey.startsWith(pattern)` against the
  // raw URL, which is unsound in both directions: a 'POST /api/v1/policies'
  // entry would swallow 'POST /api/v1/policies/test', and several existing
  // entries were already unreachable because an earlier, shorter prefix
  // matched first. Exact-matching the pattern removes the ordering
  // sensitivity entirely, and a query string can no longer affect the result.
  const pattern = request.routeOptions?.url;
  if (!pattern) {
    // No matched route (404) or a framework-internal request. Nothing to
    // authorise — fail closed rather than guessing from the raw URL.
    return false;
  }

  const required = SCOPE_BY_ROUTE.get(`${request.method} ${pattern}`);
  if (required === undefined) {
    // Not in the map: tenant administration, credentials, billing, and
    // anything newly added. Deliberately fail-closed — a route added without
    // a scope entry is locked to admin, never silently exposed.
    return scopes.includes('admin');
  }
  return scopes.includes(required);
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
      // Fail closed when a key row has no scopes. The column default is
      // '["*"]' (wildcard) for legacy seed keys, but a NULL must not become
      // one — an absent value should grant nothing, not everything.
      const scopes = (apiKey.scopes as string[] | null) ?? [];
      if (!checkScope(request, scopes)) {
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
