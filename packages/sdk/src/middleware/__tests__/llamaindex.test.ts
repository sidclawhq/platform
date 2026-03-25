import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import { governLlamaIndexTool, governLlamaIndexTools } from '../llamaindex';
import { ActionDeniedError } from '../../errors';

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

/**
 * Creates a mock LlamaIndex-style tool with duck-typed metadata + call.
 */
function createMockLlamaIndexTool(
  name = 'search_docs',
  description = 'Search the documentation',
) {
  return {
    metadata: {
      name,
      description,
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    },
    call: vi.fn().mockResolvedValue('search result'),
  };
}

// ---------------------------------------------------------------------------
// Tests: governLlamaIndexTool
// ---------------------------------------------------------------------------

describe('governLlamaIndexTool', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps a tool and evaluates governance before execution', async () => {
    const tool = createMockLlamaIndexTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTool(client, tool);
    await governed.call({ query: 'test' });

    expect(client.evaluate).toHaveBeenCalledWith({
      operation: 'search_docs',
      target_integration: 'search_docs',
      resource_scope: '*',
      data_classification: 'internal',
      context: { input: { query: 'test' }, tool_description: 'Search the documentation' },
    });
    expect(tool.call).toHaveBeenCalledWith({ query: 'test' });
  });

  it('preserves tool metadata (name, description, parameters)', () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());

    const tool = createMockLlamaIndexTool('calculator', 'Perform calculations');
    const governed = governLlamaIndexTool(client, tool);

    expect(governed.metadata.name).toBe('calculator');
    expect(governed.metadata.description).toBe('Perform calculations');
    expect(governed.metadata.parameters).toEqual({
      type: 'object',
      properties: { query: { type: 'string' } },
    });
  });

  it('records success outcome after execution', async () => {
    const tool = createMockLlamaIndexTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTool(client, tool);
    await governed.call({ query: 'test' });

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });
  });

  it('records error outcome when tool throws', async () => {
    const tool = createMockLlamaIndexTool();
    tool.call.mockRejectedValue(new Error('Tool failed'));
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTool(client, tool);
    await expect(governed.call({ query: 'test' })).rejects.toThrow('Tool failed');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Tool failed' },
    });
  });

  it('throws ActionDeniedError on deny decision', async () => {
    const tool = createMockLlamaIndexTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const governed = governLlamaIndexTool(client, tool);
    const error = await governed.call({ query: 'test' }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
    expect(error.traceId).toBe('trace-2');
    expect(error.policyRuleId).toBe('rule-2');
    expect(tool.call).not.toHaveBeenCalled();
  });

  it('throws ActionDeniedError on approval_required decision', async () => {
    const tool = createMockLlamaIndexTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const governed = governLlamaIndexTool(client, tool);
    const error = await governed.call({ query: 'test' }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval required');
    expect(error.message).toContain('approval-1');
    expect(tool.call).not.toHaveBeenCalled();
  });

  it('re-throws original error from tool', async () => {
    const tool = createMockLlamaIndexTool();
    const originalError = new Error('Original error');
    tool.call.mockRejectedValue(originalError);
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTool(client, tool);
    await expect(governed.call({ query: 'test' })).rejects.toBe(originalError);
  });

  it('uses config overrides for target_integration, resource_scope, data_classification', async () => {
    const tool = createMockLlamaIndexTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTool(client, tool, {
      target_integration: 'custom-integration',
      resource_scope: '/api/data',
      data_classification: 'pii',
    });
    await governed.call({ query: 'test' });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        target_integration: 'custom-integration',
        resource_scope: '/api/data',
        data_classification: 'pii',
      }),
    );
  });

  it('passes tool input as context to evaluate', async () => {
    const tool = createMockLlamaIndexTool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTool(client, tool);
    await governed.call({ query: 'hello', limit: 10 });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          input: { query: 'hello', limit: 10 },
          tool_description: 'Search the documentation',
        },
      }),
    );
  });

  it('returns the original tool result on success', async () => {
    const tool = createMockLlamaIndexTool();
    tool.call.mockResolvedValue({ answer: 'Found 42 results' });
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTool(client, tool);
    const result = await governed.call({ query: 'test' });

    expect(result).toEqual({ answer: 'Found 42 results' });
  });
});

// ---------------------------------------------------------------------------
// Tests: governLlamaIndexTools
// ---------------------------------------------------------------------------

describe('governLlamaIndexTools', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps all tools in array', () => {
    const tool1 = createMockLlamaIndexTool('search_docs', 'Search');
    const tool2 = createMockLlamaIndexTool('calculator', 'Calculate');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());

    const governed = governLlamaIndexTools(client, [tool1, tool2]);

    expect(governed).toHaveLength(2);
    expect(governed[0].metadata.name).toBe('search_docs');
    expect(governed[1].metadata.name).toBe('calculator');
  });

  it('uses tool metadata.name as target_integration for each tool', async () => {
    const tool1 = createMockLlamaIndexTool('search_docs', 'Search');
    const tool2 = createMockLlamaIndexTool('calculator', 'Calculate');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTools(client, [tool1, tool2]);
    await governed[0].call('q1');
    await governed[1].call('q2');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ target_integration: 'search_docs' }),
    );
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ target_integration: 'calculator' }),
    );
  });

  it('applies shared config to all tools', async () => {
    const tool1 = createMockLlamaIndexTool('search_docs', 'Search');
    const tool2 = createMockLlamaIndexTool('calculator', 'Calculate');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governLlamaIndexTools(client, [tool1, tool2], {
      data_classification: 'confidential',
      resource_scope: '/enterprise',
    });

    await governed[0].call('q1');
    await governed[1].call('q2');

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        data_classification: 'confidential',
        resource_scope: '/enterprise',
      }),
    );
  });

  it('returns empty array for empty input', () => {
    const governed = governLlamaIndexTools(client, []);
    expect(governed).toEqual([]);
  });
});
