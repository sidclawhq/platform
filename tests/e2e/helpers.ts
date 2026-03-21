import { AgentIdentityClient } from '@sidclaw/sdk';
import { PrismaClient } from '../../apps/api/src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_API_URL = process.env.TEST_API_URL ?? 'http://localhost:4000';
const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgresql://agent_identity:agent_identity@localhost:5433/agent_identity_test';

let prisma: PrismaClient;

export async function setupE2E() {
  const adapter = new PrismaPg({ connectionString: TEST_DB_URL });
  prisma = new PrismaClient({ adapter, log: [] });

  // Run migrations
  const apiDir = path.resolve(__dirname, '../../apps/api');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: apiDir,
    stdio: 'pipe',
  });

  // Clean and seed
  await cleanAll();
  return seedE2EData();
}

export async function cleanAll() {
  await prisma.auditEvent.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.auditTrace.deleteMany();
  await prisma.policyRule.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

export async function seedE2EData() {
  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      id: 'e2e-tenant',
      name: 'E2E Test Workspace',
      slug: 'e2e-test',
      plan: 'enterprise',
      settings: {
        default_approval_ttl_seconds: 86400,
        default_data_classification: 'internal',
        notification_email: null,
      },
    },
  });

  // Create admin user
  const user = await prisma.user.create({
    data: {
      id: 'e2e-user',
      tenant_id: tenant.id,
      email: 'e2e@example.com',
      name: 'E2E Admin',
      role: 'admin',
      auth_provider: 'email',
    },
  });

  // Create API key
  const rawKey = 'ai_e2e_' + randomBytes(16).toString('hex');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  await prisma.apiKey.create({
    data: {
      id: 'e2e-apikey',
      tenant_id: tenant.id,
      name: 'E2E Test Key',
      key_prefix: rawKey.substring(0, 12),
      key_hash: keyHash,
      scopes: ['evaluate', 'traces:read', 'traces:write', 'approvals:read'],
    },
  });

  // Create 3 agents matching the product scenarios
  const commsAgent = await prisma.agent.create({
    data: {
      id: 'e2e-agent-comms',
      tenant_id: tenant.id,
      name: 'Customer Communications Agent',
      description: 'Drafts and routes outbound customer communications',
      owner_name: 'Sarah Chen',
      owner_role: 'Communications Lead',
      team: 'Customer Operations',
      environment: 'prod',
      authority_model: 'hybrid',
      identity_mode: 'hybrid_identity',
      delegation_model: 'on_behalf_of_owner',
      autonomy_tier: 'high',
      lifecycle_state: 'active',
      authorized_integrations: [
        { name: 'Communications Service', resource_scope: 'customer_emails', data_classification: 'confidential', allowed_operations: ['draft', 'send'] },
        { name: 'CRM Platform', resource_scope: 'customer_records', data_classification: 'confidential', allowed_operations: ['read'] },
      ],
      created_by: 'e2e-setup',
    },
  });

  const knowledgeAgent = await prisma.agent.create({
    data: {
      id: 'e2e-agent-knowledge',
      tenant_id: tenant.id,
      name: 'Internal Knowledge Retrieval Agent',
      description: 'Retrieves and summarises internal documents',
      owner_name: 'David Kim',
      owner_role: 'Knowledge Systems Manager',
      team: 'Enterprise Architecture',
      environment: 'prod',
      authority_model: 'self',
      identity_mode: 'service_identity',
      delegation_model: 'self',
      autonomy_tier: 'low',
      lifecycle_state: 'active',
      authorized_integrations: [
        { name: 'Document Store', resource_scope: 'internal_docs', data_classification: 'internal', allowed_operations: ['read', 'summarize'] },
      ],
      created_by: 'e2e-setup',
    },
  });

  const caseAgent = await prisma.agent.create({
    data: {
      id: 'e2e-agent-case',
      tenant_id: tenant.id,
      name: 'Case Operations Agent',
      description: 'Manages internal case records',
      owner_name: 'Rachel Torres',
      owner_role: 'Operations Director',
      team: 'Case Management',
      environment: 'prod',
      authority_model: 'delegated',
      identity_mode: 'delegated_identity',
      delegation_model: 'on_behalf_of_user',
      autonomy_tier: 'medium',
      lifecycle_state: 'active',
      authorized_integrations: [
        { name: 'Case Management System', resource_scope: 'active_cases', data_classification: 'confidential', allowed_operations: ['read', 'update', 'close'] },
      ],
      created_by: 'e2e-setup',
    },
  });

  // Create policy rules for the 4 scenarios
  // Scenario 1: send on communications_service → approval_required
  await prisma.policyRule.create({
    data: {
      id: 'e2e-pol-001',
      tenant_id: tenant.id,
      agent_id: commsAgent.id,
      policy_name: 'Outbound customer email review',
      target_integration: 'communications_service',
      operation: 'send',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Outbound communication involving regulated customer context requires human review before release.',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'e2e-setup',
    },
  });

  // Scenario 3: read on document_store → allow
  await prisma.policyRule.create({
    data: {
      id: 'e2e-pol-002',
      tenant_id: tenant.id,
      agent_id: knowledgeAgent.id,
      policy_name: 'Retrieve internal knowledge base',
      target_integration: 'document_store',
      operation: 'read',
      resource_scope: '*',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Read access to internal knowledge base is within standard operational scope.',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'e2e-setup',
    },
  });

  // Scenario 4: export on crm_platform → deny
  await prisma.policyRule.create({
    data: {
      id: 'e2e-pol-003',
      tenant_id: tenant.id,
      agent_id: commsAgent.id,
      policy_name: 'Access restricted customer PII',
      target_integration: 'crm_platform',
      operation: 'export',
      resource_scope: 'customer_pii_records',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Direct export of restricted PII is prohibited under data protection policy.',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'e2e-setup',
    },
  });

  // Scenario 2: close on case_management_system → approval_required
  await prisma.policyRule.create({
    data: {
      id: 'e2e-pol-004',
      tenant_id: tenant.id,
      agent_id: caseAgent.id,
      policy_name: 'Close case with financial impact',
      target_integration: 'case_management_system',
      operation: 'close',
      resource_scope: 'high_impact_cases',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Closing a case with financial impact requires human review under operational risk policy.',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'e2e-setup',
    },
  });

  return {
    tenant,
    user,
    rawApiKey: rawKey,
    commsAgent,
    knowledgeAgent,
    caseAgent,
    prisma,
  };
}

export function createSDKClient(apiKey: string, agentId: string) {
  return new AgentIdentityClient({
    apiKey,
    apiUrl: TEST_API_URL,
    agentId,
    maxRetries: 0, // No retries in tests for faster failure
  });
}

export async function teardownE2E() {
  if (prisma) await prisma.$disconnect();
}

export { prisma };
