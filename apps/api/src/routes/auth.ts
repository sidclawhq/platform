import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import * as cookie from 'cookie';
import { prisma } from '../db/client.js';
import { SessionManager } from '../auth/session.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../errors.js';
import { z } from 'zod';
import { EmailPasswordProvider } from '../auth/providers/email-password.js';
import { GitHubProvider } from '../auth/providers/github.js';
import { GoogleProvider } from '../auth/providers/google.js';
import { provisionNewUser } from '../auth/provision.js';

const sessionManager = new SessionManager(prisma);
const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000';

/**
 * Validate and sanitize redirect_uri to prevent open redirect attacks.
 * Only allows relative paths (starting with /) — rejects absolute URLs.
 */
function sanitizeRedirectUri(uri: string | undefined): string {
  const fallback = '/dashboard';
  if (!uri) return fallback;
  // Strip tab, newline, carriage return — WHATWG URL spec strips these during parsing,
  // so /\t/evil.com would be parsed as //evil.com by browsers
  const cleaned = uri.replace(/[\t\n\r]/g, '');
  // Must start with / and must NOT start with // (protocol-relative URL)
  // Also reject backslashes which some browsers normalize to forward slashes
  if (cleaned.startsWith('/') && !cleaned.startsWith('//') && !cleaned.includes('\\')) return cleaned;
  return fallback;
}

// In-memory store for OIDC state (code_verifier, redirect_uri).
// In production, use a short-lived server session or encrypted cookie.
const pendingAuths = new Map<string, { codeVerifier: string; redirectUri: string; expiresAt: number }>();
const pendingApiKeys = new Map<string, { key: string; expiresAt: number }>();

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingAuths.entries()) {
    if (value.expiresAt < now) pendingAuths.delete(key);
  }
  for (const [key, value] of pendingApiKeys.entries()) {
    if (value.expiresAt < Date.now()) pendingApiKeys.delete(key);
  }
}, 300000).unref();

function setSessionCookies(reply: FastifyReply, sessionId: string, csrfToken: string) {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const cookieDomain = process.env['COOKIE_DOMAIN'] ?? (isProduction ? '.sidclaw.com' : undefined);
  const secureCookies = process.env['SECURE_COOKIES'] !== 'false' && isProduction;

  const sessionCookie = cookie.serialize('session', sessionId, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: parseInt(process.env['SESSION_TTL_SECONDS'] ?? '28800'),
    domain: cookieDomain,
  });

  const csrfCookie = cookie.serialize('csrf_token', csrfToken, {
    httpOnly: false, // JS must read this
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: parseInt(process.env['SESSION_TTL_SECONDS'] ?? '28800'),
    domain: cookieDomain,
  });

  reply.header('set-cookie', [sessionCookie, csrfCookie]);
}

function clearSessionCookies(reply: FastifyReply) {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const cookieDomain = process.env['COOKIE_DOMAIN'] ?? (isProduction ? '.sidclaw.com' : undefined);

  const sessionCookie = cookie.serialize('session', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    domain: cookieDomain,
  });

  const csrfCookie = cookie.serialize('csrf_token', '', {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    domain: cookieDomain,
  });

  reply.header('set-cookie', [sessionCookie, csrfCookie]);
}

