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
