import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import {
  governGoogleADKTool,
  governGoogleADKTools,
} from '../google-adk';
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

function createMockTool(name = 'search_docs') {
  return {
    name,
    description: `Tool: ${name}`,
    execute: vi.fn().mockResolvedValue({ results: ['doc1', 'doc2'] }),
  };
}

// ---------------------------------------------------------------------------
// Tests: governGoogleADKTool
// ---------------------------------------------------------------------------

describe('governGoogleADKTool', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('allows execution and records success outcome', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governGoogleADKTool(client, tool);

    const result = await governed.execute({ query: 'hello' });

    // Verify policy evaluation
    expect(client.evaluate).toHaveBeenCalledWith({
      operation: 'search_docs',
      target_integration: 'google_adk',
      resource_scope: 'google_adk',
      data_classification: 'internal',
      context: {
        google_adk_tool: 'search_docs',
        params: { query: 'hello' },
      },
    });

    // Verify original tool was called
    expect(tool.execute).toHaveBeenCalledWith({ query: 'hello' });

    // Verify outcome recorded
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });

    // Verify result
    expect(result).toEqual({ results: ['doc1', 'doc2'] });
  });

  it('preserves tool name and description', () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());

    const tool = createMockTool('create_ticket');
    const governed = governGoogleADKTool(client, tool);

    expect(governed.name).toBe('create_ticket');
    expect(governed.description).toBe('Tool: create_ticket');
  });

  it('marks tool as governed', () => {
    const tool = createMockTool();
    const governed = governGoogleADKTool(client, tool);

    expect(governed.__sidclaw_governed).toBe(true);
  });

  it('denies execution and throws ActionDeniedError', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const tool = createMockTool();
    const governed = governGoogleADKTool(client, tool);

    const error = await governed.execute({ query: 'hello' })
      .catch((e: unknown) => e) as ActionDeniedError;

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
    const governed = governGoogleADKTool(client, tool, { waitForApproval: true });

    const result = await governed.execute({ query: 'sensitive' });

    expect(client.waitForApproval).toHaveBeenCalledWith('approval-1', {
      timeout: 300_000,
      pollInterval: 2_000,
    });
    expect(tool.execute).toHaveBeenCalled();
    expect(result).toEqual({ results: ['doc1', 'doc2'] });
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
    const governed = governGoogleADKTool(client, tool, { waitForApproval: true });

    const error = await governed.execute({ query: 'hello' })
      .catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval denied');
    expect(error.message).toContain('Not authorized');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('handles approval_required with waitForApproval=false', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const tool = createMockTool();
    const governed = governGoogleADKTool(client, tool, { waitForApproval: false });

    const error = await governed.execute({ query: 'hello' })
      .catch((e: unknown) => e) as ActionDeniedError;

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
    const governed = governGoogleADKTool(client, tool, {
      waitForApproval: true,
      approvalTimeoutMs: 5000,
    });

    const error = await governed.execute({ query: 'hello' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApprovalTimeoutError);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('uses per-tool data classification', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool('send_email');
    const governed = governGoogleADKTool(client, tool, {
      dataClassification: {
        send_email: 'confidential',
        search_docs: 'public',
      },
      defaultClassification: 'internal',
    });

    await governed.execute({ to: 'user@example.com' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'confidential' }),
    );
  });

  it('uses default classification when tool not in config', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool('unknown_tool');
    const governed = governGoogleADKTool(client, tool, {
      dataClassification: { send_email: 'confidential' },
      defaultClassification: 'restricted',
    });

    await governed.execute({});

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'restricted' }),
    );
  });

  it('records error outcome when tool execution fails', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    tool.execute.mockRejectedValue(new Error('Tool execution error'));

    const governed = governGoogleADKTool(client, tool);

    await expect(governed.execute({ query: 'hello' }))
      .rejects.toThrow('Tool execution error');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Tool execution error' },
    });
  });

  it('uses custom resource scope', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governGoogleADKTool(client, tool, {
      resourceScope: 'enterprise_data',
    });

    await governed.execute({ query: 'hello' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ resource_scope: 'enterprise_data' }),
    );
  });

  it('handles non-object params by wrapping in raw', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tool = createMockTool();
    const governed = governGoogleADKTool(client, tool);

    await governed.execute('raw string param');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          google_adk_tool: 'search_docs',
          params: { raw: 'raw string param' },
        },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: governGoogleADKTools
// ---------------------------------------------------------------------------

describe('governGoogleADKTools', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps multiple tools', () => {
    const tools = [
      createMockTool('search_docs'),
      createMockTool('create_ticket'),
      createMockTool('send_email'),
    ];

    const governed = governGoogleADKTools(client, tools);

    expect(governed).toHaveLength(3);
    expect(governed[0]!.name).toBe('search_docs');
    expect(governed[1]!.name).toBe('create_ticket');
    expect(governed[2]!.name).toBe('send_email');
    expect(governed[0]!.__sidclaw_governed).toBe(true);
    expect(governed[1]!.__sidclaw_governed).toBe(true);
    expect(governed[2]!.__sidclaw_governed).toBe(true);
  });

  it('applies config to all tools', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const tools = [createMockTool('tool_a'), createMockTool('tool_b')];
    const governed = governGoogleADKTools(client, tools, {
      defaultClassification: 'confidential',
      resourceScope: 'custom_scope',
    });

    await governed[0]!.execute({});
    await governed[1]!.execute({});

    expect(client.evaluate).toHaveBeenCalledTimes(2);
    expect(client.evaluate).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        data_classification: 'confidential',
        resource_scope: 'custom_scope',
        operation: 'tool_a',
      }),
    );
    expect(client.evaluate).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        data_classification: 'confidential',
        resource_scope: 'custom_scope',
        operation: 'tool_b',
      }),
    );
  });

  it('returns empty array for empty input', () => {
    const governed = governGoogleADKTools(client, []);
    expect(governed).toEqual([]);
  });
});
