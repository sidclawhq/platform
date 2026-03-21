import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import * as cookie from 'cookie';
import { prisma } from '../db/client.js';
import { SessionManager } from '../auth/session.js';
import { UnauthorizedError } from '../errors.js';

const sessionManager = new SessionManager(prisma);

// In-memory store for OIDC state (code_verifier, redirect_uri).
// In production, use a short-lived server session or encrypted cookie.
const pendingAuths = new Map<string, { codeVerifier: string; redirectUri: string; expiresAt: number }>();

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingAuths.entries()) {
    if (value.expiresAt < now) pendingAuths.delete(key);
  }
}, 300000).unref();

function setSessionCookies(reply: FastifyReply, sessionId: string, csrfToken: string) {
  const isProduction = process.env['NODE_ENV'] === 'production';

  const sessionCookie = cookie.serialize('session', sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: parseInt(process.env['SESSION_TTL_SECONDS'] ?? '28800'),
  });

  const csrfCookie = cookie.serialize('csrf_token', csrfToken, {
    httpOnly: false, // JS must read this
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax', // Lax in dev for cross-port
    path: '/',
    maxAge: parseInt(process.env['SESSION_TTL_SECONDS'] ?? '28800'),
  });

  reply.header('set-cookie', [sessionCookie, csrfCookie]);
}

function clearSessionCookies(reply: FastifyReply) {
  const sessionCookie = cookie.serialize('session', '', {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  const csrfCookie = cookie.serialize('csrf_token', '', {
    httpOnly: false,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: process.env['NODE_ENV'] === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: 0,
  });

  reply.header('set-cookie', [sessionCookie, csrfCookie]);
}

export async function authRoutes(app: FastifyInstance) {
  // ── GET /auth/login ──────────────────────────────────────────────────────
  app.get('/auth/login', async (request: FastifyRequest<{
    Querystring: { provider?: string; redirect_uri?: string };
  }>, reply: FastifyReply) => {
    const redirectUri = (request.query as { redirect_uri?: string }).redirect_uri ?? '/dashboard';

    // Development/test fallback: if OIDC is not configured and we're not in production
    if (!process.env['OIDC_ISSUER'] && process.env['NODE_ENV'] !== 'production') {
      return reply.redirect(`/api/v1/auth/dev-login?redirect_uri=${encodeURIComponent(redirectUri)}`);
    }

    if (!process.env['OIDC_ISSUER']) {
      throw new UnauthorizedError('OIDC provider not configured');
    }

    // Dynamic import to avoid loading openid-client when not configured
    const { getOIDCConfig, generateAuthParams } = await import('../auth/oidc.js');
    const config = await getOIDCConfig();
    const { state, codeVerifier, codeChallenge } = await generateAuthParams();

    // Store state for callback validation (5 minutes TTL)
    pendingAuths.set(state, {
      codeVerifier,
      redirectUri,
      expiresAt: Date.now() + 300000,
    });

    const oidcRedirectUri = process.env['OIDC_REDIRECT_URI']!;

    const { buildAuthorizationUrl } = await import('openid-client');
    const authorizationUrl = buildAuthorizationUrl(config, {
      redirect_uri: oidcRedirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return reply.redirect(authorizationUrl.href);
  });

  // ── GET /auth/callback ─────────────────────────────────────────────────
  app.get('/auth/callback', async (request: FastifyRequest<{
    Querystring: { code?: string; state?: string; error?: string };
  }>, reply: FastifyReply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      request.log.warn({ error: query.error }, 'OIDC callback error');
      return reply.redirect('/login?error=auth_failed');
    }

    if (!query.state || !query.code) {
      return reply.redirect('/login?error=invalid_callback');
    }

    const pending = pendingAuths.get(query.state);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingAuths.delete(query.state!);
      return reply.redirect('/login?error=invalid_state');
    }
    pendingAuths.delete(query.state);

    const { getOIDCConfig } = await import('../auth/oidc.js');
    const oidcClient = await import('openid-client');
    const config = await getOIDCConfig();

    const oidcRedirectUri = process.env['OIDC_REDIRECT_URI']!;

    // Exchange code for tokens
    const tokens = await oidcClient.authorizationCodeGrant(config, new URL(request.url, `http://${request.hostname}`), {
      pkceCodeVerifier: pending.codeVerifier,
      expectedState: query.state,
    });

    const claims = tokens.claims();
    if (!claims) {
      return reply.redirect('/login?error=no_claims');
    }

    const email = claims.email as string | undefined;
    const name = (claims.name as string | undefined) ?? email ?? 'Unknown';

    if (!email) {
      return reply.redirect('/login?error=no_email');
    }

    // Use the default tenant (single-tenant for now)
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return reply.redirect('/login?error=no_tenant');
    }

    // Find or create user
    const userCount = await prisma.user.count({ where: { tenant_id: tenant.id } });
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    const user = existingUser ?? await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        email,
        name,
        role: userCount === 0 ? 'admin' : 'viewer',
        auth_provider: 'oidc',
        auth_provider_id: claims.sub as string,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    // Create session
    const sessionId = await sessionManager.create(user.id, tenant.id);
    const csrfToken = randomUUID();

    setSessionCookies(reply, sessionId, csrfToken);
    return reply.redirect(pending.redirectUri);
  });

  // ── Development/test login fallback ─────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    app.get('/auth/dev-login', async (request: FastifyRequest<{
      Querystring: { redirect_uri?: string };
    }>, reply: FastifyReply) => {
      const redirectUri = (request.query as { redirect_uri?: string }).redirect_uri ?? '/dashboard';

      request.log.warn('⚠ Using development auth bypass — OIDC not configured');

      // Use the seed admin user
      const user = await prisma.user.findFirst({
        where: { role: 'admin' },
        include: { tenant: true },
      });

      if (!user) {
        throw new UnauthorizedError('No admin user found — run prisma db seed first');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
      });

      const sessionId = await sessionManager.create(user.id, user.tenant_id);
      const csrfToken = randomUUID();

      setSessionCookies(reply, sessionId, csrfToken);
      return reply.redirect(redirectUri);
    });
  }

  // ── POST /auth/logout ──────────────────────────────────────────────────
  app.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookies = cookie.parse(request.headers.cookie ?? '');
    const sessionId = cookies['session'];

    if (sessionId) {
      await sessionManager.destroy(sessionId);
    }

    clearSessionCookies(reply);
    return reply.status(200).send({ message: 'Logged out' });
  });

  // ── GET /auth/me ────────────────────────────────────────────────────────
  app.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookies = cookie.parse(request.headers.cookie ?? '');
    const sessionId = cookies['session'];

    if (!sessionId) {
      throw new UnauthorizedError('No session');
    }

    const session = await sessionManager.validate(sessionId);
    if (!session) {
      throw new UnauthorizedError('Session expired');
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { tenant: { select: { name: true } } },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return reply.send({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant.name,
      },
    });
  });
}
