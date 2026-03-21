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
  sessionSecret: z.string().min(32).optional(),
  sessionTtlSeconds: z.coerce.number().default(28800),
  emailApiKey: z.string().optional(),
  emailFrom: z.string().default('Agent Identity <notifications@agentidentity.dev>'),
  dashboardUrl: z.string().default('http://localhost:3000'),
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
    sessionSecret: process.env['SESSION_SECRET'],
    sessionTtlSeconds: process.env['SESSION_TTL_SECONDS'],
    emailApiKey: process.env['EMAIL_API_KEY'],
    emailFrom: process.env['EMAIL_FROM'],
    dashboardUrl: process.env['DASHBOARD_URL'],
  });

  if (!result.success) {
    console.error('Invalid configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  // In production, validate OIDC config is present
  if (result.data.environment === 'production' && !result.data.oidcIssuer) {
    console.error('OIDC_ISSUER is required in production');
    process.exit(1);
  }

  return result.data;
}
