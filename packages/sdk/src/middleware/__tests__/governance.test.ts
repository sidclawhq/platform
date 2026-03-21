import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@sidclaw/shared';
import type { ApprovalStatusResponse } from '../../client/agent-identity-client';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import { withGovernance } from '../governance';
import { ActionDeniedError, ApprovalExpiredError } from '../../errors';

const GOVERNANCE_CONFIG = {
  operation: 'send_message',
  target_integration: 'slack',
  resource_scope: '#general',
  data_classification: 'internal' as const,
};

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

describe('withGovernance()', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('executes the wrapped function when decision is allow', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    const result = await governed();

    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe('result');
  });

  it('records success outcome after successful execution', async () => {
    const mockFn = vi.fn().mockResolvedValue('ok');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    await governed();

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'success',
    });
  });

  it('records error outcome when wrapped function throws', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Something broke'));
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    await expect(governed()).rejects.toThrow('Something broke');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Something broke' },
    });
  });

  it('re-throws the original error from wrapped function', async () => {
    const originalError = new Error('Original error');
    const mockFn = vi.fn().mockRejectedValue(originalError);
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    await expect(governed()).rejects.toBe(originalError);
  });

  it('waits for approval when decision is approval_required', async () => {
    const mockFn = vi.fn().mockResolvedValue('approved result');
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'approved',
      decided_at: '2026-03-20T10:00:00Z',
      approver_name: 'Alice',
      decision_note: 'Approved',
    });
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    await governed();

    expect(client.waitForApproval).toHaveBeenCalledWith('approval-1', undefined);
  });

  it('executes after approval is granted', async () => {
    const mockFn = vi.fn().mockResolvedValue('post-approval result');
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'approved',
      decided_at: '2026-03-20T10:00:00Z',
      approver_name: 'Alice',
      decision_note: null,
    });
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    const result = await governed();

    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe('post-approval result');
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-3', {
      status: 'success',
    });
  });

  it('throws ActionDeniedError when decision is deny', async () => {
    const mockFn = vi.fn();
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    const error = await governed().catch(e => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
    expect(error.traceId).toBe('trace-2');
    expect(error.policyRuleId).toBe('rule-2');
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('throws ActionDeniedError when approval is denied by reviewer', async () => {
    const mockFn = vi.fn();
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'denied',
      decided_at: '2026-03-20T10:00:00Z',
      approver_name: 'Bob',
      decision_note: 'Too risky for production',
    });

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    const error = await governed().catch(e => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('includes decision_note in ActionDeniedError message', async () => {
    const mockFn = vi.fn();
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'denied',
      decided_at: '2026-03-20T10:00:00Z',
      approver_name: 'Bob',
      decision_note: 'Too risky for production',
    });

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    const error = await governed().catch(e => e) as ActionDeniedError;

    expect(error.message).toContain('Too risky for production');
  });

  it('throws ApprovalExpiredError when approval expires', async () => {
    const mockFn = vi.fn();
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'expired',
      decided_at: null,
      approver_name: null,
      decision_note: null,
    } as ApprovalStatusResponse);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    const error = await governed().catch(e => e);

    expect(error).toBeInstanceOf(ApprovalExpiredError);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('passes approval options to waitForApproval', async () => {
    const mockFn = vi.fn().mockResolvedValue('ok');
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockResolvedValue({
      id: 'approval-1',
      status: 'approved',
      decided_at: '2026-03-20T10:00:00Z',
      approver_name: 'Alice',
      decision_note: null,
    });
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, {
      ...GOVERNANCE_CONFIG,
      approvalOptions: { timeout: 60000, pollInterval: 5000 },
    }, mockFn);
    await governed();

    expect(client.waitForApproval).toHaveBeenCalledWith('approval-1', {
      timeout: 60000,
      pollInterval: 5000,
    });
  });

  it('preserves the return value of the wrapped function', async () => {
    const complexResult = { data: [1, 2, 3], nested: { key: 'value' } };
    const mockFn = vi.fn().mockResolvedValue(complexResult);
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    const result = await governed();

    expect(result).toBe(complexResult);
  });

  it('preserves the arguments passed to the wrapped function', async () => {
    const mockFn = vi.fn().mockResolvedValue('ok');
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const governed = withGovernance(client, GOVERNANCE_CONFIG, mockFn);
    await governed('arg1', 42, { key: 'value' });

    expect(mockFn).toHaveBeenCalledWith('arg1', 42, { key: 'value' });
  });
});
