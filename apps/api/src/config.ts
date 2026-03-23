import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().default(4000),
  host: z.string().default('0.0.0.0'),
  environment: z.enum(['development', 'test', 'production']).default('development'),
  databaseUrl: z.string().min(1, 'DATABASE_URL is required'),
  allowedOrigins: z.string().default('http://localhost:3000').transform(s => s.split(',')),
  // OIDC config — optional in development, required in production
  oidcIssuer: z.string().optional(),
  oidcClientId: z.string().optional(),
  oidcClientSecret: z.string().optional(),
  oidcRedirectUri: z.string().optional(),
  // GitHub OAuth — optional, signup via GitHub disabled if not set
  githubClientId: z.string().optional(),
  githubClientSecret: z.string().optional(),
  githubRedirectUri: z.string().default('http://localhost:4000/api/v1/auth/callback/github'),
  // Google OIDC — optional, signup via Google disabled if not set
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  googleRedirectUri: z.string().default('http://localhost:4000/api/v1/auth/callback/google'),
  sessionSecret: z.string().min(32).optional(),
  sessionTtlSeconds: z.coerce.number().default(28800),
  emailApiKey: z.string().optional(),
  emailFrom: z.string().default('SidClaw <notifications@sidclaw.com>'),
  dashboardUrl: z.string().default('http://localhost:3000'),
  rateLimitEnabled: z.string().default('true').transform(s => s === 'true'),
  // Stripe billing (optional — billing disabled if not set)
  stripeSecretKey: z.string().optional(),
  stripeStarterPriceId: z.string().optional(),
  stripeBusinessPriceId: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  // Platform admin
  superAdminKey: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse({
    port: process.env['PORT'],
    host: process.env['HOST'],
    environment: process.env['NODE_ENV'],
    databaseUrl: process.env['DATABASE_URL'],
    allowedOrigins: process.env['ALLOWED_ORIGINS'],
    oidcIssuer: process.env['OIDC_ISSUER'],
    oidcClientId: process.env['OIDC_CLIENT_ID'],
    oidcClientSecret: process.env['OIDC_CLIENT_SECRET'],
    oidcRedirectUri: process.env['OIDC_REDIRECT_URI'],
    githubClientId: process.env['GITHUB_CLIENT_ID'],
    githubClientSecret: process.env['GITHUB_CLIENT_SECRET'],
    githubRedirectUri: process.env['GITHUB_REDIRECT_URI'],
    googleClientId: process.env['GOOGLE_CLIENT_ID'],
    googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    googleRedirectUri: process.env['GOOGLE_REDIRECT_URI'],
    sessionSecret: process.env['SESSION_SECRET'],
    sessionTtlSeconds: process.env['SESSION_TTL_SECONDS'],
    emailApiKey: process.env['EMAIL_API_KEY'],
    emailFrom: process.env['EMAIL_FROM'],
    dashboardUrl: process.env['DASHBOARD_URL'],
    rateLimitEnabled: process.env['RATE_LIMIT_ENABLED'],
    stripeSecretKey: process.env['STRIPE_SECRET_KEY'],
    stripeStarterPriceId: process.env['STRIPE_STARTER_PRICE_ID'],
    stripeBusinessPriceId: process.env['STRIPE_BUSINESS_PRICE_ID'],
    stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
    superAdminKey: process.env['SUPER_ADMIN_KEY'],
  });

  if (!result.success) {
    console.error('Invalid configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  // OIDC is optional — warn if not configured in production
  if (result.data.environment === 'production' && !result.data.oidcIssuer) {
    console.warn('Warning: OIDC_ISSUER not set — OIDC login will be disabled');
  }

  return result.data;
}
