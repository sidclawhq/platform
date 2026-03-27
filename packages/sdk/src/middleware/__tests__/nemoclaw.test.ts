import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import {
  governNemoClawTool,
  governNemoClawTools,
  createNemoClawProxy,
} from '../nemoclaw';
import type { NemoClawToolLike } from '../nemoclaw';
import { ActionDeniedError, ApprovalTimeoutError } from '../../errors';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function createMockClient(): AgentIdentityClient {
  return {
    evaluate: vi.fn(),
    waitForApproval: vi.fn(),
    recordOutcome: vi.fn(),
  } as unknown as AgentIdentityClient;
}

function makeAllowDecision(overrides?: Partial<EvaluateResponse>): EvaluateResponse {
  return {
    decision: 'allow',
    trace_id: 'trace-1',
    approval_request_id: null,
    reason: 'Allowed by policy',
    policy_rule_id: 'rule-1',
    ...overrides,
  };
}

function makeDenyDecision(overrides?: Partial<EvaluateResponse>): EvaluateResponse {
  return {
    decision: 'deny',
    trace_id: 'trace-2',
    approval_request_id: null,
    reason: 'Operation not permitted',
    policy_rule_id: 'rule-2',
    ...overrides,
  };
}

function makeApprovalRequiredDecision(overrides?: Partial<EvaluateResponse>): EvaluateResponse {
  return {
    decision: 'approval_required',
    trace_id: 'trace-3',
    approval_request_id: 'approval-1',
    reason: 'Requires human approval',
    policy_rule_id: 'rule-3',
    ...overrides,
  };
}

function createMockExecuteTool(overrides?: Partial<NemoClawToolLike>): NemoClawToolLike {
  return {
    name: 'run_query',
    execute: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
    ...overrides,
  };
}

function createMockInvokeTool(overrides?: Partial<NemoClawToolLike>): NemoClawToolLike {
  return {
    name: 'deploy_container',
    invoke: vi.fn().mockResolvedValue({ status: 'deployed' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: governNemoClawTool — execute-based tools
// ---------------------------------------------------------------------------

describe('governNemoClawTool', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('allows execution and records success outcome', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool);

    const result = await governed.execute!({ sql: 'SELECT 1' });

    // Verify policy evaluation was called with correct params
    expect(client.evaluate).toHaveBeenCalledWith({
      operation: 'run_query',
      target_integration: 'nemoclaw',
      resource_scope: 'nemoclaw_sandbox',
      data_classification: 'internal',
      context: {
        tool_name: 'run_query',
        tool_params: { sql: 'SELECT 1' },
        runtime: 'nemoclaw',
      },
    });

    // Verify original tool was executed
    expect(tool.execute).toHaveBeenCalledWith({ sql: 'SELECT 1' });

    // Verify outcome recorded
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });

    // Verify result
    expect(result).toEqual({ rows: [{ id: 1 }] });
  });

  it('preserves tool name and marks as governed', () => {
    const tool = createMockExecuteTool({ name: 'custom-sandbox-tool' });
    const governed = governNemoClawTool(client, tool);

    expect(governed.name).toBe('custom-sandbox-tool');
    expect((governed as Record<string, unknown>).__sidclaw_governed).toBe(true);
  });

  it('denies execution and throws ActionDeniedError', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool);

    const error = await governed.execute!({ sql: 'DROP TABLE users' }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
    expect(error.traceId).toBe('trace-2');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('handles approval_required with waitForApproval=true (approved)', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'approved',
      decided_at: new Date().toISOString(),
      approver_name: 'admin',
      decision_note: 'Looks good',
    });
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool, { waitForApproval: true });

    const result = await governed.execute!({ sql: 'SELECT 1' });

    expect(client.waitForApproval).toHaveBeenCalledWith('approval-1', {
      timeout: 300_000,
      pollInterval: 2_000,
    });
    expect(tool.execute).toHaveBeenCalled();
    expect(result).toEqual({ rows: [{ id: 1 }] });
  });

  it('handles approval_required with waitForApproval=true (denied)', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'denied',
      decided_at: new Date().toISOString(),
      approver_name: 'admin',
      decision_note: 'Not authorized',
    });

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool, { waitForApproval: true });

    const error = await governed.execute!({ sql: 'SELECT 1' }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval denied');
    expect(error.message).toContain('Not authorized');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('defaults waitForApproval to false (unlike other middlewares)', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool);

    const error = await governed.execute!({ sql: 'SELECT 1' }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval required');
    expect(error.message).toContain('approval-1');
    expect(client.waitForApproval).not.toHaveBeenCalled();
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('handles approval timeout', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockRejectedValue(
      new ApprovalTimeoutError('approval-1', 'trace-3', 5000),
    );

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool, {
      waitForApproval: true,
      approvalTimeoutMs: 5000,
    });

    const error = await governed.execute!({ sql: 'SELECT 1' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApprovalTimeoutError);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('records error outcome when tool execution fails', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool({
      execute: vi.fn().mockRejectedValue(new Error('Sandbox crashed')),
    });
    const governed = governNemoClawTool(client, tool);

    await expect(governed.execute!({ sql: 'bad query' })).rejects.toThrow('Sandbox crashed');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Sandbox crashed' },
    });
  });

  it('uses per-tool data classification via Record', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool({ name: 'run_query' });
    const governed = governNemoClawTool(client, tool, {
      dataClassification: { run_query: 'confidential', deploy: 'internal' },
    });

    await governed.execute!({ sql: 'SELECT 1' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'confidential' }),
    );
  });

  it('uses single data classification string', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool, {
      dataClassification: 'restricted',
    });

    await governed.execute!({ sql: 'SELECT 1' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'restricted' }),
    );
  });

  it('uses defaultClassification when tool not in Record', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool({ name: 'unknown_tool' });
    const governed = governNemoClawTool(client, tool, {
      dataClassification: { run_query: 'confidential' },
      defaultClassification: 'restricted',
    });

    await governed.execute!({ sql: 'SELECT 1' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'restricted' }),
    );
  });

  it('includes sandboxName in context when provided', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool, {
      sandboxName: 'finance-sandbox-01',
    });

    await governed.execute!({ sql: 'SELECT 1' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          tool_name: 'run_query',
          tool_params: { sql: 'SELECT 1' },
          runtime: 'nemoclaw',
          sandbox_name: 'finance-sandbox-01',
        },
      }),
    );
  });

  it('wraps invoke-based tools', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockInvokeTool();
    const governed = governNemoClawTool(client, tool);

    const result = await governed.invoke!({ image: 'nginx:latest' });

    expect(tool.invoke).toHaveBeenCalledWith({ image: 'nginx:latest' });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'deploy_container',
        target_integration: 'nemoclaw',
      }),
    );
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });
    expect(result).toEqual({ status: 'deployed' });
  });

  it('handles non-object args by wrapping in { raw: ... }', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool);

    await governed.execute!('plain string arg');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          tool_params: { raw: 'plain string arg' },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: governNemoClawTools
