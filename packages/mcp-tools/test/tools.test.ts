import { describe, it, expect, vi } from 'vitest';
import { handleToolCall } from '../src/tools';
import { SidClawClient } from '../src/client';

function mockClient(overrides: Partial<SidClawClient> = {}): SidClawClient {
  const base: Partial<SidClawClient> = {
    evaluate: vi.fn(async () => ({
      decision: 'allow',
      trace_id: 'trace-1',
      approval_request_id: null,
      reason: 'matched allow policy',
      policy_rule_id: 'pol-1',
    })),
    recordOutcome: vi.fn(async () => undefined),
    waitForApproval: vi.fn(async () => ({ status: 'approved' })),
    listPolicies: vi.fn(async () => ({ data: [] })),
    listTraces: vi.fn(async () => ({ data: [] })),
    health: vi.fn(async () => ({ status: 'healthy' })),
  };
  return { ...base, ...overrides } as SidClawClient;
}

describe('handleToolCall', () => {
  it('evaluates a well-formed request', async () => {
    const client = mockClient();
    const result = await handleToolCall(client, 'claude-code', 'sidclaw_evaluate', {
      operation: 'bash.destructive',
      target_integration: 'claude_code',
      resource_scope: 'rm -rf /tmp',
      data_classification: 'restricted',
      declared_goal: 'clean tmp',
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('"decision": "allow"');
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: 'claude-code',
        operation: 'bash.destructive',
        context: expect.objectContaining({ declared_goal: 'clean tmp' }),
      }),
    );
  });

  it('rejects evaluate missing required fields', async () => {
    const client = mockClient();
    const result = await handleToolCall(client, 'claude-code', 'sidclaw_evaluate', {
      operation: 'do-stuff',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('target_integration');
  });

  it('records an outcome with all telemetry fields', async () => {
    const client = mockClient();
    const result = await handleToolCall(client, 'claude-code', 'sidclaw_record', {
      trace_id: 'trace-1',
      status: 'success',
      tokens_in: 1000,
      tokens_out: 250,
      model: 'claude-sonnet-4-6',
      cost_estimate: 0.005,
    });
    expect(result.isError).toBeUndefined();
    expect(client.recordOutcome).toHaveBeenCalledWith(
      'trace-1',
      expect.objectContaining({
        status: 'success',
        tokens_in: 1000,
        model: 'claude-sonnet-4-6',
      }),
    );
  });

  it('waits for approval', async () => {
    const client = mockClient({
      waitForApproval: vi.fn(async () => ({ status: 'approved', approver_name: 'Alice' })),
    });
    const result = await handleToolCall(client, 'claude-code', 'sidclaw_approve', {
      approval_id: 'approval-1',
      timeout_seconds: 10,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('approved');
    expect(client.waitForApproval).toHaveBeenCalledWith('approval-1', 10, 3);
  });

  it('lists policies filtered by agent', async () => {
    const client = mockClient({
      listPolicies: vi.fn(async () => ({ data: [{ id: 'p1' }] })),
    });
    await handleToolCall(client, 'claude-code', 'sidclaw_policies', { agent_id: 'agent-xyz' });
    expect(client.listPolicies).toHaveBeenCalledWith('agent-xyz');
  });

  it('returns error for unknown tool name', async () => {
    const client = mockClient();
    const result = await handleToolCall(client, 'claude-code', 'sidclaw_unknown', {});
    expect(result.isError).toBe(true);
  });

  it('session_start returns a synthetic session id', async () => {
    const client = mockClient();
    const result = await handleToolCall(client, 'claude-code', 'sidclaw_session_start', {
      agent_id: 'claude-code',
      workspace: '/tmp',
    });
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.session_id).toMatch(/^mcp-sess-/);
  });

  it('session_end validates status', async () => {
    const client = mockClient();
    const result = await handleToolCall(client, 'claude-code', 'sidclaw_session_end', {
      session_id: 'sess-x',
      status: 'bogus',
    });
    expect(result.isError).toBe(true);
  });
});
