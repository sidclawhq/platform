import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@agent-identity/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import { governCrewAITool } from '../crewai';
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

function createMockCrewAITool(name = 'file_reader', description = 'Read files') {
  return {
    name,
    description,
    func: vi.fn().mockResolvedValue('file contents'),
  };
}

describe('governCrewAITool', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('wraps a CrewAI tool and evaluates before execution', async () => {
    const tool = createMockCrewAITool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governCrewAITool(tool, { client });
    const result = await governed.func('/path/to/file');

    expect(result).toBe('file contents');
    expect(tool.func).toHaveBeenCalledWith('/path/to/file');
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'file_reader',
        target_integration: 'file_reader',
        context: { input: '/path/to/file', tool_description: 'Read files' },
      })
    );
  });

  it('preserves tool name and description', () => {
    const tool = createMockCrewAITool('custom_tool', 'Does custom things');
    const governed = governCrewAITool(tool, { client });

    expect(governed.name).toBe('custom_tool');
    expect(governed.description).toBe('Does custom things');
  });

  it('records success outcome after execution', async () => {
    const tool = createMockCrewAITool();
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governCrewAITool(tool, { client });
    await governed.func('input');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });
  });

  it('records error outcome when tool throws', async () => {
    const tool = createMockCrewAITool();
    tool.func.mockRejectedValue(new Error('Read failed'));
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governCrewAITool(tool, { client });
    await expect(governed.func('input')).rejects.toThrow('Read failed');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Read failed' },
    });
  });

  it('throws ActionDeniedError on deny decision', async () => {
    const tool = createMockCrewAITool();
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const governed = governCrewAITool(tool, { client });
    const error = await governed.func('input').catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
    expect(tool.func).not.toHaveBeenCalled();
  });

  it('throws ActionDeniedError on approval_required decision', async () => {
    const tool = createMockCrewAITool();
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const governed = governCrewAITool(tool, { client });
    const error = await governed.func('input').catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval required');
    expect(tool.func).not.toHaveBeenCalled();
  });

  it('re-throws original error from tool', async () => {
    const tool = createMockCrewAITool();
    const originalError = new Error('Original');
    tool.func.mockRejectedValue(originalError);
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = governCrewAITool(tool, { client });
    await expect(governed.func('input')).rejects.toBe(originalError);
  });
});