// ---------------------------------------------------------------------------

describe('governNemoClawTools', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps all tools in the array and marks them governed', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool1 = createMockExecuteTool({ name: 'run_query' });
    const tool2 = createMockExecuteTool({ name: 'write_file', execute: vi.fn().mockResolvedValue('ok') });

    const governed = governNemoClawTools(client, [tool1, tool2], {
      dataClassification: 'confidential',
    });

    expect(governed).toHaveLength(2);
    expect(governed[0]!.name).toBe('run_query');
    expect(governed[1]!.name).toBe('write_file');
    expect((governed[0] as Record<string, unknown>).__sidclaw_governed).toBe(true);
    expect((governed[1] as Record<string, unknown>).__sidclaw_governed).toBe(true);

    // Execute the first governed tool
    await governed[0]!.execute!({ sql: 'SELECT 1' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'run_query',
        target_integration: 'nemoclaw',
        data_classification: 'confidential',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: createNemoClawProxy
// ---------------------------------------------------------------------------

describe('createNemoClawProxy', () => {
  it('generates correct MCP proxy config with defaults', () => {
    const config = createNemoClawProxy({
      apiKey: 'ai_test123',
      agentId: 'agent-001',
      upstreamCommand: 'npx',
      upstreamArgs: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/db'],
    });

    expect(config).toEqual({
      mcpServers: {
        governed: {
          command: 'npx',
          args: ['-y', '@sidclaw/sdk', 'mcp-proxy'],
          env: {
            SIDCLAW_API_KEY: 'ai_test123',
            SIDCLAW_AGENT_ID: 'agent-001',
            SIDCLAW_API_URL: 'https://api.sidclaw.com',
            SIDCLAW_UPSTREAM_CMD: 'npx',
            SIDCLAW_UPSTREAM_ARGS: '-y,@modelcontextprotocol/server-postgres,postgresql://localhost/db',
          },
        },
      },
    });
  });

  it('uses custom apiUrl and serverName', () => {
    const config = createNemoClawProxy({
      apiKey: 'ai_key',
      agentId: 'agent-002',
      upstreamCommand: 'node',
      upstreamArgs: ['server.js'],
      apiUrl: 'https://custom.api.example.com',
      serverName: 'my-governed-server',
    });

    expect(config.mcpServers).toHaveProperty('my-governed-server');
    expect(config.mcpServers['my-governed-server']!.env.SIDCLAW_API_URL).toBe('https://custom.api.example.com');
  });

  it('handles empty upstream args', () => {
    const config = createNemoClawProxy({
      apiKey: 'ai_key',
      agentId: 'agent-003',
      upstreamCommand: 'my-server',
      upstreamArgs: [],
    });

    expect(config.mcpServers.governed!.env.SIDCLAW_UPSTREAM_CMD).toBe('my-server');
    expect(config.mcpServers.governed!.env.SIDCLAW_UPSTREAM_ARGS).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  // 1. Tool with no execute or invoke method
  it('governs a tool with no execute or invoke method without crashing', () => {
    const tool: NemoClawToolLike = { name: 'bare_tool' };
    const governed = governNemoClawTool(client, tool);

    expect(governed.name).toBe('bare_tool');
    expect(governed.__sidclaw_governed).toBe(true);
    // Neither execute nor invoke should exist on the governed tool
    expect(governed.execute).toBeUndefined();
    expect(governed.invoke).toBeUndefined();
  });

  // 2. Tool with BOTH execute and invoke — both independently wrapped
  it('wraps both execute and invoke independently when both are present', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const executeFn = vi.fn().mockResolvedValue('exec-result');
    const invokeFn = vi.fn().mockResolvedValue('invoke-result');
    const tool: NemoClawToolLike = {
      name: 'dual_tool',
      execute: executeFn,
      invoke: invokeFn,
    };

    const governed = governNemoClawTool(client, tool);

    // Call execute
    const execResult = await governed.execute!({ mode: 'exec' });
    expect(execResult).toBe('exec-result');
    expect(executeFn).toHaveBeenCalledWith({ mode: 'exec' });
    expect(client.evaluate).toHaveBeenCalledTimes(1);

    // Call invoke
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision({ trace_id: 'trace-invoke' }));
    const invokeResult = await governed.invoke!({ mode: 'invoke' });
    expect(invokeResult).toBe('invoke-result');
    expect(invokeFn).toHaveBeenCalledWith({ mode: 'invoke' });
    expect(client.evaluate).toHaveBeenCalledTimes(2);

    // Both should trigger recordOutcome
    expect(client.recordOutcome).toHaveBeenCalledTimes(2);
  });

  // 3. Double-governing — governNemoClawTool on an already-governed tool
  it('double-governing does not crash and preserves __sidclaw_governed', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool);
    const doubleGoverned = governNemoClawTool(client, governed);

    expect(doubleGoverned.__sidclaw_governed).toBe(true);
    expect(doubleGoverned.name).toBe('run_query');

    // Execute should work (evaluate is called twice — once per governance layer)
    const result = await doubleGoverned.execute!({ sql: 'SELECT 1' });
    expect(result).toEqual({ rows: [{ id: 1 }] });
    expect(client.evaluate).toHaveBeenCalledTimes(2);
  });

  // 4. evaluate() throws a network error (not ActionDeniedError)
  it('propagates network errors from evaluate() and does not call the original tool', async () => {
    vi.mocked(client.evaluate).mockRejectedValue(new Error('ECONNREFUSED'));

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool);

    await expect(governed.execute!({ sql: 'SELECT 1' })).rejects.toThrow('ECONNREFUSED');
    expect(tool.execute).not.toHaveBeenCalled();
    expect(client.recordOutcome).not.toHaveBeenCalled();
  });

  // 5. recordOutcome() throws — verify behavior
  //    The nemoclaw middleware does NOT swallow recordOutcome errors (no .catch(() => {})).
  //    The success recordOutcome throwing means the error propagates even though the tool
  //    succeeded. This documents the actual behavior.
  it('propagates recordOutcome errors on success path (not swallowed)', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockRejectedValue(new Error('Recording failed'));

    const tool = createMockExecuteTool();
    const governed = governNemoClawTool(client, tool);

    // The tool executes, but recordOutcome throws, and that error propagates
    await expect(governed.execute!({ sql: 'SELECT 1' })).rejects.toThrow('Recording failed');

    // The original tool WAS called (it ran before recordOutcome)
    expect(tool.execute).toHaveBeenCalledWith({ sql: 'SELECT 1' });
  });

  // 6. Tool returns null/undefined — results pass through correctly
  it('passes through null result from tool', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool({ execute: vi.fn().mockResolvedValue(null) });
    const governed = governNemoClawTool(client, tool);

    const result = await governed.execute!({});
    expect(result).toBeNull();
  });

  it('passes through undefined result from tool', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool({ execute: vi.fn().mockResolvedValue(undefined) });
    const governed = governNemoClawTool(client, tool);

    const result = await governed.execute!({});
    expect(result).toBeUndefined();
  });

  // 7. Tool called with multiple arguments
  //    The TS middleware signature is execute(args: unknown) => Promise<unknown>,
  //    so only the first argument is used; additional arguments are ignored by JS/TS.
  it('only passes the first argument to the underlying tool (single-arg signature)', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const executeFn = vi.fn().mockResolvedValue('ok');
    const tool = createMockExecuteTool({ execute: executeFn });
    const governed = governNemoClawTool(client, tool);

    // Call with multiple args — TypeScript would normally prevent this, but JS allows it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (governed.execute as any)('arg1', 'arg2', 'arg3');

    // The wrapper function only accepts one arg, so only 'arg1' is forwarded
    expect(executeFn).toHaveBeenCalledWith('arg1');
  });

  // 8. Empty tools array — governNemoClawTools returns empty array
  it('returns empty array for empty tools input', () => {
    const governed = governNemoClawTools(client, []);
    expect(governed).toEqual([]);
    expect(governed).toHaveLength(0);
  });

  // 9. dataClassification as empty Record {} — falls back to defaultClassification
  it('falls back to defaultClassification when dataClassification is empty Record', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool({ name: 'some_tool' });
    const governed = governNemoClawTool(client, tool, {
      dataClassification: {},
      defaultClassification: 'restricted',
    });

    await governed.execute!({});

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'restricted' }),
    );
  });

  it('falls back to internal when dataClassification is empty Record and no defaultClassification', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockExecuteTool({ name: 'some_tool' });
    const governed = governNemoClawTool(client, tool, {
      dataClassification: {},
    });

    await governed.execute!({});

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'internal' }),
    );
  });

  // 10. createNemoClawProxy with empty upstreamArgs [] — env var is empty string
  it('createNemoClawProxy with empty upstreamArgs produces empty string env var', () => {
    const config = createNemoClawProxy({
      apiKey: 'ai_key',
      agentId: 'agent-010',
      upstreamCommand: 'my-server',
      upstreamArgs: [],
    });

    expect(config.mcpServers.governed!.env.SIDCLAW_UPSTREAM_ARGS).toBe('');
  });

  // 11. createNemoClawProxy with args containing commas — known limitation
  //     Commas in args will break the split on the proxy side since args are joined with ','.
  it('createNemoClawProxy joins args with commas (known limitation: commas in args break parsing)', () => {
    const config = createNemoClawProxy({
      apiKey: 'ai_key',
      agentId: 'agent-011',
      upstreamCommand: 'node',
      upstreamArgs: ['--flag=a,b,c', 'server.js'],
    });

    // The join produces a string that cannot be unambiguously split back
    expect(config.mcpServers.governed!.env.SIDCLAW_UPSTREAM_ARGS).toBe('--flag=a,b,c,server.js');
  });

  // 12. Concurrent executions — separate trace IDs, separate outcomes, no interference
  it('handles concurrent executions with separate traces and outcomes', async () => {
    const evaluateFn = vi.mocked(client.evaluate);
    evaluateFn
      .mockResolvedValueOnce(makeAllowDecision({ trace_id: 'trace-concurrent-1' }))
      .mockResolvedValueOnce(makeAllowDecision({ trace_id: 'trace-concurrent-2' }));
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool1 = createMockExecuteTool({
      name: 'tool_a',
      execute: vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('result-a'), 50)),
      ),
    });
    const tool2 = createMockExecuteTool({
      name: 'tool_b',
      execute: vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('result-b'), 30)),
      ),
    });

    const governed1 = governNemoClawTool(client, tool1);
    const governed2 = governNemoClawTool(client, tool2);

    // Execute both concurrently
    const [result1, result2] = await Promise.all([
      governed1.execute!({ query: 'a' }),
      governed2.execute!({ query: 'b' }),
    ]);

    expect(result1).toBe('result-a');
    expect(result2).toBe('result-b');

    // Verify each got its own trace ID for outcome recording
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-concurrent-1', { status: 'success' });
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-concurrent-2', { status: 'success' });
    expect(client.recordOutcome).toHaveBeenCalledTimes(2);
  });
});
