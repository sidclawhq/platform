# Self-Serve Signup & Tenant Provisioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable developers to sign up with GitHub OAuth, Google OIDC, or email/password, automatically provisioning a tenant + admin user + API key, with onboarding flow and free plan limits.

**Architecture:** Extends existing P3.4 OIDC auth with three new providers. A `provisionNewUser()` function atomically creates tenant + user + API key in one Prisma transaction. Plan limits are enforced via a middleware function called at resource creation. The dashboard gets signup/login pages and an onboarding checklist bar.

**Tech Stack:** Fastify, Prisma, bcrypt, openid-client, Next.js 15, Tailwind CSS

---

## File Map

### API — New Files
| File | Responsibility |
|------|---------------|
| `apps/api/src/auth/providers/email-password.ts` | bcrypt hashing, password validation, email format check |
| `apps/api/src/auth/providers/github.ts` | GitHub OAuth 2.0 authorization code flow |
| `apps/api/src/auth/providers/google.ts` | Google OIDC via openid-client |
| `apps/api/src/auth/provision.ts` | `provisionNewUser()` — atomic tenant+user+API key creation |
| `apps/api/src/middleware/plan-limits.ts` | Free/Team/Enterprise limit constants + `checkPlanLimit()` |
| `apps/api/src/__tests__/integration/signup.test.ts` | Integration tests for signup, plan limits, onboarding |

### API — Modified Files
| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Change `@@unique([tenant_id, email])` → `@@unique([email])` on User model |
| `apps/api/src/errors.ts` | Add `PlanLimitError` class (402) |
| `apps/api/src/config.ts` | Add GitHub/Google OAuth env vars |
| `apps/api/src/routes/auth.ts` | Add signup, email login, GitHub/Google OAuth routes |
| `apps/api/src/routes/tenant.ts` | Add onboarding GET/PATCH endpoints |
| `apps/api/src/routes/agents.ts` | Add plan limit check on POST |
| `apps/api/src/routes/policies.ts` | Add plan limit check on POST (per agent) |
| `apps/api/src/routes/api-keys.ts` | Add plan limit check on POST |
| `apps/api/src/routes/webhooks.ts` | Add plan limit check on POST |
| `apps/api/src/middleware/auth.ts` | Skip auth for `/api/v1/auth/signup` and `/api/v1/auth/login/` |
| `apps/api/prisma/seed.ts` | Fix `tenant_id_email` compound key → `email` after unique constraint change |
| `apps/api/src/server-plugins.ts` | (no change needed — auth routes already registered before auth plugin) |
| `apps/api/.env.example` | Add GitHub/Google OAuth env vars |
| `apps/api/package.json` | Add `bcrypt` + `@types/bcrypt` dependencies |

### Dashboard — New Files
| File | Responsibility |
|------|---------------|
| `apps/dashboard/src/app/signup/page.tsx` | Signup page with GitHub/Google/email form |
| `apps/dashboard/src/components/onboarding/OnboardingKeyDialog.tsx` | Modal showing raw API key after signup |
| `apps/dashboard/src/components/onboarding/OnboardingChecklist.tsx` | Horizontal progress bar with 5 steps |

### Dashboard — Modified Files
| File | Change |
|------|--------|
| `apps/dashboard/src/app/login/page.tsx` | Add GitHub/Google buttons, "Sign up" link |
| `apps/dashboard/src/app/dashboard/layout.tsx` | Add OnboardingChecklist to layout |
| `apps/dashboard/src/lib/api-client.ts` | Add signup, onboarding API methods |

---

## Task 1: Database Migration — Change Email Unique Constraint

**Files:**
- Modify: `apps/api/prisma/schema.prisma:48`

- [ ] **Step 1: Update the Prisma schema**

In `apps/api/prisma/schema.prisma`, change the User model's unique constraint:

```prisma
// Replace this line:
  @@unique([tenant_id, email])
// With:
  @@unique([email])
```

- [ ] **Step 2: Generate and apply the migration**

Run:
```bash
cd apps/api && npx prisma migrate dev --name change-email-unique-constraint
```

Expected: Migration created and applied. The `@@unique([tenant_id, email])` index is replaced with `@@unique([email])`.

**Note:** This migration drops the composite unique and adds a simple unique on email. If there are existing duplicate emails across tenants, the migration will fail — but the test/seed data only has one user, so this is safe.

- [ ] **Step 3: Fix code referencing the old compound unique key**

The old `tenant_id_email` compound unique identifier no longer exists in the Prisma client. Two files must be updated:

In `apps/api/src/routes/auth.ts`, change the OIDC callback's user lookup (around line 161):
```typescript
// Replace:
    const existingUser = await prisma.user.findUnique({
      where: { tenant_id_email: { tenant_id: tenant.id, email } },
    });
// With:
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
```

In `apps/api/prisma/seed.ts`, update the upsert/findUnique for the admin user:
```typescript
// Replace any occurrence of:
  where: { tenant_id_email: { tenant_id: 'tenant-default', email: 'admin@example.com' } }
// With:
  where: { email: 'admin@example.com' }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "chore: change User email constraint from tenant-scoped to globally unique

Required for self-serve signup where tenant doesn't exist yet at signup time."
```

---

## Task 2: Add PlanLimitError and bcrypt Dependency

**Files:**
- Modify: `apps/api/src/errors.ts`
- Modify: `apps/api/package.json` (via npm install)

- [ ] **Step 1: Add PlanLimitError to errors.ts**

Append to `apps/api/src/errors.ts`:

```typescript
export class PlanLimitError extends AppError {
  constructor(limitName: string, current: number, max: number) {
    super('plan_limit_reached', 402,
      `Free plan allows up to ${max} ${limitName.replace(/_/g, ' ')}. Upgrade to Team for more.`,
      { limit: limitName, current, max }
    );
  }
}
```

- [ ] **Step 2: Install bcrypt**

Run:
```bash
cd apps/api && npm install bcrypt && npm install --save-dev @types/bcrypt
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/errors.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat: add PlanLimitError (402) and bcrypt dependency

PlanLimitError returns 402 with limit name, current count, and max.
bcrypt will be used for email/password signup hashing."
```

---

## Task 3: Email/Password Provider

**Files:**
- Create: `apps/api/src/auth/providers/email-password.ts`

- [ ] **Step 1: Create the email/password provider**

Create `apps/api/src/auth/providers/email-password.ts`:

```typescript
import { hash, compare } from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export class EmailPasswordProvider {
  async hashPassword(password: string): Promise<string> {
    return hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }

  validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
    if (password.length > 128) return { valid: false, message: 'Password must be at most 128 characters' };
    return { valid: true };
  }

  validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/providers/email-password.ts
git commit -m "feat: add EmailPasswordProvider with bcrypt hashing and validation"
```

---

## Task 4: GitHub OAuth Provider

