import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import { governTool, governTools } from '../langchain';
import { ActionDeniedError } from '../../errors';

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

function createMockTool(name = 'search', description = 'Search the web') {
  return {
    name,
    description,
    schema: { type: 'object', properties: { query: { type: 'string' } } },
    returnDirect: false,
    metadata: { source: 'test' },
    invoke: vi.fn().mockResolvedValue('search result'),
  };
}

describe('governTool', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps a tool and evaluates before execution', async () => {
    const tool = createMockTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governTool(tool, { client });
    await governed.invoke('test query');

    expect(client.evaluate).toHaveBeenCalledWith({
      operation: 'search',
      target_integration: 'search',
      resource_scope: '*',
      data_classification: 'internal',
      context: { input: 'test query', tool_description: 'Search the web' },
    });
    expect(tool.invoke).toHaveBeenCalledWith('test query', undefined);
  });

  it('preserves tool name and description', () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());

    const tool = createMockTool('calculator', 'Do math');
    const governed = governTool(tool, { client });

    expect(governed.name).toBe('calculator');
    expect(governed.description).toBe('Do math');
    expect(governed.schema).toEqual(tool.schema);
    expect(governed.returnDirect).toBe(false);
    expect(governed.metadata).toEqual({ source: 'test' });
  });

  it('records success outcome after execution', async () => {
    const tool = createMockTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governTool(tool, { client });
    await governed.invoke('query');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });
  });

  it('records error outcome when tool throws', async () => {
    const tool = createMockTool();
    tool.invoke.mockRejectedValue(new Error('Tool failed'));
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governTool(tool, { client });
    await expect(governed.invoke('query')).rejects.toThrow('Tool failed');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Tool failed' },
    });
  });

  it('throws ActionDeniedError on deny decision', async () => {
    const tool = createMockTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const governed = governTool(tool, { client });
    const error = await governed.invoke('query').catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
    expect(error.traceId).toBe('trace-2');
    expect(error.policyRuleId).toBe('rule-2');
    expect(tool.invoke).not.toHaveBeenCalled();
  });

  it('throws ActionDeniedError on approval_required decision', async () => {
    const tool = createMockTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const governed = governTool(tool, { client });
    const error = await governed.invoke('query').catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval required');
    expect(error.message).toContain('approval-1');
    expect(tool.invoke).not.toHaveBeenCalled();
  });

  it('re-throws original error from tool', async () => {
    const tool = createMockTool();
    const originalError = new Error('Original error');
    tool.invoke.mockRejectedValue(originalError);
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governTool(tool, { client });
    await expect(governed.invoke('query')).rejects.toBe(originalError);
  });

  it('passes tool input as context to evaluate', async () => {
    const tool = createMockTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governTool(tool, { client });
    await governed.invoke({ query: 'hello', limit: 10 });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          input: { query: 'hello', limit: 10 },
          tool_description: 'Search the web',
        },
      })
    );
  });

  it('uses config overrides for target_integration and resource_scope', async () => {
    const tool = createMockTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governTool(tool, {
      client,
      target_integration: 'custom-integration',
      resource_scope: '/api/data',
      data_classification: 'pii',
    });
    await governed.invoke('query');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        target_integration: 'custom-integration',
        resource_scope: '/api/data',
        data_classification: 'pii',
      })
    );
  });
});

describe('governTools', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps all tools in array', async () => {
    const tool1 = createMockTool('search', 'Search');
    const tool2 = createMockTool('calculator', 'Calculate');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governTools([tool1, tool2], { client });

    expect(governed).toHaveLength(2);
    expect(governed[0].name).toBe('search');
    expect(governed[1].name).toBe('calculator');
  });

  it('uses tool name as target_integration for each', async () => {
    const tool1 = createMockTool('search', 'Search');
    const tool2 = createMockTool('calculator', 'Calculate');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governTools([tool1, tool2], { client });
    await governed[0].invoke('q1');
    await governed[1].invoke('q2');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ target_integration: 'search' })
    );
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ target_integration: 'calculator' })
    );
  });
});
