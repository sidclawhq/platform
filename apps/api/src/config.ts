import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().default(4000),
  host: z.string().default('0.0.0.0'),
  environment: z.enum(['development', 'test', 'production']).default('development'),
  databaseUrl: z.string().min(1, 'DATABASE_URL is required'),
  allowedOrigins: z.string().default('http://localhost:3000').transform(s => s.split(',')),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse({
    port: process.env['PORT'],
    host: process.env['HOST'],
    environment: process.env['NODE_ENV'],
    databaseUrl: process.env['DATABASE_URL'],
    allowedOrigins: process.env['ALLOWED_ORIGINS'],
  });

  if (!result.success) {
    console.error('Invalid configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}
