import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PolicyEngine } from './policy-engine';

// Helper to create a mock prisma client with proper typing
function mockPrisma(overrides: {
  agent?: { lifecycle_state: string; name: string } | null;
  rules?: Array<{
    id: string;
    operation: string;
    target_integration: string;
    resource_scope: string;
    data_classification: string;
    policy_effect: string;
    rationale: string;
    priority: number;
    policy_version: number;
  }>;
}) {
  const mock = {
    agent: {
      findFirst: vi.fn().mockResolvedValue('agent' in overrides ? overrides.agent : { lifecycle_state: 'active', name: 'Test Agent' }),
    },
    policyRule: {
      findMany: vi.fn().mockResolvedValue(overrides.rules ?? []),
    },
  };
  // PolicyEngine constructor expects PrismaClient; we pass a minimal mock
  return mock as unknown as ConstructorParameters<typeof PolicyEngine>[0];
}

const baseAction = {
  operation: 'read',
  target_integration: 'document_store',
  resource_scope: 'internal_docs',
  data_classification: 'internal' as const,
};

function makeRule(overrides: Partial<{
  id: string;
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  policy_effect: string;
  rationale: string;
  priority: number;
  policy_version: number;
}> = {}) {
  return {
    id: 'rule-1',
    operation: 'read',
    target_integration: 'document_store',
    resource_scope: 'internal_docs',
    data_classification: 'internal',
    policy_effect: 'allow',
    rationale: 'Allowed by policy',
    priority: 100,
    policy_version: 1,
    ...overrides,
  };
}