export async function authRoutes(app: FastifyInstance) {
  // ── GET /auth/login ──────────────────────────────────────────────────────
  app.get('/auth/login', async (request: FastifyRequest<{
    Querystring: { provider?: string; redirect_uri?: string };
  }>, reply: FastifyReply) => {
    const redirectUri = sanitizeRedirectUri((request.query as { redirect_uri?: string }).redirect_uri);

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
      return reply.redirect(`${dashboardUrl}/login?error=auth_failed`);
    }

    if (!query.state || !query.code) {
      return reply.redirect(`${dashboardUrl}/login?error=invalid_callback`);
    }

    const pending = pendingAuths.get(query.state);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingAuths.delete(query.state!);
      return reply.redirect(`${dashboardUrl}/login?error=invalid_state`);
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

  // ── POST /auth/signup ────────────────────────────────────────────────────
  const SignupSchema = z.object({
    email: z.string().trim().toLowerCase(),
    password: z.string(),
    name: z.string().trim().min(1).max(200),
  }).strict();

  app.post('/auth/signup', async (request, reply) => {
    const body = SignupSchema.parse(request.body);
    const emailPassword = new EmailPasswordProvider();

    if (!emailPassword.validateEmail(body.email)) {
      throw new ValidationError('Invalid email format');
    }

    const passwordCheck = emailPassword.validatePassword(body.password);
    if (!passwordCheck.valid) {
      throw new ValidationError(passwordCheck.message!);
    }

    const passwordHash = await emailPassword.hashPassword(body.password);

    const result = await provisionNewUser(prisma, {
      email: body.email,
      name: body.name,
      authProvider: 'email',
      authProviderId: null,
      passwordHash,
    });

    const sessionId = await sessionManager.create(result.user.id, result.tenant.id);
    const csrfToken = randomUUID();
    setSessionCookies(reply, sessionId, csrfToken);

    return reply.status(201).send({
      data: {
        user: result.user,
        tenant: result.tenant,
        api_key: result.apiKey,
      },
    });
  });

  // ── POST /auth/login/email ──────────────────────────────────────────────
  const EmailLoginSchema = z.object({
    email: z.string().trim().toLowerCase(),
    password: z.string(),
  }).strict();

  app.post('/auth/login/email', async (request, reply) => {
    const body = EmailLoginSchema.parse(request.body);
    const emailPassword = new EmailPasswordProvider();

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { tenant: true },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.auth_provider !== 'email') {
      throw new ConflictError(`Account exists with different provider: ${user.auth_provider}`);
    }

    const valid = await emailPassword.verifyPassword(body.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const sessionId = await sessionManager.create(user.id, user.tenant_id);
    const csrfToken = randomUUID();
    setSessionCookies(reply, sessionId, csrfToken);

    return reply.send({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant_id: user.tenant_id,
        },
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          plan: user.tenant.plan,
        },
      },
    });
  });

  // ── GET /auth/login/github ──────────────────────────────────────────────
  app.get('/auth/login/github', async (request: FastifyRequest<{
    Querystring: { redirect_uri?: string };
  }>, reply: FastifyReply) => {
    const githubClientId = process.env['GITHUB_CLIENT_ID'];
    const githubClientSecret = process.env['GITHUB_CLIENT_SECRET'];
    const githubRedirectUri = process.env['GITHUB_REDIRECT_URI'] ?? 'http://localhost:4000/api/v1/auth/callback/github';

    if (!githubClientId || !githubClientSecret) {
      throw new ValidationError('GitHub OAuth is not configured');
    }

    const redirectUri = sanitizeRedirectUri((request.query as { redirect_uri?: string }).redirect_uri);
    const state = randomUUID();
    const github = new GitHubProvider(githubClientId, githubClientSecret, githubRedirectUri);

    pendingAuths.set(state, {
      codeVerifier: redirectUri,
      redirectUri,
      expiresAt: Date.now() + 300000,
    });

    return reply.redirect(github.getAuthorizationUrl(state));
  });

  // ── GET /auth/callback/github ───────────────────────────────────────────
  app.get('/auth/callback/github', async (request: FastifyRequest<{
    Querystring: { code?: string; state?: string; error?: string };
  }>, reply: FastifyReply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      request.log.warn({ error: query.error }, 'GitHub callback error');
      return reply.redirect(`${dashboardUrl}/login?error=auth_failed`);
    }

    if (!query.state || !query.code) {
      return reply.redirect(`${dashboardUrl}/login?error=invalid_callback`);
    }

    const pending = pendingAuths.get(query.state);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingAuths.delete(query.state);
      return reply.redirect(`${dashboardUrl}/login?error=invalid_state`);
    }
    pendingAuths.delete(query.state);

    const githubClientId = process.env['GITHUB_CLIENT_ID']!;
    const githubClientSecret = process.env['GITHUB_CLIENT_SECRET']!;
    const githubRedirectUri = process.env['GITHUB_REDIRECT_URI'] ?? 'http://localhost:4000/api/v1/auth/callback/github';

    const github = new GitHubProvider(githubClientId, githubClientSecret, githubRedirectUri);

    try {
      const accessToken = await github.exchangeCode(query.code);
      const githubUser = await github.getUser(accessToken);

      const existingUser = await prisma.user.findUnique({
        where: { email: githubUser.email },
        include: { tenant: true },
      });

      if (existingUser) {
        if (existingUser.auth_provider !== 'github') {
          return reply.redirect(`${dashboardUrl}/login?error=provider_mismatch`);
        }

        await prisma.user.update({
          where: { id: existingUser.id },
          data: { last_login_at: new Date() },
        });

        const sessionId = await sessionManager.create(existingUser.id, existingUser.tenant_id);
        const csrfToken = randomUUID();
        setSessionCookies(reply, sessionId, csrfToken);
        return reply.redirect(pending.redirectUri);
      }

      const result = await provisionNewUser(prisma, {
        email: githubUser.email,
        name: githubUser.name,
        authProvider: 'github',
        authProviderId: githubUser.id,
        passwordHash: null,
      });

      const sessionId = await sessionManager.create(result.user.id, result.tenant.id);
      const csrfToken = randomUUID();
      setSessionCookies(reply, sessionId, csrfToken);

      pendingApiKeys.set(sessionId, { key: result.apiKey, expiresAt: Date.now() + 300000 });

      return reply.redirect(`${dashboardUrl}/dashboard?onboarding=true`);
    } catch (err) {
      request.log.error({ err }, 'GitHub OAuth error');
      return reply.redirect(`${dashboardUrl}/login?error=auth_failed`);
    }
  });

  // ── GET /auth/login/google ──────────────────────────────────────────────
  app.get('/auth/login/google', async (request: FastifyRequest<{
    Querystring: { redirect_uri?: string };
  }>, reply: FastifyReply) => {
    const googleClientId = process.env['GOOGLE_CLIENT_ID'];
    const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    const googleRedirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:4000/api/v1/auth/callback/google';

    if (!googleClientId || !googleClientSecret) {
      throw new ValidationError('Google OAuth is not configured');
    }

    const redirectUri = sanitizeRedirectUri((request.query as { redirect_uri?: string }).redirect_uri);
    const google = new GoogleProvider(googleClientId, googleClientSecret, googleRedirectUri);

    const { randomPKCECodeVerifier } = await import('openid-client');
    const state = randomUUID();
    const codeVerifier = randomPKCECodeVerifier();

    pendingAuths.set(state, {
      codeVerifier,
      redirectUri,
      expiresAt: Date.now() + 300000,
    });

    const authUrl = await google.getAuthorizationUrl(state, codeVerifier);
    return reply.redirect(authUrl);
  });

  // ── GET /auth/callback/google ───────────────────────────────────────────
  app.get('/auth/callback/google', async (request: FastifyRequest<{
    Querystring: { code?: string; state?: string; error?: string };
  }>, reply: FastifyReply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      request.log.warn({ error: query.error }, 'Google callback error');
      return reply.redirect(`${dashboardUrl}/login?error=auth_failed`);
    }

    if (!query.state || !query.code) {
      return reply.redirect(`${dashboardUrl}/login?error=invalid_callback`);
    }

    const pending = pendingAuths.get(query.state);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingAuths.delete(query.state);
      return reply.redirect(`${dashboardUrl}/login?error=invalid_state`);
    }
    pendingAuths.delete(query.state);

    const googleClientId = process.env['GOOGLE_CLIENT_ID']!;
    const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET']!;
    const googleRedirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:4000/api/v1/auth/callback/google';

    const google = new GoogleProvider(googleClientId, googleClientSecret, googleRedirectUri);

    try {
      const proto = (request.headers['x-forwarded-proto'] as string) ?? (process.env['NODE_ENV'] === 'production' ? 'https' : 'http');
      const requestUrl = new URL(request.url, `${proto}://${request.hostname}`);
      const googleUser = await google.exchangeCode(
        query.code,
        query.state,
        pending.codeVerifier,
        requestUrl
      );

      const existingUser = await prisma.user.findUnique({
        where: { email: googleUser.email },
        include: { tenant: true },
      });

      if (existingUser) {
        if (existingUser.auth_provider !== 'google') {
          return reply.redirect(`${dashboardUrl}/login?error=provider_mismatch`);
        }

        await prisma.user.update({
          where: { id: existingUser.id },
          data: { last_login_at: new Date() },
        });

        const sessionId = await sessionManager.create(existingUser.id, existingUser.tenant_id);
        const csrfToken = randomUUID();
        setSessionCookies(reply, sessionId, csrfToken);
        return reply.redirect(pending.redirectUri);
      }

      const result = await provisionNewUser(prisma, {
        email: googleUser.email,
        name: googleUser.name,
        authProvider: 'google',
        authProviderId: googleUser.sub,
        passwordHash: null,
      });

      const sessionId = await sessionManager.create(result.user.id, result.tenant.id);
      const csrfToken = randomUUID();
      setSessionCookies(reply, sessionId, csrfToken);

      pendingApiKeys.set(sessionId, { key: result.apiKey, expiresAt: Date.now() + 300000 });

      return reply.redirect(`${dashboardUrl}/dashboard?onboarding=true`);
    } catch (err) {
      request.log.error({ err }, 'Google OAuth error');
      return reply.redirect(`${dashboardUrl}/login?error=auth_failed`);
    }
  });

  // ── GET /auth/onboarding-key ────────────────────────────────────────────
  app.get('/auth/onboarding-key', async (request, reply) => {
    const cookies = cookie.parse(request.headers.cookie ?? '');
    const sessionId = cookies['session'];
    if (!sessionId) {
      throw new UnauthorizedError('No session');
    }

    const entry = pendingApiKeys.get(sessionId);
    if (!entry || entry.expiresAt < Date.now()) {
      pendingApiKeys.delete(sessionId ?? '');
      return reply.send({ data: { api_key: null } });
    }

    pendingApiKeys.delete(sessionId);
    return reply.send({ data: { api_key: entry.key } });
  });

  // ── Development/test login fallback ─────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    app.get('/auth/dev-login', async (request: FastifyRequest<{
      Querystring: { redirect_uri?: string };
    }>, reply: FastifyReply) => {
      const redirectUri = sanitizeRedirectUri((request.query as { redirect_uri?: string }).redirect_uri);

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