**Files:**
- Create: `apps/api/src/auth/providers/github.ts`

- [ ] **Step 1: Create the GitHub provider**

Create `apps/api/src/auth/providers/github.ts`:

```typescript
export interface GitHubUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
}

export class GitHubProvider {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (data.error || !data.access_token) {
      throw new Error(`GitHub token exchange error: ${data.error ?? 'no access_token'}`);
    }

    return data.access_token;
  }

  async getUser(accessToken: string): Promise<GitHubUser> {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`GitHub user API failed: ${userResponse.status}`);
    }

    const userData = (await userResponse.json()) as {
      id: number;
      name: string | null;
      login: string;
      email: string | null;
      avatar_url: string;
    };

    let email = userData.email;

    // If email is null (private), fetch from /user/emails
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primary = emails.find(e => e.primary && e.verified);
        email = primary?.email ?? emails[0]?.email ?? null;
      }
    }

    if (!email) {
      throw new Error('Could not retrieve email from GitHub');
    }

    return {
      id: String(userData.id),
      name: userData.name ?? userData.login,
      email,
      avatar_url: userData.avatar_url,
    };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/providers/github.ts
git commit -m "feat: add GitHubProvider for OAuth 2.0 authorization code flow"
```

---

## Task 5: Google OIDC Provider

**Files:**
- Create: `apps/api/src/auth/providers/google.ts`

- [ ] **Step 1: Create the Google provider**

Create `apps/api/src/auth/providers/google.ts`. Wraps `openid-client` (already installed) with Google-specific issuer:

```typescript
import * as oidcClient from 'openid-client';

let googleConfig: oidcClient.Configuration | null = null;

export class GoogleProvider {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  private async getConfig(): Promise<oidcClient.Configuration> {
    if (googleConfig) return googleConfig;

    googleConfig = await oidcClient.discovery(
      new URL('https://accounts.google.com'),
      this.clientId,
      this.clientSecret,
    );

    return googleConfig;
  }

  async getAuthorizationUrl(state: string, codeVerifier: string): Promise<string> {
    const config = await this.getConfig();

    const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);

    const url = oidcClient.buildAuthorizationUrl(config, {
      redirect_uri: this.redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return url.href;
  }

  async exchangeCode(
    code: string,
    state: string,
    codeVerifier: string,
    requestUrl: URL
  ): Promise<{ email: string; name: string; sub: string }> {
    const config = await this.getConfig();

    const tokens = await oidcClient.authorizationCodeGrant(config, requestUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    });

    const claims = tokens.claims();
    if (!claims) {
      throw new Error('Google OIDC: no claims in token');
    }

    const email = claims.email as string | undefined;
    const name = (claims.name as string | undefined) ?? email ?? 'Unknown';

    if (!email) {
      throw new Error('Google OIDC: no email in claims');
    }

    return { email, name, sub: claims.sub as string };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/providers/google.ts
git commit -m "feat: add GoogleProvider for OIDC with PKCE via openid-client"
```

---

## Task 6: Tenant Provisioning Function

**Files:**
- Create: `apps/api/src/auth/provision.ts`

- [ ] **Step 1: Create the provisioning function**

Create `apps/api/src/auth/provision.ts`:

```typescript
import { PrismaClient } from '../generated/prisma/index.js';
import { createHash, randomBytes } from 'node:crypto';
import { ConflictError } from '../errors.js';

export interface ProvisionResult {
  user: { id: string; email: string; name: string; role: string; tenant_id: string };
  tenant: { id: string; name: string; slug: string; plan: string };
  apiKey: string; // Raw key — shown once
}

const DEFAULT_ONBOARDING_STATE = {
  copy_api_key: false,
  register_agent: false,
  create_policy: false,
  run_evaluation: false,
  see_trace: false,
};

const DEFAULT_API_KEY_SCOPES = ['evaluate', 'traces:read', 'traces:write', 'approvals:read'];

export async function provisionNewUser(
  prisma: PrismaClient,
  params: {
    email: string;
    name: string;
    authProvider: string;
    authProviderId: string | null;
    passwordHash: string | null;
  }
): Promise<ProvisionResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Check if user already exists
    const existing = await tx.user.findUnique({ where: { email: params.email } });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    // 2. Create tenant
    const tenantName = `${params.name}'s workspace`;
    const tenantSlug =
      params.email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9]/g, '-') +
      '-' +
      Date.now().toString(36);

    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        plan: 'free',
        settings: {
          default_approval_ttl_seconds: 86400,
          default_data_classification: 'internal',
          notification_email: params.email,
          notifications_enabled: true,
        },
        onboarding_state: DEFAULT_ONBOARDING_STATE,
      },
    });

    // 3. Create user (admin — first user in tenant)
    const user = await tx.user.create({
      data: {
        tenant_id: tenant.id,
        email: params.email,
        name: params.name,
        role: 'admin',
        auth_provider: params.authProvider,
        auth_provider_id: params.authProviderId,
        password_hash: params.passwordHash,
      },
    });

    // 4. Create default API key
    const rawKey = 'ai_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    await tx.apiKey.create({
      data: {
        tenant_id: tenant.id,
        name: 'Default Key',
        key_prefix: rawKey.substring(0, 12),
        key_hash: keyHash,
        scopes: DEFAULT_API_KEY_SCOPES,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: tenant.id,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
      apiKey: rawKey,
    };
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/provision.ts
git commit -m "feat: add provisionNewUser() for atomic tenant+user+API key creation"
```

---

## Task 7: Plan Limits Middleware

**Files:**
- Create: `apps/api/src/middleware/plan-limits.ts`

- [ ] **Step 1: Create the plan limits module**

Create `apps/api/src/middleware/plan-limits.ts`:

```typescript
import { PrismaClient } from '../generated/prisma/index.js';
import { PlanLimitError } from '../errors.js';

const FREE_PLAN_LIMITS = {
  max_agents: 5,
  max_policies_per_agent: 10,
  max_api_keys: 2,
  max_webhook_endpoints: 1,
  max_users: 3,
  trace_retention_days: 7,
  rate_limit_evaluate_per_min: 100,
} as const;

const TEAM_PLAN_LIMITS = {
  max_agents: 50,
  max_policies_per_agent: 100,
  max_api_keys: 20,
  max_webhook_endpoints: 10,
  max_users: 25,
  trace_retention_days: 90,
  rate_limit_evaluate_per_min: 1000,
} as const;

const ENTERPRISE_PLAN_LIMITS = {
  max_agents: Infinity,
  max_policies_per_agent: Infinity,
  max_api_keys: Infinity,
  max_webhook_endpoints: Infinity,
  max_users: Infinity,
  trace_retention_days: Infinity,
  rate_limit_evaluate_per_min: 10000,
} as const;

type PlanLimitName = keyof typeof FREE_PLAN_LIMITS;

