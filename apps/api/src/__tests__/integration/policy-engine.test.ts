import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PolicyEngine } from '../../services/policy-engine';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server';
import type { PrismaClient } from '../../generated/prisma/index.js';

let prisma: PrismaClient;
let engine: PolicyEngine;
let testData: Awaited<ReturnType<typeof seedTestData>>;

describe('PolicyEngine (integration)', () => {
  beforeAll(async () => {
    const server = await createTestServer();
    prisma = server.prisma;
  });

  afterAll(async () => {
    await destroyTestServer();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
    engine = new PolicyEngine(prisma);
  });

  describe('with seeded policies', () => {
    beforeEach(async () => {
      // Create a policy rule that matches send + communications_service -> approval_required
      await prisma.policyRule.create({
        data: {
          id: 'pol-test-001',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Test approval policy',
          target_integration: 'communications_service',
          operation: 'send',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
          policy_effect: 'approval_required',
          rationale: 'Requires human review',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });

      // Create a policy rule that matches read + document_store -> allow
      await prisma.policyRule.create({
        data: {
          id: 'pol-test-002',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Test allow policy',
          target_integration: 'document_store',
          operation: 'read',
          resource_scope: '*',
          data_classification: 'internal',
          policy_effect: 'allow',
          rationale: 'Read access permitted',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });

      // Create a policy rule that matches export + crm_platform -> deny
      await prisma.policyRule.create({
        data: {
          id: 'pol-test-003',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Test deny policy',
          target_integration: 'crm_platform',
          operation: 'export',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
          policy_effect: 'deny',
          rationale: 'PII export prohibited',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });
    });

    it('returns approval_required for send on communications_service', async () => {
      const result = await engine.evaluate(testData.agent.id, {
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      });
      expect(result.effect).toBe('approval_required');
      expect(result.rule_id).toBe('pol-test-001');
      expect(result.rationale).toBe('Requires human review');
    });

    it('returns allow for read on document_store', async () => {
      const result = await engine.evaluate(testData.agent.id, {
        operation: 'read',
        target_integration: 'document_store',
        resource_scope: 'internal_docs',
        data_classification: 'internal',
      });
      expect(result.effect).toBe('allow');
      expect(result.rule_id).toBe('pol-test-002');
    });

    it('returns deny for export on crm_platform', async () => {
      const result = await engine.evaluate(testData.agent.id, {
        operation: 'export',
        target_integration: 'crm_platform',
        resource_scope: 'customer_pii_records',
        data_classification: 'restricted',
      });
      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBe('pol-test-003');
    });

    it('returns default deny for an unmatched action', async () => {
      const result = await engine.evaluate(testData.agent.id, {
        operation: 'delete',
        target_integration: 'unknown_service',
        resource_scope: 'anything',
        data_classification: 'public',
      });
      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });

    it('denies suspended agent without checking policies', async () => {
      await prisma.agent.update({
        where: { id: testData.agent.id },
        data: { lifecycle_state: 'suspended' },
      });

      const result = await engine.evaluate(testData.agent.id, {
        operation: 'read',
        target_integration: 'document_store',
        resource_scope: 'internal_docs',
        data_classification: 'internal',
      });
      expect(result.effect).toBe('deny');
      expect(result.rationale).toContain('suspended');
    });

    it('evaluates in under 10ms', async () => {
      const start = Date.now();
      await engine.evaluate(testData.agent.id, {
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      });
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10);
    });

    it('ignores inactive policy rules', async () => {
      await prisma.policyRule.update({
        where: { id: 'pol-test-002' },
        data: { is_active: false },
      });

      const result = await engine.evaluate(testData.agent.id, {
        operation: 'read',
        target_integration: 'document_store',
        resource_scope: 'internal_docs',
        data_classification: 'internal',
      });
      expect(result.effect).toBe('deny'); // default deny, because the matching rule is now inactive
      expect(result.rule_id).toBeNull();
    });
  });
});
