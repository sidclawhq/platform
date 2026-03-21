import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import { governOpenAITool } from '../openai-agents';
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

function createMockOpenAITool() {
  return {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location'],
      },
      strict: true,
    },
  };
}

describe('governOpenAITool', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps handler function with governance', async () => {
    const tool = createMockOpenAITool();
    const handler = vi.fn().mockResolvedValue({ temp: 72 });
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governOpenAITool(tool, handler, { client });
    const result = await governed.handler({ location: 'NYC' });

    expect(result).toEqual({ temp: 72 });
    expect(handler).toHaveBeenCalledWith({ location: 'NYC' });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'get_weather',
        target_integration: 'get_weather',
        context: {
          input: { location: 'NYC' },
          tool_description: 'Get weather for a location',
        },
      })
    );
  });

  it('preserves function schema', () => {
    const tool = createMockOpenAITool();
    const handler = vi.fn();

    const governed = governOpenAITool(tool, handler, { client });

    expect(governed.tool).toBe(tool);
    expect(governed.tool.type).toBe('function');
    expect(governed.tool.function.name).toBe('get_weather');
    expect(governed.tool.function.parameters).toEqual(tool.function.parameters);
    expect(governed.tool.function.strict).toBe(true);
  });

  it('records outcome after successful execution', async () => {
    const tool = createMockOpenAITool();
    const handler = vi.fn().mockResolvedValue('ok');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governOpenAITool(tool, handler, { client });
    await governed.handler({});

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });
  });

  it('records error outcome when handler throws', async () => {
    const tool = createMockOpenAITool();
    const handler = vi.fn().mockRejectedValue(new Error('API failure'));
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governOpenAITool(tool, handler, { client });
    await expect(governed.handler({})).rejects.toThrow('API failure');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'API failure' },
    });
  });

  it('throws ActionDeniedError on deny', async () => {
    const tool = createMockOpenAITool();
    const handler = vi.fn();
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const governed = governOpenAITool(tool, handler, { client });
    const error = await governed.handler({}).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
    expect(handler).not.toHaveBeenCalled();
  });

  it('throws ActionDeniedError on approval_required', async () => {
    const tool = createMockOpenAITool();
    const handler = vi.fn();
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const governed = governOpenAITool(tool, handler, { client });
    const error = await governed.handler({}).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval required');
    expect(handler).not.toHaveBeenCalled();
  });

  it('re-throws original error from handler', async () => {
    const tool = createMockOpenAITool();
    const originalError = new Error('Original');
    const handler = vi.fn().mockRejectedValue(originalError);
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governOpenAITool(tool, handler, { client });
    await expect(governed.handler({})).rejects.toBe(originalError);
  });
});
