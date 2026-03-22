// Seed data constants — matching apps/api/prisma/seed.ts

export const SEED_AGENTS = {
  CUSTOMER_COMMUNICATIONS: {
    id: 'agent-001',
    name: 'Customer Communications Agent',
    owner: 'Sarah Chen',
    environment: 'prod',
    authority_model: 'hybrid',
  },
  KNOWLEDGE_RETRIEVAL: {
    id: 'agent-002',
    name: 'Internal Knowledge Retrieval Agent',
    owner: 'David Kim',
    environment: 'prod',
    authority_model: 'self',
  },
  CASE_OPERATIONS: {
    id: 'agent-003',
    name: 'Case Operations Agent',
    owner: 'Rachel Torres',
    environment: 'prod',
    authority_model: 'delegated',
  },
};

export const SEED_TENANT = {
  id: 'tenant-default',
  name: 'Development Workspace',
  plan: 'enterprise',
};

export const SEED_USER = {
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
};

export const TEST_USER = {
  name: 'E2E Admin',
  email: `e2e-admin-${Date.now()}@test.com`,
  password: 'E2ETest2026!',
};
