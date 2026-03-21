import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@agent-identity/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import { governVercelTool, governVercelTools } from '../vercel-ai';
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

describe('governVercelTool', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps execute function with governance', async () => {
    const tool = {
      description: 'Get weather data',
      parameters: { type: 'object' },
      execute: vi.fn().mockResolvedValue({ temp: 72, unit: 'F' }),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governVercelTool('weather', tool, { client });
    const result = await governed.execute!({ city: 'NYC' });

    expect(result).toEqual({ temp: 72, unit: 'F' });
    expect(tool.execute).toHaveBeenCalledWith({ city: 'NYC' }, undefined);
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'weather',
        target_integration: 'weather',
        context: { input: { city: 'NYC' }, tool_description: 'Get weather data' },
      })
    );
  });

  it('preserves tool description and parameters', () => {
    const tool = {
      description: 'Some tool',
      parameters: { type: 'object', properties: { x: { type: 'number' } } },
      execute: vi.fn(),
    };

    const governed = governVercelTool('my_tool', tool, { client });

    expect(governed.description).toBe('Some tool');
    expect(governed.parameters).toEqual(tool.parameters);
  });

  it('returns tool unchanged if no execute function', () => {
    const tool = {
      description: 'Schema-only tool',
      parameters: { type: 'object' },
    };

    const governed = governVercelTool('schema_tool', tool, { client });

    expect(governed).toBe(tool);
    expect(governed.execute).toBeUndefined();
  });

  it('records outcome after execution', async () => {
    const tool = {
      description: 'Tool',
      execute: vi.fn().mockResolvedValue('done'),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governVercelTool('test', tool, { client });
    await governed.execute!({});

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });
  });

  it('records error outcome when execute throws', async () => {
    const tool = {
      description: 'Tool',
      execute: vi.fn().mockRejectedValue(new Error('Execute failed')),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governVercelTool('test', tool, { client });
    await expect(governed.execute!({})).rejects.toThrow('Execute failed');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Execute failed' },
    });
  });

  it('throws ActionDeniedError on deny', async () => {
    const tool = {
      description: 'Tool',
      execute: vi.fn(),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const governed = governVercelTool('test', tool, { client });
    const error = await governed.execute!({}).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('throws ActionDeniedError on approval_required', async () => {
    const tool = {
      description: 'Tool',
      execute: vi.fn(),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const governed = governVercelTool('test', tool, { client });
    const error = await governed.execute!({}).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval required');
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('passes options through to original execute', async () => {
    const tool = {
      description: 'Tool',
      execute: vi.fn().mockResolvedValue('ok'),
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governVercelTool('test', tool, { client });
    const options = { abortSignal: new AbortController().signal };
    await governed.execute!({ x: 1 }, options);

    expect(tool.execute).toHaveBeenCalledWith({ x: 1 }, options);
  });
});

describe('governVercelTools', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps all executable tools in an object', async () => {
    const tools = {
      weather: {
        description: 'Get weather',
        execute: vi.fn().mockResolvedValue({ temp: 72 }),
      },
      search: {
        description: 'Search',
        execute: vi.fn().mockResolvedValue(['result']),
      },
      schema_only: {
        description: 'Schema only',
        parameters: { type: 'object' },
      },
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governVercelTools(tools, { client });

    expect(governed.weather.description).toBe('Get weather');
    expect(governed.search.description).toBe('Search');
    expect(governed.schema_only).toBe(tools.schema_only);
  });

  it('uses tool name as target_integration', async () => {
    const tools = {
      weather: {
        description: 'Weather',
        execute: vi.fn().mockResolvedValue('ok'),
      },
    };
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governVercelTools(tools, { client });
    await governed.weather.execute!({});

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ target_integration: 'weather' })
    );
  });
});
