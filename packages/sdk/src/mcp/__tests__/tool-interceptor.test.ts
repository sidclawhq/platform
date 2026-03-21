import { describe, it, expect, vi } from 'vitest';
import { interceptToolCall } from '../tool-interceptor.js';
import type { GovernanceMCPServerConfig } from '../config.js';
import type { AgentIdentityClient } from '../../client/agent-identity-client.js';

function createMockClient(overrides: Record<string, unknown> = {}): AgentIdentityClient {
  return {
    evaluate: vi.fn(),
    waitForApproval: vi.fn(),
    recordOutcome: vi.fn(),
    ...overrides,
  } as unknown as AgentIdentityClient;
}

function createConfig(overrides: Partial<GovernanceMCPServerConfig> = {}): GovernanceMCPServerConfig {
  return {
    client: createMockClient(),
    upstream: { transport: 'stdio', command: 'node', args: ['server.js'] },
    ...overrides,
  };
}

describe('interceptToolCall', () => {
  it('returns forward action when policy allows', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-001',
        reason: 'Policy allows',
        policy_rule_id: 'rule-1',
      }),
    });
    const config = createConfig({ client });

    const result = await interceptToolCall('read_file', { path: '/tmp' }, client, config, 'test-server');

    expect(result.action).toBe('forward');
    expect(result.traceId).toBe('TR-001');
    expect(result.error).toBeUndefined();
  });

  it('returns error with structured data when policy denies', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'deny',
        trace_id: 'TR-002',
        reason: 'Blocked by policy',
        policy_rule_id: 'rule-2',
      }),
    });
    const config = createConfig({ client });

    const result = await interceptToolCall('delete_all', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.traceId).toBe('TR-002');
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe(-32001);
    expect(result.error!.message).toContain('Blocked by policy');
    expect(result.error!.data).toMatchObject({
      type: 'action_denied',
      trace_id: 'TR-002',
      reason: 'Blocked by policy',
      policy_rule_id: 'rule-2',
    });
  });

  it('returns error with approval_request_id when approval_required (error mode)', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-003',
        reason: 'Needs approval',
        policy_rule_id: 'rule-3',
        approval_request_id: 'apr-001',
      }),
    });
    const config = createConfig({ client, approvalWaitMode: 'error' });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.error!.message).toContain('Approval required');
    expect(result.error!.data).toMatchObject({
      type: 'approval_required',
      trace_id: 'TR-003',
      approval_request_id: 'apr-001',
      reason: 'Needs approval',
    });
    // Must NOT call waitForApproval in error mode
    expect(client.waitForApproval).not.toHaveBeenCalled();
  });

  it('defaults to error mode when approvalWaitMode is not set', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-003b',
        reason: 'Needs approval',
        policy_rule_id: 'rule-3b',
        approval_request_id: 'apr-001b',
      }),
    });
    const config = createConfig({ client });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.error!.data).toMatchObject({
      type: 'approval_required',
      approval_request_id: 'apr-001b',
    });
    expect(client.waitForApproval).not.toHaveBeenCalled();
  });

  it('blocks and returns forward when approval granted (block mode)', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-004',
        reason: 'Needs approval',
        policy_rule_id: 'rule-4',
        approval_request_id: 'apr-002',
      }),
      waitForApproval: vi.fn().mockResolvedValue({
        id: 'apr-002',
        status: 'approved',
        decided_at: '2026-03-21T00:00:00Z',
        approver_name: 'admin',
        decision_note: 'Looks good',
      }),
    });
    const config = createConfig({ client, approvalWaitMode: 'block', approvalBlockTimeoutMs: 5000 });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('forward');
    expect(result.traceId).toBe('TR-004');
    expect(client.waitForApproval).toHaveBeenCalledWith('apr-002', {
      timeout: 5000,
      pollInterval: 1000,
    });
  });

  it('blocks and returns error when approval denied (block mode)', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-005',
        reason: 'Needs approval',
        policy_rule_id: 'rule-5',
        approval_request_id: 'apr-003',
      }),
      waitForApproval: vi.fn().mockResolvedValue({
        id: 'apr-003',
        status: 'denied',
        decided_at: '2026-03-21T00:00:00Z',
        approver_name: 'admin',
        decision_note: 'Too risky',
      }),
    });
    const config = createConfig({ client, approvalWaitMode: 'block' });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.error!.message).toContain('denied');
    expect(result.error!.message).toContain('Too risky');
    expect(result.error!.data).toMatchObject({
      type: 'approval_denied',
      trace_id: 'TR-005',
      approval_request_id: 'apr-003',
    });
  });

  it('blocks and returns timeout error when approval times out (block mode)', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-006',
        reason: 'Needs approval',
        policy_rule_id: 'rule-6',
        approval_request_id: 'apr-004',
      }),
      waitForApproval: vi.fn().mockRejectedValue(new Error('Timeout')),
    });
    const config = createConfig({ client, approvalWaitMode: 'block', approvalBlockTimeoutMs: 1000 });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.error!.message).toContain('timed out');
    expect(result.error!.data).toMatchObject({
      type: 'approval_required',
      trace_id: 'TR-006',
      approval_request_id: 'apr-004',
      reason: 'Needs approval',
    });
  });

  it('skips governance for tools with skip_governance mapping', async () => {
    const client = createMockClient();
    const config = createConfig({
      client,
      toolMappings: [{ toolName: 'list_tables', skip_governance: true }],
    });

    const result = await interceptToolCall('list_tables', {}, client, config, 'test-server');

    expect(result.action).toBe('forward');
    expect(result.traceId).toBeUndefined();
    expect(client.evaluate).not.toHaveBeenCalled();
  });

  it('uses tool mapping overrides for operation/integration/scope/classification', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-007',
        reason: 'OK',
        policy_rule_id: 'rule-7',
      }),
    });
    const config = createConfig({
      client,
      toolMappings: [{
        toolName: 'query',
        operation: 'database_query',
        target_integration: 'postgres',
        resource_scope: 'production_db',
        data_classification: 'confidential',
      }],
    });

    await interceptToolCall('query', { sql: 'SELECT 1' }, client, config, 'test-server');

    expect(client.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'database_query',
      target_integration: 'postgres',
      resource_scope: 'production_db',
      data_classification: 'confidential',
    }));
  });

  it('falls back to defaults when no mapping exists', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-008',
        reason: 'OK',
        policy_rule_id: 'rule-8',
      }),
    });
    const config = createConfig({
      client,
      defaultDataClassification: 'public',
      defaultResourceScope: 'default-scope',
    });

    await interceptToolCall('some_tool', {}, client, config, 'my-server');

    expect(client.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'some_tool',
      target_integration: 'my-server',
      resource_scope: 'default-scope', // uses config default before falling back to tool name
      data_classification: 'public',
    }));
  });

  it('includes mcp_tool and mcp_args in evaluation context', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-009',
        reason: 'OK',
        policy_rule_id: 'rule-9',
      }),
    });
    const config = createConfig({ client });
    const args = { path: '/tmp/file.txt' };

    await interceptToolCall('read_file', args, client, config, 'fs-server');

    expect(client.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      context: { mcp_tool: 'read_file', mcp_args: args, mcp_server: 'fs-server' },
    }));
  });
});
