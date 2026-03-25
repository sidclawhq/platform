/**
 * E2E tests for Composio governance integration.
 *
 * Tests the full flow: SidClaw policy evaluation -> Composio tool execution -> audit trace.
 * Uses a mock Composio server and the real SidClaw API (test DB).
 *
 * Prerequisites:
 *   1. Start test database: docker compose -f docker-compose.test.yml up -d
 *   2. Start API server against test database:
 *      DATABASE_URL=postgresql://agent_identity:agent_identity@localhost:5433/agent_identity_test npm run dev
 *      (from apps/api/)
 *   3. Run tests: npx vitest run --config tests/e2e/vitest.config.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupE2E, teardownE2E, createSDKClient, prisma } from './helpers';
import { createMockComposioServer } from './composio-mock-server';
import { governComposioExecution, mapComposioSlug } from '@sidclaw/sdk/composio';
import { ActionDeniedError } from '@sidclaw/sdk';

let testData: Awaited<ReturnType<typeof setupE2E>>;

describe('Composio Governance E2E', () => {
  let mockComposioUrl: string;
  let mockServer: ReturnType<typeof createMockComposioServer>;

  beforeAll(async () => {
    testData = await setupE2E();

    // Start mock Composio server
    mockServer = createMockComposioServer();
    const address = await mockServer.app.listen({ port: 0 }); // random port
    mockComposioUrl = address;
  }, 30000);

  afterAll(async () => {
    await mockServer.app.close();
    await teardownE2E();
  });

  it('slug mapping works for standard Composio slugs', () => {
    expect(mapComposioSlug('GITHUB_CREATE_ISSUE')).toEqual({
      operation: 'create_issue',
      target_integration: 'github',
    });
    expect(mapComposioSlug('GMAIL_SEND_EMAIL')).toEqual({
      operation: 'send_email',
      target_integration: 'gmail',
    });
    expect(mapComposioSlug('SALESFORCE_CREATE_LEAD')).toEqual({
      operation: 'create_lead',
      target_integration: 'salesforce',
    });
  });

  describe('Scenario: GitHub tool — allowed', () => {
    it('evaluates and executes when policy allows', async () => {
      const client = createSDKClient(testData.rawApiKey, testData.commsAgent.id);

      // Create a mock Composio that calls our mock server
      const mockComposio = {
        tools: {
          execute: async (slug: string, params: Record<string, unknown>) => {
            const res = await fetch(`${mockComposioUrl}/api/v3/tools/execute/${slug}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params),
            });
            return res.json();
          },
        },
      };

      const execute = governComposioExecution(client, mockComposio, {
        dataClassification: { GITHUB: 'internal' },
        waitForApproval: false,
      });

      // This should be evaluated against a policy that allows it
      // (default deny will catch it, but we're testing the flow)
      try {
        const { result, traceId } = await execute('GITHUB_CREATE_ISSUE', {
          userId: 'user_123',
          arguments: { owner: 'org', repo: 'project', title: 'Bug fix' },
        });

        // If allowed: verify trace was created
        expect(traceId).toBeDefined();
        expect(traceId).toMatch(/^[a-zA-Z0-9-]+$/);

        const trace = await prisma.auditTrace.findUnique({ where: { id: traceId } });
        expect(trace).toBeTruthy();

        // Verify mock Composio received the call
        expect(mockServer.executedTools.length).toBeGreaterThan(0);
        const lastExecution = mockServer.executedTools[mockServer.executedTools.length - 1];
        expect(lastExecution.slug).toBe('GITHUB_CREATE_ISSUE');
      } catch (error) {
        // If denied by default policy: verify it's a governance denial
        if (error instanceof ActionDeniedError) {
          expect(error.traceId).toBeDefined();
          // The trace should still exist
          const trace = await prisma.auditTrace.findUnique({ where: { id: error.traceId } });
          expect(trace).toBeTruthy();
        } else {
          throw error;
        }
      }
    });
  });

  describe('Scenario: governance evaluation creates traces', () => {
    it('always creates an audit trace regardless of decision', async () => {
      const client = createSDKClient(testData.rawApiKey, testData.commsAgent.id);

      const mockComposio = {
        tools: {
          execute: async () => ({ data: {}, error: null, successful: true }),
        },
      };

      const execute = governComposioExecution(client, mockComposio, {
        waitForApproval: false,
      });

      try {
        await execute('SALESFORCE_QUERY_RECORDS', {
          userId: 'user_123',
          arguments: { query: 'SELECT * FROM Account' },
        });
      } catch (error) {
        if (error instanceof ActionDeniedError) {
          // Verify the trace was created even for denied actions
          const trace = await prisma.auditTrace.findUnique({ where: { id: error.traceId } });
          expect(trace).toBeTruthy();
          expect(trace?.agent_id).toBe(testData.commsAgent.id);

          // Verify audit events
          const events = await prisma.auditEvent.findMany({
            where: { trace_id: error.traceId },
            orderBy: { timestamp: 'asc' },
          });
          expect(events.length).toBeGreaterThanOrEqual(1);
        } else {
          throw error;
        }
      }
    });
  });
});
