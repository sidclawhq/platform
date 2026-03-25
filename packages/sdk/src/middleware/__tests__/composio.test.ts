import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluateResponse } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../../client/agent-identity-client';
import {
  governComposioExecution,
  createComposioGovernanceModifiers,
  mapComposioSlug,
} from '../composio';
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

function createMockComposio() {
  return {
    tools: {
      execute: vi.fn().mockResolvedValue({
        data: { id: 123, title: 'Created' },
        error: null,
        successful: true,
      }),
      get: vi.fn().mockResolvedValue([
        {
          slug: 'GITHUB_CREATE_ISSUE',
          name: 'Create Issue',
          toolkit: { slug: 'GITHUB', name: 'GitHub' },
          input_parameters: { type: 'object', properties: {} },
        },
      ]),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: mapComposioSlug
// ---------------------------------------------------------------------------

describe('mapComposioSlug', () => {
  it('maps GITHUB_CREATE_ISSUE correctly', () => {
    const result = mapComposioSlug('GITHUB_CREATE_ISSUE');
    expect(result).toEqual({ operation: 'create_issue', target_integration: 'github' });
  });

  it('maps GMAIL_SEND_EMAIL correctly', () => {
    const result = mapComposioSlug('GMAIL_SEND_EMAIL');
    expect(result).toEqual({ operation: 'send_email', target_integration: 'gmail' });
  });

  it('maps SALESFORCE_CREATE_LEAD correctly', () => {
    const result = mapComposioSlug('SALESFORCE_CREATE_LEAD');
    expect(result).toEqual({ operation: 'create_lead', target_integration: 'salesforce' });
  });

  it('handles multi-word actions (SLACK_SEND_DIRECT_MESSAGE)', () => {
    const result = mapComposioSlug('SLACK_SEND_DIRECT_MESSAGE');
    expect(result).toEqual({ operation: 'send_direct_message', target_integration: 'slack' });
  });

  it('handles single-word slugs', () => {
    const result = mapComposioSlug('WEBHOOK');
    expect(result).toEqual({ operation: 'webhook', target_integration: 'webhook' });
  });

  it('handles two-part slug', () => {
    const result = mapComposioSlug('NOTION_QUERY');
    expect(result).toEqual({ operation: 'query', target_integration: 'notion' });
  });
});

// ---------------------------------------------------------------------------
// Tests: governComposioExecution
// ---------------------------------------------------------------------------

describe('governComposioExecution', () => {
  let client: AgentIdentityClient;
  let composio: ReturnType<typeof createMockComposio>;

  beforeEach(() => {
    client = createMockClient();
    composio = createMockComposio();
  });

  it('allows execution and records success outcome', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const execute = governComposioExecution(client, composio);
    const result = await execute('GITHUB_CREATE_ISSUE', {
      userId: 'user_123',
      arguments: { owner: 'org', repo: 'project', title: 'Bug fix' },
    });

    // Verify policy evaluation
    expect(client.evaluate).toHaveBeenCalledWith({
      operation: 'create_issue',
      target_integration: 'github',
      resource_scope: 'composio_managed',
      data_classification: 'internal',
      context: {
        composio_slug: 'GITHUB_CREATE_ISSUE',
        params: { userId: 'user_123', arguments: { owner: 'org', repo: 'project', title: 'Bug fix' } },
      },
    });

    // Verify Composio was called
    expect(composio.tools.execute).toHaveBeenCalledWith('GITHUB_CREATE_ISSUE', {
      userId: 'user_123',
      arguments: { owner: 'org', repo: 'project', title: 'Bug fix' },
    });

    // Verify outcome recorded
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });

    // Verify result shape
    expect(result.traceId).toBe('trace-1');
    expect(result.decision).toBe('allow');
    expect(result.result).toEqual({ data: { id: 123, title: 'Created' }, error: null, successful: true });
  });

  it('denies execution and throws ActionDeniedError', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const execute = governComposioExecution(client, composio);

    const error = await execute('SALESFORCE_CREATE_LEAD', {
      userId: 'user_123',
      arguments: {},
    }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
    expect(error.traceId).toBe('trace-2');
    expect(composio.tools.execute).not.toHaveBeenCalled();
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

    const execute = governComposioExecution(client, composio, { waitForApproval: true });
    const result = await execute('GMAIL_SEND_EMAIL', {
      userId: 'user_123',
      arguments: { to: 'user@example.com', subject: 'Hello' },
    });

    expect(client.waitForApproval).toHaveBeenCalledWith('approval-1', {
      timeout: 300_000,
      pollInterval: 2_000,
    });
    expect(composio.tools.execute).toHaveBeenCalled();
    expect(result.decision).toBe('approval_required');
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

    const execute = governComposioExecution(client, composio, { waitForApproval: true });

    const error = await execute('GMAIL_SEND_EMAIL', {
      userId: 'user_123',
      arguments: {},
    }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval denied');
    expect(error.message).toContain('Not authorized');
    expect(composio.tools.execute).not.toHaveBeenCalled();
  });

  it('handles approval_required with waitForApproval=false', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());

    const execute = governComposioExecution(client, composio, { waitForApproval: false });

    const error = await execute('GMAIL_SEND_EMAIL', {
      userId: 'user_123',
      arguments: {},
    }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.message).toContain('Approval required');
    expect(error.message).toContain('approval-1');
    expect(client.waitForApproval).not.toHaveBeenCalled();
    expect(composio.tools.execute).not.toHaveBeenCalled();
  });

  it('handles approval timeout', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeApprovalRequiredDecision());
    vi.mocked(client.waitForApproval).mockRejectedValue(
      new ApprovalTimeoutError('approval-1', 'trace-3', 5000),
    );

    const execute = governComposioExecution(client, composio, {
      waitForApproval: true,
      approvalTimeoutMs: 5000,
    });

    const error = await execute('GMAIL_SEND_EMAIL', {
      userId: 'user_123',
      arguments: {},
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApprovalTimeoutError);
    expect(composio.tools.execute).not.toHaveBeenCalled();
  });

  it('uses per-toolkit data classification', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const execute = governComposioExecution(client, composio, {
      dataClassification: {
        SALESFORCE: 'confidential',
        GITHUB: 'public',
      },
      defaultClassification: 'internal',
    });

    await execute('SALESFORCE_CREATE_LEAD', { userId: 'u', arguments: {} });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'confidential' }),
    );
  });

  it('uses default classification when toolkit not in config', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const execute = governComposioExecution(client, composio, {
      dataClassification: { SALESFORCE: 'confidential' },
      defaultClassification: 'restricted',
    });

    await execute('NOTION_CREATE_PAGE', { userId: 'u', arguments: {} });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'restricted' }),
    );
  });

  it('records error outcome when Composio execution fails', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);
    composio.tools.execute.mockRejectedValue(new Error('Composio API error'));

    const execute = governComposioExecution(client, composio);

    await expect(execute('GITHUB_CREATE_ISSUE', { userId: 'u', arguments: {} }))
      .rejects.toThrow('Composio API error');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', {
      status: 'error',
      metadata: { error: 'Composio API error' },
    });
  });

  it('uses custom resource scope', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const execute = governComposioExecution(client, composio, {
      resourceScope: 'enterprise_data',
    });

    await execute('GITHUB_CREATE_ISSUE', { userId: 'u', arguments: {} });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ resource_scope: 'enterprise_data' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: createComposioGovernanceModifiers
// ---------------------------------------------------------------------------

describe('createComposioGovernanceModifiers', () => {
  let client: AgentIdentityClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('beforeExecute blocks on deny', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeDenyDecision());

    const modifiers = createComposioGovernanceModifiers(client);

    const error = await modifiers.beforeExecute({
      toolSlug: 'SALESFORCE_DELETE_RECORD',
      toolkitSlug: 'SALESFORCE',
      params: { id: '123' },
    }).catch((e: unknown) => e) as ActionDeniedError;

    expect(error).toBeInstanceOf(ActionDeniedError);
    expect(error.reason).toBe('Operation not permitted');
  });

  it('beforeExecute allows and afterExecute records trace', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const modifiers = createComposioGovernanceModifiers(client);

    const params = await modifiers.beforeExecute({
      toolSlug: 'GITHUB_CREATE_ISSUE',
      toolkitSlug: 'GITHUB',
      params: { title: 'Bug' },
    });

    expect(params).toEqual({ title: 'Bug' });

    const result = await modifiers.afterExecute({
      toolSlug: 'GITHUB_CREATE_ISSUE',
      toolkitSlug: 'GITHUB',
      result: { data: { id: 1 } },
    });

    expect(result).toEqual({ data: { id: 1 } });
    expect(client.recordOutcome).toHaveBeenCalledWith('trace-1', { status: 'success' });
  });

  it('afterExecute does nothing if no inflight entry', async () => {
    vi.mocked(client.recordOutcome).mockResolvedValue(undefined);

    const modifiers = createComposioGovernanceModifiers(client);

    // Call afterExecute without beforeExecute
    const result = await modifiers.afterExecute({
      toolSlug: 'UNKNOWN_TOOL',
      toolkitSlug: 'UNKNOWN',
      result: { data: {} },
    });

    expect(result).toEqual({ data: {} });
    expect(client.recordOutcome).not.toHaveBeenCalled();
  });

  it('uses data classification config', async () => {
    vi.mocked(client.evaluate).mockResolvedValue(makeAllowDecision());

    const modifiers = createComposioGovernanceModifiers(client, {
      dataClassification: { GMAIL: 'confidential' },
    });

    await modifiers.beforeExecute({
      toolSlug: 'GMAIL_SEND_EMAIL',
      toolkitSlug: 'GMAIL',
      params: {},
    });

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'confidential' }),
    );
  });
});