function getLimits(plan: string): typeof FREE_PLAN_LIMITS {
  if (plan === 'enterprise') return ENTERPRISE_PLAN_LIMITS;
  if (plan === 'team') return TEAM_PLAN_LIMITS;
  return FREE_PLAN_LIMITS;
}

export async function checkPlanLimit(
  prisma: PrismaClient,
  tenantId: string,
  limitName: PlanLimitName,
  currentCount: number
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });

  const limits = getLimits(tenant?.plan ?? 'free');
  const max = limits[limitName];

  if (max !== Infinity && currentCount >= max) {
    throw new PlanLimitError(limitName, currentCount, max);
  }
}

export { FREE_PLAN_LIMITS, TEAM_PLAN_LIMITS, ENTERPRISE_PLAN_LIMITS };
export type { PlanLimitName };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/plan-limits.ts
git commit -m "feat: add plan limits enforcement with free/team/enterprise tiers"
```

---

## Task 8: Update Config with OAuth Environment Variables

**Files:**
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Add GitHub/Google config fields to config.ts**

In `apps/api/src/config.ts`, add these fields to the `configSchema`:

```typescript
// After the existing oidc fields, add:
  githubClientId: z.string().optional(),
  githubClientSecret: z.string().optional(),
  githubRedirectUri: z.string().default('http://localhost:4000/api/v1/auth/callback/github'),
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().default(''),
  googleRedirectUri: z.string().default('http://localhost:4000/api/v1/auth/callback/google'),
```

In the `loadConfig()` function's `configSchema.safeParse()` call, add the corresponding env var mappings:

```typescript
    githubClientId: process.env['GITHUB_CLIENT_ID'],
    githubClientSecret: process.env['GITHUB_CLIENT_SECRET'],
    githubRedirectUri: process.env['GITHUB_REDIRECT_URI'],
    googleClientId: process.env['GOOGLE_CLIENT_ID'],
    googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    googleRedirectUri: process.env['GOOGLE_REDIRECT_URI'],
```

- [ ] **Step 2: Update .env.example**

Append to `apps/api/.env.example`:

```
# GitHub OAuth (optional — signup via GitHub disabled if not set)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:4000/api/v1/auth/callback/github

# Google OIDC (optional — signup via Google disabled if not set)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/callback/google
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/config.ts apps/api/.env.example
git commit -m "feat: add GitHub and Google OAuth environment variables to config"
```

---

## Task 9: Auth Routes — Signup & OAuth Flows

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/middleware/auth.ts`

This is the largest task. It adds 6 new routes to the existing auth routes file.

- [ ] **Step 1: Update auth middleware to skip new auth routes**

In `apps/api/src/middleware/auth.ts`, the `onRequest` hook already skips URLs starting with `/api/v1/auth/`. Verify this covers the new routes (`/api/v1/auth/signup`, `/api/v1/auth/login/email`, `/api/v1/auth/login/github`, `/api/v1/auth/callback/github`, `/api/v1/auth/login/google`, `/api/v1/auth/callback/google`). The existing check on line 47 (`request.url.startsWith('/api/v1/auth/')`) already handles this — no change needed.

- [ ] **Step 2: Add imports and pendingApiKeys map to auth.ts**

Add to the top of `apps/api/src/routes/auth.ts`:

```typescript
import { z } from 'zod';
import { EmailPasswordProvider } from '../auth/providers/email-password.js';
import { GitHubProvider } from '../auth/providers/github.js';
import { GoogleProvider } from '../auth/providers/google.js';
import { provisionNewUser } from '../auth/provision.js';
import { ConflictError, ValidationError } from '../errors.js';
```

Add after the `pendingAuths` map declaration (around line 12):

```typescript
// In-memory store for API keys generated during OAuth signup.
// Key is shown once via GET /auth/onboarding-key, then deleted.
const pendingApiKeys = new Map<string, { key: string; expiresAt: number }>();
```

Add to the cleanup interval (inside the setInterval around line 15-20):

```typescript
  for (const [key, value] of pendingApiKeys.entries()) {
    if (value.expiresAt < Date.now()) pendingApiKeys.delete(key);
  }
```

- [ ] **Step 3: Add email/password signup route**

Add inside the `authRoutes` function in `apps/api/src/routes/auth.ts`, before the logout route:

```typescript
  // ── POST /auth/signup — email/password ──────────────────────────────────
  const SignupSchema = z.object({
    email: z.string().trim().toLowerCase(),
    password: z.string(),
    name: z.string().trim().min(1).max(200),
  }).strict();

  app.post('/auth/signup', async (request, reply) => {
    const body = SignupSchema.parse(request.body);
    const emailPassword = new EmailPasswordProvider();

    // Validate email format
    if (!emailPassword.validateEmail(body.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength
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

    // Create session
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
```

- [ ] **Step 4: Add email/password login route**

Add after the signup route:

```typescript
  // ── POST /auth/login/email — email/password login ───────────────────────
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

    // Update last login
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
```

- [ ] **Step 5: Add GitHub OAuth routes**

Add after the email login route:

```typescript
  // ── GitHub OAuth ───────────────────────────────────────────────────────

  app.get('/auth/login/github', async (request: FastifyRequest<{
    Querystring: { redirect_uri?: string };
  }>, reply: FastifyReply) => {
    const githubClientId = process.env['GITHUB_CLIENT_ID'];
    const githubClientSecret = process.env['GITHUB_CLIENT_SECRET'];
    const githubRedirectUri = process.env['GITHUB_REDIRECT_URI'] ?? 'http://localhost:4000/api/v1/auth/callback/github';

    if (!githubClientId || !githubClientSecret) {
      throw new ValidationError('GitHub OAuth is not configured');
    }

    const redirectUri = (request.query as { redirect_uri?: string }).redirect_uri ?? '/dashboard';
    const state = randomUUID();
    const github = new GitHubProvider(githubClientId, githubClientSecret, githubRedirectUri);

    pendingAuths.set(state, {
      codeVerifier: redirectUri, // Reuse codeVerifier field to store redirect_uri
      redirectUri,
      expiresAt: Date.now() + 300000,
    });

    return reply.redirect(github.getAuthorizationUrl(state));
  });

  app.get('/auth/callback/github', async (request: FastifyRequest<{
    Querystring: { code?: string; state?: string; error?: string };
  }>, reply: FastifyReply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      request.log.warn({ error: query.error }, 'GitHub callback error');
      return reply.redirect('/login?error=auth_failed');
    }

    if (!query.state || !query.code) {
      return reply.redirect('/login?error=invalid_callback');
    }

    const pending = pendingAuths.get(query.state);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingAuths.delete(query.state);
      return reply.redirect('/login?error=invalid_state');
    }
    pendingAuths.delete(query.state);

    const githubClientId = process.env['GITHUB_CLIENT_ID']!;
    const githubClientSecret = process.env['GITHUB_CLIENT_SECRET']!;
    const githubRedirectUri = process.env['GITHUB_REDIRECT_URI'] ?? 'http://localhost:4000/api/v1/auth/callback/github';

    const github = new GitHubProvider(githubClientId, githubClientSecret, githubRedirectUri);

    try {
      const accessToken = await github.exchangeCode(query.code);
      const githubUser = await github.getUser(accessToken);

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email: githubUser.email },
        include: { tenant: true },
      });

      if (existingUser) {
        // Returning user — verify same provider
        if (existingUser.auth_provider !== 'github') {
          return reply.redirect('/login?error=provider_mismatch');
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

      // New user — provision tenant
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

      // For OAuth signups, store the API key in an in-memory map keyed by session.
      // Dashboard will fetch it once via GET /auth/onboarding-key and it's deleted after retrieval.
      pendingApiKeys.set(sessionId, { key: result.apiKey, expiresAt: Date.now() + 300000 });

      return reply.redirect('/dashboard?onboarding=true');
    } catch (err) {
      request.log.error({ err }, 'GitHub OAuth error');
      return reply.redirect('/login?error=auth_failed');
    }
  });
```

