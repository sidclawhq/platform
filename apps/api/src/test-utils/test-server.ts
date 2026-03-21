import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { registerPlugins } from '../server-plugins.js';

const connectionString =
  process.env['DATABASE_URL'] ??
  'postgresql://agent_identity:agent_identity@localhost:5433/agent_identity_test';

let prisma: PrismaClient;
let app: FastifyInstance;

/**
 * Creates a test Fastify instance with a clean test database.
 * Call in beforeAll(). Returns the app and prisma client.
 */
export async function createTestServer(): Promise<{
  app: FastifyInstance;
  prisma: PrismaClient;
}> {
  // Ensure test database is migrated
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: 'pipe',
  });

  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter, log: [] });

  // Build the Fastify app with the same config as production
  app = Fastify({ logger: false });
  await registerPlugins(app);
  await app.ready();

  return { app, prisma };
}

/**
 * Cleans all data from the test database.
 * Call in beforeEach() or afterEach() for test isolation.
 */
export async function cleanDatabase(client: PrismaClient): Promise<void> {
  // Delete in reverse dependency order to respect foreign keys
  await client.webhookDelivery.deleteMany();
  await client.webhookEndpoint.deleteMany();
  await client.backgroundJob.deleteMany();
  await client.auditEvent.deleteMany();
  await client.approvalRequest.deleteMany();
  await client.auditTrace.deleteMany();
  // PolicyRuleVersion must be deleted before PolicyRule (FK constraint)
  await client.policyRuleVersion.deleteMany();
  await client.policyRule.deleteMany();
  await client.apiKey.deleteMany();
  await client.session.deleteMany();
  await client.agent.deleteMany();
  await client.user.deleteMany();
  await client.tenant.deleteMany();
}

/**
 * Seeds the test database with minimal data for testing.
 * Returns the created entities for use in assertions.
 */
export async function seedTestData(client: PrismaClient) {
  const tenant = await client.tenant.create({
    data: {
      id: 'test-tenant',
      name: 'Test Workspace',
      slug: 'test',
      plan: 'enterprise',
      settings: {
        default_approval_ttl_seconds: 86400,
        default_data_classification: 'internal',
        notification_email: null,
      },
      onboarding_state: {},
    },
  });

  const user = await client.user.create({
    data: {
      id: 'test-user',
      tenant_id: tenant.id,
      email: 'test@example.com',
      name: 'Test Admin',
      role: 'admin',
      auth_provider: 'email',
    },
  });

  const agent = await client.agent.create({
    data: {
      id: 'test-agent',
      tenant_id: tenant.id,
      name: 'Test Agent',
      description: 'Agent for integration tests',
      owner_name: 'Test Owner',
      owner_role: 'Test Role',
      team: 'Test Team',
      environment: 'test',
      authority_model: 'self',
      identity_mode: 'service_identity',
      delegation_model: 'self',
      autonomy_tier: 'low',
      lifecycle_state: 'active',
      authorized_integrations: [],
      created_by: 'test-setup',
    },
  });

  // Create an API key for authenticated requests
  const rawKey = 'ai_test_' + randomBytes(16).toString('hex');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await client.apiKey.create({
    data: {
      id: 'test-apikey',
      tenant_id: tenant.id,
      name: 'Test Key',
      key_prefix: rawKey.substring(0, 12),
      key_hash: keyHash,
      scopes: ['evaluate', 'traces:read', 'traces:write', 'approvals:read'],
    },
  });

  return { tenant, user, agent, apiKey, rawApiKey: rawKey };
}

/**
 * Tears down the test server and database connection.
 * Call in afterAll().
 */
export async function destroyTestServer(): Promise<void> {
  if (app) await app.close();
  if (prisma) await prisma.$disconnect();
}
