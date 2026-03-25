import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import {
  governClaudeAgentTool,
  governClaudeAgentTools,
} from '../claude-agent-sdk';
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

function createMockTool(overrides?: Partial<{ name: string; description: string; execute: (args: unknown) => Promise<unknown> }>) {
  return {
    name: 'search',
    description: 'Search the knowledge base',
    parameters: { type: 'object', properties: { query: { type: 'string' } } },
    execute: vi.fn().mockResolvedValue('search result: 42'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: governClaudeAgentTool
// ---------------------------------------------------------------------------

describe('governClaudeAgentTool', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('allows execution and records success outcome', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool);

    const result = await governed.execute({ query: 'test' });

    // Verify policy evaluation was called
    expect(client.evaluate).toHaveBeenCalledWith({
      operation: 'search',
      target_integration: 'search',
      resource_scope: 'claude_agent',
      data_classification: 'internal',
      context: {
        framework: 'claude_agent_sdk',
        tool_name: 'search',
        args: { query: 'test' },
      },
    });

    // Verify tool was executed
    expect(tool.execute).toHaveBeenCalledWith({ query: 'test' });

    // Verify outcome recorded
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });

    // Verify result
    expect(result).toBe('search result: 42');
  });

  it('preserves tool name, description, and parameters', () => {
    const tool = createMockTool({
      name: 'custom-tool',
      description: 'A custom tool for testing',
    });

    const governed = governClaudeAgentTool(client, tool);

    expect(governed.name).toBe('custom-tool');
    expect(governed.description).toBe('A custom tool for testing');
    expect(governed.parameters).toEqual({ type: 'object', properties: { query: { type: 'string' } } });
  });

  it('denies execution and throws ActionDeniedError', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool);

    const error = await governed.execute({ query: 'test' }).catch((e: unknown) => e) as ActionDeniedError;

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

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool, { waitForApproval: true });

    const result = await governed.execute({ query: 'test' });

    expect(client.waitForApproval).toHaveBeenCalledWith('approval-1', {
      timeout: 300_000,
      pollInterval: 2_000,
    });
    expect(tool.execute).toHaveBeenCalled();
    expect(result).toBe('search result: 42');
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

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool, { waitForApproval: true });

    const error = await governed.execute({ query: 'test' }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval denied');
    expect(error.message).toContain('Not authorized');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('handles approval_required with waitForApproval=false', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool, { waitForApproval: false });

    const error = await governed.execute({ query: 'test' }).catch((e: unknown) => e) as ActionDeniedError;

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

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool, {
      waitForApproval: true,
      approvalTimeoutMs: 5000,
    });

    const error = await governed.execute({ query: 'test' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApprovalTimeoutError);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('records error outcome when tool execution fails', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool({
      execute: vi.fn().mockRejectedValue(new Error('Tool execution failed')),
    });
    const governed = governClaudeAgentTool(client, tool);

    await expect(governed.execute({ query: 'test' })).rejects.toThrow('Tool execution failed');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Tool execution failed' },
    });
  });

  it('uses custom data classification', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool, {
      dataClassification: 'confidential',
    });

    await governed.execute({ query: 'test' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'confidential' }),
    );
  });

  it('uses custom resource scope', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool, {
      resourceScope: 'enterprise_data',
    });

    await governed.execute({ query: 'test' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ resource_scope: 'enterprise_data' }),
    );
  });

  it('uses custom target integration', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool, {
      targetIntegration: 'knowledge_base',
    });

    await governed.execute({ query: 'test' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ target_integration: 'knowledge_base' }),
    );
  });

  it('uses custom approval polling config', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'approved',
      decided_at: new Date().toISOString(),
      approver_name: 'admin',
      decision_note: null,
    });
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool, {
      waitForApproval: true,
      approvalTimeoutMs: 60_000,
      approvalPollIntervalMs: 5_000,
    });

    await governed.execute({ query: 'test' });

    expect(client.waitForApproval).toHaveBeenCalledWith('approval-1', {
      timeout: 60_000,
      pollInterval: 5_000,
    });
  });

  it('handles non-object args by wrapping in { raw: ... }', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governClaudeAgentTool(client, tool);

    await governed.execute('plain string arg');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          args: { raw: 'plain string arg' },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: governClaudeAgentTools
// ---------------------------------------------------------------------------

describe('governClaudeAgentTools', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps all tools in the array', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool1 = createMockTool({ name: 'search' });
    const tool2 = createMockTool({ name: 'write', execute: vi.fn().mockResolvedValue('written') });

    const governed = governClaudeAgentTools(client, [tool1, tool2], {
      dataClassification: 'confidential',
    });

    expect(governed).toHaveLength(2);
    expect(governed[0]!.name).toBe('search');
    expect(governed[1]!.name).toBe('write');

    // Execute the first governed tool
    await governed[0]!.execute({ query: 'test' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'search',
        target_integration: 'search',
        data_classification: 'confidential',
      }),
    );
  });

  it('uses each tool name as target_integration', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool1 = createMockTool({ name: 'tool-alpha' });
    const tool2 = createMockTool({ name: 'tool-beta' });

    const governed = governClaudeAgentTools(client, [tool1, tool2]);

    await governed[0]!.execute({ x: 1 });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ target_integration: 'tool-alpha' }),
    );

    await governed[1]!.execute({ x: 2 });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ target_integration: 'tool-beta' }),
    );
  });
});