- [ ] **Step 6: Add Google OIDC routes**

Add after the GitHub routes:

```typescript
  // ── Google OIDC ────────────────────────────────────────────────────────

  app.get('/auth/login/google', async (request: FastifyRequest<{
    Querystring: { redirect_uri?: string };
  }>, reply: FastifyReply) => {
    const googleClientId = process.env['GOOGLE_CLIENT_ID'];
    const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    const googleRedirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:4000/api/v1/auth/callback/google';

    if (!googleClientId || !googleClientSecret) {
      throw new ValidationError('Google OAuth is not configured');
    }

    const redirectUri = (request.query as { redirect_uri?: string }).redirect_uri ?? '/dashboard';
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

  app.get('/auth/callback/google', async (request: FastifyRequest<{
    Querystring: { code?: string; state?: string; error?: string };
  }>, reply: FastifyReply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      request.log.warn({ error: query.error }, 'Google callback error');
      return reply.redirect('/login?error=auth_failed');
    }

    if (!query.state || !query.code) {
      return reply.redirect('/login?error=invalid_callback');
    }

    const pending = pendingAuths.get(query.state);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingAuths.delete(query.state);
      return reply.redirect('/login?error=invalid_state');
    }
    pendingAuths.delete(query.state);

    const googleClientId = process.env['GOOGLE_CLIENT_ID']!;
    const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET']!;
    const googleRedirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:4000/api/v1/auth/callback/google';

    const google = new GoogleProvider(googleClientId, googleClientSecret, googleRedirectUri);

    try {
      const requestUrl = new URL(request.url, `http://${request.hostname}`);
      const googleUser = await google.exchangeCode(
        query.code,
        query.state,
        pending.codeVerifier,
        requestUrl
      );

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email: googleUser.email },
        include: { tenant: true },
      });

      if (existingUser) {
        if (existingUser.auth_provider !== 'google') {
          return reply.redirect('/login?error=provider_mismatch');
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

      // New user — provision
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

      return reply.redirect('/dashboard?onboarding=true');
    } catch (err) {
      request.log.error({ err }, 'Google OAuth error');
      return reply.redirect('/login?error=auth_failed');
    }
  });
```

- [ ] **Step 7: Add GET /auth/onboarding-key endpoint**

Add after the Google callback route, still inside the `authRoutes` function:

```typescript
  // ── GET /auth/onboarding-key — one-time API key retrieval ──────────────
  // Called by dashboard after OAuth signup to show the API key dialog.
  // The key is deleted after retrieval (shown exactly once).
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
```

- [ ] **Step 8: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/middleware/auth.ts
git commit -m "feat: add signup, email login, GitHub OAuth, and Google OIDC routes

- POST /auth/signup — email/password with atomic tenant provisioning
- POST /auth/login/email — email/password login for returning users
- GET /auth/login/github + callback — GitHub OAuth flow
- GET /auth/login/google + callback — Google OIDC flow
- New users get tenant + admin user + API key atomically
- Returning OAuth users get session without new tenant"
```

---

## Task 10: Add Onboarding Endpoints to Tenant Routes

**Files:**
- Modify: `apps/api/src/routes/tenant.ts`

- [ ] **Step 1: Add onboarding GET endpoint**

Add to `apps/api/src/routes/tenant.ts`, inside the `tenantRoutes` function:

```typescript
  // GET /api/v1/tenant/onboarding — returns onboarding state with auto-detection
  app.get('/tenant/onboarding', async (request, reply) => {
    const tenantId = request.tenantId!;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboarding_state: true },
    });

    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const state = tenant.onboarding_state as Record<string, boolean>;

    // Auto-detect completed steps
    const [agentCount, policyCount, traceCount] = await Promise.all([
      prisma.agent.count({ where: { tenant_id: tenantId } }),
      prisma.policyRule.count({ where: { tenant_id: tenantId } }),
      prisma.auditTrace.count({ where: { tenant_id: tenantId } }),
    ]);

    const resolved = {
      copy_api_key: state.copy_api_key ?? false,
      register_agent: (state.register_agent ?? false) || agentCount > 0,
      create_policy: (state.create_policy ?? false) || policyCount > 0,
      run_evaluation: (state.run_evaluation ?? false) || traceCount > 0,
      see_trace: state.see_trace ?? false,
    };

    return reply.send({ data: resolved });
  });
```

- [ ] **Step 2: Add onboarding PATCH endpoint**

Add after the GET endpoint:

```typescript
  const UpdateOnboardingSchema = z.object({
    copy_api_key: z.boolean().optional(),
    register_agent: z.boolean().optional(),
    create_policy: z.boolean().optional(),
    run_evaluation: z.boolean().optional(),
    see_trace: z.boolean().optional(),
  }).strict();

  // PATCH /api/v1/tenant/onboarding — update step completion
  app.patch('/tenant/onboarding', async (request, reply) => {
    const tenantId = request.tenantId!;
    const body = UpdateOnboardingSchema.parse(request.body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboarding_state: true },
    });
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const currentState = tenant.onboarding_state as Record<string, boolean>;
    const updatedState = { ...currentState, ...body };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { onboarding_state: updatedState },
    });

    return reply.send({ data: updatedState });
  });
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/tenant.ts
git commit -m "feat: add onboarding GET/PATCH endpoints with auto-detection"
```

---

## Task 11: Enforce Plan Limits in Resource Routes

**Files:**
- Modify: `apps/api/src/routes/agents.ts`
- Modify: `apps/api/src/routes/policies.ts`
- Modify: `apps/api/src/routes/api-keys.ts`
- Modify: `apps/api/src/routes/webhooks.ts`