describe('PolicyEngine', () => {
  describe('lifecycle checks', () => {
    it('denies if agent is not found', async () => {
      const prisma = mockPrisma({ agent: null });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('nonexistent', baseAction);

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
      expect(result.rationale).toContain('not found');
      expect(result.policy_version).toBeNull();
    });

    it('denies if agent is suspended', async () => {
      const prisma = mockPrisma({ agent: { lifecycle_state: 'suspended', name: 'Suspended Agent' } });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
      expect(result.rationale).toContain('suspended');
      expect(result.policy_version).toBeNull();
    });

    it('denies if agent is revoked', async () => {
      const prisma = mockPrisma({ agent: { lifecycle_state: 'revoked', name: 'Revoked Agent' } });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
      expect(result.rationale).toContain('revoked');
      expect(result.policy_version).toBeNull();
    });

    it('proceeds to policy evaluation if agent is active', async () => {
      const rule = makeRule();
      const prisma = mockPrisma({
        agent: { lifecycle_state: 'active', name: 'Active Agent' },
        rules: [rule],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('allow');
      expect(result.rule_id).toBe('rule-1');
    });
  });

  describe('rule matching — operation', () => {
    it('matches when operation is exactly equal', async () => {
      const prisma = mockPrisma({ rules: [makeRule({ operation: 'read' })] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', { ...baseAction, operation: 'read' });

      expect(result.effect).toBe('allow');
      expect(result.rule_id).toBe('rule-1');
    });

    it('does not match when operation differs', async () => {
      const prisma = mockPrisma({ rules: [makeRule({ operation: 'write' })] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', { ...baseAction, operation: 'read' });

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });
  });

  describe('rule matching — target_integration', () => {
    it('matches when target_integration is exactly equal', async () => {
      const prisma = mockPrisma({ rules: [makeRule({ target_integration: 'document_store' })] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', { ...baseAction, target_integration: 'document_store' });

      expect(result.effect).toBe('allow');
      expect(result.rule_id).toBe('rule-1');
    });

    it('does not match when target_integration differs', async () => {
      const prisma = mockPrisma({ rules: [makeRule({ target_integration: 'crm_platform' })] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', { ...baseAction, target_integration: 'document_store' });

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });
  });

  describe('rule matching — resource_scope', () => {
    it('matches when resource_scope is exactly equal', async () => {
      const prisma = mockPrisma({ rules: [makeRule({ resource_scope: 'internal_docs' })] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', { ...baseAction, resource_scope: 'internal_docs' });

      expect(result.effect).toBe('allow');
      expect(result.rule_id).toBe('rule-1');
    });

    it('matches when rule resource_scope is wildcard *', async () => {
      const prisma = mockPrisma({ rules: [makeRule({ resource_scope: '*' })] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', { ...baseAction, resource_scope: 'any_scope' });

      expect(result.effect).toBe('allow');
      expect(result.rule_id).toBe('rule-1');
    });

    it('does not match when resource_scope differs and rule is not wildcard', async () => {
      const prisma = mockPrisma({ rules: [makeRule({ resource_scope: 'other_docs' })] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', { ...baseAction, resource_scope: 'internal_docs' });

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });
  });

  describe('rule matching — data classification hierarchy', () => {
    // Helper: create engine with a single rule at a given classification, test against an action classification
    async function testClassification(ruleClassification: string, actionClassification: string) {
      const prisma = mockPrisma({
        rules: [makeRule({ data_classification: ruleClassification })],
      });
      const engine = new PolicyEngine(prisma);
      return engine.evaluate('agent-1', {
        ...baseAction,
        data_classification: actionClassification as 'public' | 'internal' | 'confidential' | 'restricted',
      });
    }

    it('rule for restricted matches action with restricted', async () => {
      const result = await testClassification('restricted', 'restricted');
      expect(result.effect).toBe('allow');
    });

    it('rule for restricted matches action with confidential', async () => {
      const result = await testClassification('restricted', 'confidential');
      expect(result.effect).toBe('allow');
    });

    it('rule for restricted matches action with internal', async () => {
      const result = await testClassification('restricted', 'internal');
      expect(result.effect).toBe('allow');
    });

    it('rule for restricted matches action with public', async () => {
      const result = await testClassification('restricted', 'public');
      expect(result.effect).toBe('allow');
    });

    it('rule for confidential matches action with confidential', async () => {
      const result = await testClassification('confidential', 'confidential');
      expect(result.effect).toBe('allow');
    });

    it('rule for confidential matches action with internal', async () => {
      const result = await testClassification('confidential', 'internal');
      expect(result.effect).toBe('allow');
    });

    it('rule for confidential matches action with public', async () => {
      const result = await testClassification('confidential', 'public');
      expect(result.effect).toBe('allow');
    });

    it('rule for confidential does NOT match action with restricted', async () => {
      const result = await testClassification('confidential', 'restricted');
      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });

    it('rule for internal matches action with internal', async () => {
      const result = await testClassification('internal', 'internal');
      expect(result.effect).toBe('allow');
    });

    it('rule for internal matches action with public', async () => {
      const result = await testClassification('internal', 'public');
      expect(result.effect).toBe('allow');
    });

    it('rule for internal does NOT match action with confidential', async () => {
      const result = await testClassification('internal', 'confidential');
      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });

    it('rule for public matches action with public only', async () => {
      const result = await testClassification('public', 'public');
      expect(result.effect).toBe('allow');
    });

    it('rule for public does NOT match action with internal', async () => {
      const result = await testClassification('public', 'internal');
      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });
  });

  describe('priority ordering', () => {
    it('returns the highest-priority matching rule', async () => {
      const prisma = mockPrisma({
        rules: [
          makeRule({ id: 'high', priority: 200, policy_effect: 'allow', rationale: 'High priority' }),
          makeRule({ id: 'low', priority: 50, policy_effect: 'deny', rationale: 'Low priority' }),
        ],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.rule_id).toBe('high');
      expect(result.effect).toBe('allow');
    });

    it('with two rules at same priority, returns the first match', async () => {
      const prisma = mockPrisma({
        rules: [
          makeRule({ id: 'first', priority: 100, policy_effect: 'allow', rationale: 'First' }),
          makeRule({ id: 'second', priority: 100, policy_effect: 'deny', rationale: 'Second' }),
        ],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.rule_id).toBe('first');
      expect(result.effect).toBe('allow');
    });

    it('a lower-priority allow does not override a higher-priority deny', async () => {
      const prisma = mockPrisma({
        rules: [
          makeRule({ id: 'deny-high', priority: 200, policy_effect: 'deny', rationale: 'Denied' }),
          makeRule({ id: 'allow-low', priority: 50, policy_effect: 'allow', rationale: 'Allowed' }),
        ],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBe('deny-high');
    });

    it('a higher-priority allow overrides a lower-priority deny', async () => {
      const prisma = mockPrisma({
        rules: [
          makeRule({ id: 'allow-high', priority: 200, policy_effect: 'allow', rationale: 'Allowed' }),
          makeRule({ id: 'deny-low', priority: 50, policy_effect: 'deny', rationale: 'Denied' }),
        ],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('allow');
      expect(result.rule_id).toBe('allow-high');
    });
  });

  describe('default deny', () => {
    it('returns deny with null rule_id when no rules match', async () => {
      const prisma = mockPrisma({
        rules: [makeRule({ operation: 'write' })], // won't match 'read'
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });

    it('returns deny when agent has no policy rules at all', async () => {
      const prisma = mockPrisma({ rules: [] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('deny');
      expect(result.rule_id).toBeNull();
    });

    it('includes explanatory rationale in default deny', async () => {
      const prisma = mockPrisma({ rules: [] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.rationale).toContain('No policy rule matches');
      expect(result.rationale).toContain('secure by default');
    });
  });

  describe('policy effects', () => {
    it('returns allow effect when matching rule is allow', async () => {
      const prisma = mockPrisma({ rules: [makeRule({ policy_effect: 'allow' })] });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('allow');
    });

    it('returns approval_required when matching rule is approval_required', async () => {
      const prisma = mockPrisma({
        rules: [makeRule({ policy_effect: 'approval_required', rationale: 'Needs review' })],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('approval_required');
    });

    it('returns deny when matching rule is deny', async () => {
      const prisma = mockPrisma({
        rules: [makeRule({ policy_effect: 'deny', rationale: 'Prohibited' })],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.effect).toBe('deny');
    });

    it('returns the rationale from the matched rule', async () => {
      const prisma = mockPrisma({
        rules: [makeRule({ rationale: 'Custom rationale for this policy' })],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.rationale).toBe('Custom rationale for this policy');
    });

    it('returns the policy_version from the matched rule', async () => {
      const prisma = mockPrisma({
        rules: [makeRule({ policy_version: 3 })],
      });
      const engine = new PolicyEngine(prisma);
      const result = await engine.evaluate('agent-1', baseAction);

      expect(result.policy_version).toBe(3);
    });
  });

  describe('performance', () => {
    it('evaluation completes in under 10ms (mocked DB)', async () => {
      const prisma = mockPrisma({
        rules: [makeRule()],
      });
      const engine = new PolicyEngine(prisma);

      const start = performance.now();
      await engine.evaluate('agent-1', baseAction);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });
});