- [ ] **Step 1: Add plan limit check to agent creation**

In `apps/api/src/routes/agents.ts`, add import at top:

```typescript
import { checkPlanLimit } from '../middleware/plan-limits.js';
import { prisma } from '../db/client.js';
```

In the `POST /agents` handler, add before the `agentService.create()` call:

```typescript
    // Check plan limit
    const currentCount = await prisma.agent.count({ where: { tenant_id: request.tenantId! } });
    await checkPlanLimit(prisma, request.tenantId!, 'max_agents', currentCount);
```

- [ ] **Step 2: Add plan limit check to policy creation**

In `apps/api/src/routes/policies.ts`, add import at top:

```typescript
import { checkPlanLimit } from '../middleware/plan-limits.js';
import { prisma } from '../db/client.js';
```

In the `POST /policies` handler, add before the policy creation call:

```typescript
    // Check plan limit (policies per agent)
    const policyCount = await prisma.policyRule.count({
      where: { tenant_id: request.tenantId!, agent_id: body.agent_id },
    });
    await checkPlanLimit(prisma, request.tenantId!, 'max_policies_per_agent', policyCount);
```

- [ ] **Step 3: Add plan limit check to API key creation**

In `apps/api/src/routes/api-keys.ts`, add import at top:

```typescript
import { checkPlanLimit } from '../middleware/plan-limits.js';
```

In the `POST /api-keys` handler, add after validation and before `service.create()`:

```typescript
    // Check plan limit
    const currentCount = await prisma.apiKey.count({ where: { tenant_id: request.tenantId! } });
    await checkPlanLimit(prisma, request.tenantId!, 'max_api_keys', currentCount);
```

- [ ] **Step 4: Add plan limit check to webhook creation**

In `apps/api/src/routes/webhooks.ts`, add import at top:

```typescript
import { checkPlanLimit } from '../middleware/plan-limits.js';
import { prisma } from '../db/client.js';
```

In the `POST /webhooks` handler, add after URL/event validation, before the `db.webhookEndpoint.create()` call:

```typescript
    // Check plan limit
    const currentCount = await prisma.webhookEndpoint.count({ where: { tenant_id: request.tenantId! } });
    await checkPlanLimit(prisma, request.tenantId!, 'max_webhook_endpoints', currentCount);
```

- [ ] **Step 5: Add user count limit to OIDC callback**

In `apps/api/src/routes/auth.ts`, in the existing OIDC callback handler where a new user is created (around the `const user = existingUser ?? await prisma.user.create(...)` block), add a check before creating the user:

```typescript
    // Before creating a new user for an existing tenant, check max_users limit
    if (!existingUser) {
      const userCount = await prisma.user.count({ where: { tenant_id: tenant.id } });
      const { checkPlanLimit } = await import('../middleware/plan-limits.js');
      await checkPlanLimit(prisma, tenant.id, 'max_users', userCount);
    }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run:
```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/agents.ts apps/api/src/routes/policies.ts apps/api/src/routes/api-keys.ts apps/api/src/routes/webhooks.ts apps/api/src/routes/auth.ts
git commit -m "feat: enforce plan limits on agent, policy, API key, webhook, and user creation

Returns 402 with limit name, current count, and max when free plan
limit is reached."
```

---

## Task 12: Integration Tests — Signup & Plan Limits

**Files:**
- Create: `apps/api/src/__tests__/integration/signup.test.ts`

- [ ] **Step 1: Create the integration test file**

Create `apps/api/src/__tests__/integration/signup.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { SessionManager } from '../../auth/session.js';
import { randomUUID, createHash, randomBytes } from 'node:crypto';

let app: FastifyInstance;
let prisma: PrismaClient;

beforeAll(async () => {
  const server = await createTestServer();
  app = server.app;
  prisma = server.prisma;
});

afterAll(async () => {
  await destroyTestServer();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function signup(data: { email: string; password: string; name: string }) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: data,
  });
}

async function createAdminSessionForTenant(tenantId: string, userId: string) {
  const sessionManager = new SessionManager(prisma);
  const sessionId = await sessionManager.create(userId, tenantId);
  const csrfToken = randomUUID();
  return {
    cookie: `session=${sessionId}; csrf_token=${csrfToken}`,
    csrfToken,
  };
}

// ── Email/Password Signup ─────────────────────────────────────────────────

describe('Self-Serve Signup', () => {
  describe('Email/password signup', () => {
    it('creates tenant + user + API key atomically', async () => {
      const res = await signup({
        email: 'dev@startup.io',
        password: 'secureP@ss123',
        name: 'Dev User',
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.user.email).toBe('dev@startup.io');
      expect(body.data.user.name).toBe('Dev User');
      expect(body.data.tenant.name).toBe("Dev User's workspace");
      expect(body.data.api_key).toMatch(/^ai_/);

      // Verify in database
      const user = await prisma.user.findUnique({ where: { email: 'dev@startup.io' } });
      expect(user).not.toBeNull();
      expect(user!.tenant_id).toBe(body.data.tenant.id);

      const tenant = await prisma.tenant.findUnique({ where: { id: body.data.tenant.id } });
      expect(tenant).not.toBeNull();

      const apiKeys = await prisma.apiKey.findMany({ where: { tenant_id: body.data.tenant.id } });
      expect(apiKeys).toHaveLength(1);
    });

    it('user role is admin', async () => {
      const res = await signup({
        email: 'admin@test.com',
        password: 'secureP@ss123',
        name: 'Admin User',
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.user.role).toBe('admin');
    });

    it('tenant plan is free', async () => {
      const res = await signup({
        email: 'free@test.com',
        password: 'secureP@ss123',
        name: 'Free User',
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.tenant.plan).toBe('free');
    });

    it('API key has default scopes', async () => {
      const res = await signup({
        email: 'scopes@test.com',
        password: 'secureP@ss123',
        name: 'Scope User',
      });

      const body = JSON.parse(res.body);
      const apiKey = await prisma.apiKey.findFirst({
        where: { tenant_id: body.data.tenant.id },
      });

      expect(apiKey!.scopes).toEqual(['evaluate', 'traces:read', 'traces:write', 'approvals:read']);
    });

    it('returns raw API key in response (once)', async () => {
      const res = await signup({
        email: 'once@test.com',
        password: 'secureP@ss123',
        name: 'Once User',
      });

      const body = JSON.parse(res.body);
      const rawKey = body.data.api_key;
      expect(rawKey).toMatch(/^ai_/);
      expect(rawKey.length).toBeGreaterThan(40);

      // Verify the hash matches
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const storedKey = await prisma.apiKey.findUnique({ where: { key_hash: keyHash } });
      expect(storedKey).not.toBeNull();
    });

    it('rejects duplicate email (409)', async () => {
      await signup({ email: 'dup@test.com', password: 'secureP@ss123', name: 'First' });
      const res = await signup({ email: 'dup@test.com', password: 'secureP@ss123', name: 'Second' });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('conflict');
    });

    it('rejects weak password (400)', async () => {
      const res = await signup({ email: 'weak@test.com', password: 'short', name: 'Weak' });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('validation_error');
      expect(body.message).toContain('8 characters');
    });

    it('rejects invalid email format (400)', async () => {
      const res = await signup({ email: 'not-an-email', password: 'secureP@ss123', name: 'Bad Email' });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('validation_error');
    });
  });

  describe('Email/password login', () => {
    it('logs in existing email user', async () => {
      await signup({ email: 'login@test.com', password: 'secureP@ss123', name: 'Login User' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login/email',
        payload: { email: 'login@test.com', password: 'secureP@ss123' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.user.email).toBe('login@test.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects wrong password', async () => {
      await signup({ email: 'wrong@test.com', password: 'secureP@ss123', name: 'Wrong' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login/email',
        payload: { email: 'wrong@test.com', password: 'wrongPassword' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects nonexistent user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login/email',
        payload: { email: 'nobody@test.com', password: 'secureP@ss123' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Plan limits', () => {
    it('free plan: 6th agent returns 402', async () => {
      // Create a free-plan tenant via signup
      const signupRes = await signup({
        email: 'limits@test.com',
        password: 'secureP@ss123',
        name: 'Limits User',
      });
      const signupBody = JSON.parse(signupRes.body);
      const tenantId = signupBody.data.tenant.id;
      const userId = signupBody.data.user.id;
      const session = await createAdminSessionForTenant(tenantId, userId);

      // Create 5 agents (the limit)
      for (let i = 0; i < 5; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/agents',
          headers: {
            cookie: session.cookie,
            'x-csrf-token': session.csrfToken,
            'content-type': 'application/json',
          },
          payload: {
            name: `Agent ${i}`,
            description: 'Test agent',
            owner_name: 'Test Owner',
            owner_role: 'Engineer',
            team: 'Test',
            environment: 'dev',
            authority_model: 'self',
            identity_mode: 'service_identity',
            delegation_model: 'self',
            authorized_integrations: [],
          },
        });
        expect(res.statusCode).toBe(201);
      }

      // 6th should fail
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Agent 6',
          description: 'One too many',
          owner_name: 'Test Owner',
          owner_role: 'Engineer',
          team: 'Test',
          environment: 'dev',
          authority_model: 'self',
          identity_mode: 'service_identity',
          delegation_model: 'self',
          authorized_integrations: [],
        },
      });

      expect(res.statusCode).toBe(402);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('plan_limit_reached');
      expect(body.details.limit).toBe('max_agents');
      expect(body.details.current).toBe(5);
      expect(body.details.max).toBe(5);
    });

    it('free plan: 3rd API key returns 402', async () => {
      const signupRes = await signup({
        email: 'keyslimit@test.com',
        password: 'secureP@ss123',
        name: 'Keys User',
      });
      const signupBody = JSON.parse(signupRes.body);
      const tenantId = signupBody.data.tenant.id;
      const userId = signupBody.data.user.id;
      const session = await createAdminSessionForTenant(tenantId, userId);

      // Already have 1 key from signup, create 1 more (total 2 = limit)
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
          'content-type': 'application/json',
        },
        payload: { name: 'Second Key', scopes: ['evaluate'] },
      });
      expect(res1.statusCode).toBe(201);

      // 3rd should fail
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
          'content-type': 'application/json',
        },
        payload: { name: 'Third Key', scopes: ['evaluate'] },
      });

      expect(res2.statusCode).toBe(402);
      const body = JSON.parse(res2.body);
      expect(body.error).toBe('plan_limit_reached');
      expect(body.details.limit).toBe('max_api_keys');
    });

    it('free plan: 2nd webhook returns 402', async () => {
      const signupRes = await signup({
        email: 'webhooks@test.com',
        password: 'secureP@ss123',
        name: 'Webhooks User',
      });
      const signupBody = JSON.parse(signupRes.body);
      const tenantId = signupBody.data.tenant.id;
      const userId = signupBody.data.user.id;
      const session = await createAdminSessionForTenant(tenantId, userId);

      // Create 1 webhook (the limit)
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
          'content-type': 'application/json',
        },
        payload: { url: 'http://localhost:9999/hook', events: ['approval.created'] },
      });
      expect(res1.statusCode).toBe(201);

      // 2nd should fail
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
          'content-type': 'application/json',
        },
        payload: { url: 'http://localhost:9999/hook2', events: ['approval.created'] },
      });

      expect(res2.statusCode).toBe(402);
      const body = JSON.parse(res2.body);
      expect(body.error).toBe('plan_limit_reached');
      expect(body.details.limit).toBe('max_webhook_endpoints');
    });

    it('enterprise plan: no limits enforced', async () => {
      // Seed an enterprise tenant
      const testData = await seedTestData(prisma);

      // seedTestData creates enterprise plan tenant — create 6 agents
      for (let i = 0; i < 6; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/agents',
          headers: {
            authorization: `Bearer ${testData.rawApiKey}`,
            'content-type': 'application/json',
          },
          payload: {
            name: `Enterprise Agent ${i}`,
            description: 'Test',
            owner_name: 'Owner',
            owner_role: 'Engineer',
            team: 'Test',
            environment: 'dev',
            authority_model: 'self',
            identity_mode: 'service_identity',
            delegation_model: 'self',
            authorized_integrations: [],
          },
        });
        expect(res.statusCode).toBe(201);
      }
    });

    it('402 response includes limit name, current count, max', async () => {
      const signupRes = await signup({
        email: 'details@test.com',
        password: 'secureP@ss123',
        name: 'Details User',
      });
      const signupBody = JSON.parse(signupRes.body);
      const tenantId = signupBody.data.tenant.id;
      const userId = signupBody.data.user.id;
      const session = await createAdminSessionForTenant(tenantId, userId);

      // Exhaust webhook limit (1)
      await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
          'content-type': 'application/json',
        },
        payload: { url: 'http://localhost:9999/hook', events: ['approval.created'] },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
          'content-type': 'application/json',
        },
        payload: { url: 'http://localhost:9999/hook2', events: ['approval.created'] },
      });

      expect(res.statusCode).toBe(402);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('plan_limit_reached');
      expect(body.details).toEqual({
        limit: 'max_webhook_endpoints',
        current: 1,
        max: 1,
      });
    });
  });

  describe('Onboarding', () => {
    it('GET /tenant/onboarding returns all steps as false initially', async () => {
      const signupRes = await signup({
        email: 'onboard@test.com',
        password: 'secureP@ss123',
        name: 'Onboard User',
      });
      const signupBody = JSON.parse(signupRes.body);
      const session = await createAdminSessionForTenant(
        signupBody.data.tenant.id,
        signupBody.data.user.id
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/onboarding',
        headers: { cookie: session.cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toEqual({
        copy_api_key: false,
        register_agent: false,
        create_policy: false,
        run_evaluation: false,
        see_trace: false,
      });
    });

    it('PATCH /tenant/onboarding updates step completion', async () => {
      const signupRes = await signup({
        email: 'patchboard@test.com',
        password: 'secureP@ss123',
        name: 'Patch User',
      });
      const signupBody = JSON.parse(signupRes.body);
      const session = await createAdminSessionForTenant(
        signupBody.data.tenant.id,
        signupBody.data.user.id
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/tenant/onboarding',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrfToken,
          'content-type': 'application/json',
        },
        payload: { copy_api_key: true },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.copy_api_key).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run the integration tests**

Run:
```bash
cd apps/api && npx vitest run src/__tests__/integration/signup.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Run the full test suite to check for regressions**

Run:
```bash
cd apps/api && npm test
```

Expected: All tests pass (no regressions from the email unique constraint change).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/__tests__/integration/signup.test.ts
git commit -m "test: add integration tests for signup, plan limits, and onboarding

- Email/password signup atomicity
- Admin role, free plan, default scopes
- Duplicate email 409
- Weak password / invalid email 400
- Plan limits: agents (5), API keys (2), webhooks (1)
- Enterprise plan bypasses limits
- 402 response includes limit details
- Onboarding GET/PATCH endpoints"
```

---

## Task 13: Dashboard — Signup Page

**Files:**
- Create: `apps/dashboard/src/app/signup/page.tsx`

- [ ] **Step 1: Create the signup page**

Create `apps/dashboard/src/app/signup/page.tsx`:

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGitHub = () => {
    window.location.href = `${API_URL}/api/v1/auth/login/github?redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard')}`;
  };

  const handleGoogle = () => {
    window.location.href = `${API_URL}/api/v1/auth/login/google?redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard')}`;
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message ?? 'Signup failed');
        return;
      }

      // Store API key in sessionStorage (not URL) for security, then redirect
      const apiKey = data.data.api_key;
      sessionStorage.setItem('onboarding_api_key', apiKey);
      router.push('/dashboard?onboarding=true');
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#E4E4E7]">
            SidClaw
          </h1>
          <p className="mt-2 text-sm text-[#71717A]">
            The approval layer for agentic AI
          </p>
        </div>

        {(error || formError) && (
          <div className="rounded-md border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3 text-center text-sm text-[#EF4444]">
            {error === 'provider_mismatch'
              ? 'An account with this email exists with a different provider.'
              : error === 'auth_failed'
                ? 'Authentication failed. Please try again.'
                : formError || 'An error occurred.'}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGitHub}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#27272A] bg-[#18181B] px-4 py-2.5 text-sm font-medium text-[#E4E4E7] transition-colors hover:bg-[#18181B]/80"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Sign up with GitHub
          </button>

          <button
            type="button"
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#27272A] bg-[#18181B] px-4 py-2.5 text-sm font-medium text-[#E4E4E7] transition-colors hover:bg-[#18181B]/80"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#27272A]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0A0A0B] px-2 text-[#71717A]">or</span>
          </div>
        </div>

        <form onSubmit={handleEmailSignup} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder="Minimum 8 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#E4E4E7] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] transition-colors hover:bg-[#D4D4D8] disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#71717A]">
          Already have an account?{' '}
          <a href="/login" className="text-[#3B82F6] hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
          <div className="text-sm text-[#71717A]">Loading...</div>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Run:
```bash
cd apps/dashboard && npx next build 2>&1 | head -20
```

Expected: Build succeeds or only shows warnings unrelated to signup.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/signup/page.tsx
git commit -m "feat: add signup page with GitHub, Google, and email/password options"
```

---

## Task 14: Dashboard — Update Login Page

**Files:**
- Modify: `apps/dashboard/src/app/login/page.tsx`

- [ ] **Step 1: Update the login page**

Replace the entire `apps/dashboard/src/app/login/page.tsx` with:

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function LoginContent() {
  const searchParams = useSearchParams();
  const expired = searchParams.get('expired') === 'true';
  const error = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSSO = () => {
    window.location.href = `${API_URL}/api/v1/auth/login?redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard')}`;
  };

  const handleGitHub = () => {
    window.location.href = `${API_URL}/api/v1/auth/login/github?redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard')}`;
  };

  const handleGoogle = () => {
    window.location.href = `${API_URL}/api/v1/auth/login/google?redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard')}`;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message ?? 'Login failed');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#E4E4E7]">
            SidClaw
          </h1>
          <p className="mt-2 text-sm text-[#71717A]">
            Sign in to continue
          </p>
        </div>

        {expired && (
          <div className="rounded-md border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-4 py-3 text-center text-sm text-[#F59E0B]">
            Session expired, please sign in again
          </div>
        )}

        {(error || formError) && (
          <div className="rounded-md border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3 text-center text-sm text-[#EF4444]">
            {error === 'provider_mismatch'
              ? 'An account with this email exists with a different provider.'
              : error === 'auth_failed'
                ? 'Authentication failed. Please try again.'
                : formError || 'An error occurred.'}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGitHub}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#27272A] bg-[#18181B] px-4 py-2.5 text-sm font-medium text-[#E4E4E7] transition-colors hover:bg-[#18181B]/80"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Sign in with GitHub
          </button>

          <button
            type="button"
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#27272A] bg-[#18181B] px-4 py-2.5 text-sm font-medium text-[#E4E4E7] transition-colors hover:bg-[#18181B]/80"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>

          <button
            type="button"
            onClick={handleSSO}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#27272A] bg-[#18181B] px-4 py-2.5 text-sm font-medium text-[#E4E4E7] transition-colors hover:bg-[#18181B]/80"
          >
            Sign in with SSO
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#27272A]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0A0A0B] px-2 text-[#71717A]">or</span>
          </div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder="Your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#E4E4E7] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] transition-colors hover:bg-[#D4D4D8] disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-[#71717A]">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-[#3B82F6] hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
          <div className="text-sm text-[#71717A]">Loading...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/login/page.tsx
git commit -m "feat: update login page with GitHub, Google, SSO, and email/password options"
```

---

## Task 15: Dashboard — Onboarding Components

**Files:**
- Create: `apps/dashboard/src/components/onboarding/OnboardingKeyDialog.tsx`
- Create: `apps/dashboard/src/components/onboarding/OnboardingChecklist.tsx`

- [ ] **Step 1: Create OnboardingKeyDialog**

Create `apps/dashboard/src/components/onboarding/OnboardingKeyDialog.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface OnboardingKeyDialogProps {
  apiKey: string;
  onDismiss: () => void;
}

export function OnboardingKeyDialog({ apiKey, onDismiss }: OnboardingKeyDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-[#27272A] bg-[#18181B] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[#E4E4E7]">
          Your API Key
        </h2>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          Copy this key now. You won&apos;t see it again.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 rounded-md border border-[#27272A] bg-[#0A0A0B] px-3 py-2 font-mono text-xs text-[#E4E4E7] break-all">
            {apiKey}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-md border border-[#27272A] bg-[#0A0A0B] px-3 py-2 text-xs font-medium text-[#E4E4E7] transition-colors hover:bg-[#27272A]"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="mt-4 rounded-md border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-3 py-2 text-xs text-[#F59E0B]">
          This is the only time this key will be displayed. Store it securely.
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full rounded-md bg-[#E4E4E7] px-4 py-2 text-sm font-medium text-[#0A0A0B] transition-colors hover:bg-[#D4D4D8]"
        >
          I&apos;ve copied it
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create OnboardingChecklist**

Create `apps/dashboard/src/components/onboarding/OnboardingChecklist.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface OnboardingState {
  copy_api_key: boolean;
  register_agent: boolean;
  create_policy: boolean;
  run_evaluation: boolean;
  see_trace: boolean;
}

const STEPS = [
  { key: 'copy_api_key' as const, label: 'Copy your API key', href: '/dashboard/settings/api-keys' },
  { key: 'register_agent' as const, label: 'Register your first agent', href: '/dashboard/agents' },
  { key: 'create_policy' as const, label: 'Create a policy', href: '/dashboard/policies' },
  { key: 'run_evaluation' as const, label: 'Run your first evaluation', href: '/dashboard' },
  { key: 'see_trace' as const, label: 'See your first trace', href: '/dashboard/audit' },
];

export function OnboardingChecklist() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<{ data: OnboardingState }>('/api/v1/tenant/onboarding')
      .then((res) => setState(res.data))
      .catch(() => {});
  }, []);

  if (!state || dismissed) return null;

  const completedCount = STEPS.filter(s => state[s.key]).length;
  if (completedCount === STEPS.length) return null;

  return (
    <div className="mb-4 rounded-lg border border-[#27272A] bg-[#18181B] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#E4E4E7]">
            Getting started
          </span>
          <span className="text-xs text-[#71717A]">
            {completedCount}/{STEPS.length} complete
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-[#71717A] hover:text-[#A1A1AA]"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {STEPS.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className="flex items-center gap-2 text-sm"
          >
            <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
              state[step.key]
                ? 'border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]'
                : 'border-[#3F3F46] text-[#71717A]'
            }`}>
              {state[step.key] ? '\u2713' : ''}
            </span>
            <span className={state[step.key] ? 'text-[#71717A] line-through' : 'text-[#A1A1AA]'}>
              {step.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/onboarding/
git commit -m "feat: add onboarding key dialog and checklist components"
```

---

## Task 16: Dashboard Layout — Wire Onboarding

**Files:**
- Modify: `apps/dashboard/src/app/dashboard/layout.tsx`
- Modify: `apps/dashboard/src/lib/api-client.ts`

- [ ] **Step 1: Add onboarding to dashboard layout**

Update `apps/dashboard/src/app/dashboard/layout.tsx` to include the onboarding checklist and key dialog:

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { AuthProvider } from '@/lib/auth-context';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { OnboardingKeyDialog } from '@/components/onboarding/OnboardingKeyDialog';
import { api } from '@/lib/api-client';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const [apiKey, setApiKey] = useState<string | null>(
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('onboarding_api_key') : null
  );
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  // On mount, if onboarding mode, check for API key from sessionStorage or server
  useEffect(() => {
    if (!isOnboarding) return;
    if (apiKey) {
      setShowKeyDialog(true);
      return;
    }
    // For OAuth flows: fetch the one-time key from the server
    api.get<{ data: { api_key: string | null } }>('/api/v1/auth/onboarding-key')
      .then((res) => {
        if (res.data.api_key) {
          setApiKey(res.data.api_key);
          setShowKeyDialog(true);
        }
      })
      .catch(() => {});
  }, [isOnboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDismiss = () => {
    setShowKeyDialog(false);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('onboarding_api_key');
    }
    // Mark copy_api_key as complete
    api.patch('/api/v1/tenant/onboarding', { copy_api_key: true }).catch(() => {});
    // Clean URL params
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/dashboard');
    }
  };

  return (
    <>
      {showKeyDialog && apiKey && (
        <OnboardingKeyDialog apiKey={apiKey} onDismiss={handleKeyDismiss} />
      )}
      <div className="flex h-screen bg-surface-0">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto p-6">
            {isOnboarding && <OnboardingChecklist />}
            {children}
          </main>
        </div>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: 'var(--surface-1)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              fontSize: '13px',
            },
          }}
        />
      </div>
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-surface-0">
          <div className="text-sm text-text-muted">Loading...</div>
        </div>
      }>
        <DashboardContent>{children}</DashboardContent>
      </Suspense>
    </AuthProvider>
  );
}
```

Note: This changes the layout from a server component to a client component (adds `'use client'` directive) since it now uses `useSearchParams` and `useState`. The `AuthProvider` was already a client component, so this is consistent.

- [ ] **Step 2: Add onboarding methods to API client**

Add to `apps/dashboard/src/lib/api-client.ts`, in the `ApiClient` class:

```typescript
  // ─── Onboarding Methods ─────────────────────────────────────────────────

  async getOnboarding() {
    return this.get<{
      data: {
        copy_api_key: boolean;
        register_agent: boolean;
        create_policy: boolean;
        run_evaluation: boolean;
        see_trace: boolean;
      };
    }>('/api/v1/tenant/onboarding');
  }

  async updateOnboarding(data: Partial<{
    copy_api_key: boolean;
    register_agent: boolean;
    create_policy: boolean;
    run_evaluation: boolean;
    see_trace: boolean;
  }>) {
    return this.patch<{ data: Record<string, boolean> }>('/api/v1/tenant/onboarding', data);
  }
```

- [ ] **Step 3: Verify the dashboard builds**

Run:
```bash
cd apps/dashboard && npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/app/dashboard/layout.tsx apps/dashboard/src/lib/api-client.ts
git commit -m "feat: wire onboarding dialog and checklist into dashboard layout"
```

---

## Task 17: Final Verification

- [ ] **Step 1: Run API tests**

Run:
```bash
cd apps/api && npm test
```

Expected: All tests pass including the new signup tests.

- [ ] **Step 2: Run full turbo test**

Run:
```bash
npx turbo test
```

Expected: All packages pass.

- [ ] **Step 3: Typecheck everything**

Run:
```bash
npx turbo typecheck
```

Expected: No type errors.

- [ ] **Step 4: Commit any fixes needed, then final commit**

If all tests pass, no additional commit needed. If fixes were required, commit them individually.
