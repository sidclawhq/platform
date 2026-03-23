import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @actions/core
const mockCore = {
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};
vi.mock('@actions/core', () => mockCore);

// Mock @actions/github
vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'testorg', repo: 'testrepo' },
    actor: 'testuser',
    sha: 'abc123',
    ref: 'refs/heads/main',
    workflow: 'Deploy',
    runId: 12345,
  },
  getOctokit: vi.fn(() => ({
    rest: {
      checks: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function setInputs(inputs: Record<string, string>) {
  mockCore.getInput.mockImplementation((name: string, opts?: { required?: boolean }) => {
    const value = inputs[name];
    if (opts?.required && !value) throw new Error(`Input required: ${name}`);
    return value ?? '';
  });
}

describe('SidClaw Governance Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  const defaultInputs = {
    'api-key': 'test-key',
    'agent-id': 'agent-001',
    'operation': 'deploy',
    'target-integration': 'production',
    'resource-scope': '*',
    'data-classification': 'confidential',
    'api-url': 'https://api.sidclaw.com',
    'wait-for-approval': 'true',
    'timeout': '300',
  };

  it('sets decision output on allow', async () => {
    setInputs(defaultInputs);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        decision: 'allow',
        trace_id: 'trace-001',
        approval_request_id: null,
        reason: 'Policy allows this action',
        policy_rule_id: 'rule-001',
      }),
    });

    await import('../src/index.js');

    expect(mockCore.setOutput).toHaveBeenCalledWith('decision', 'allow');
    expect(mockCore.setOutput).toHaveBeenCalledWith('trace-id', 'trace-001');
    expect(mockCore.setFailed).not.toHaveBeenCalled();
  });

  it('fails the step on deny with policy reason', async () => {
    setInputs(defaultInputs);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        decision: 'deny',
        trace_id: 'trace-002',
        approval_request_id: null,
        reason: 'Restricted operation blocked by policy',
        policy_rule_id: 'rule-002',
      }),
    });

    // Re-import to re-run
    vi.resetModules();
    vi.mock('@actions/core', () => mockCore);
    vi.mock('@actions/github', () => ({
      context: {
        repo: { owner: 'testorg', repo: 'testrepo' },
        actor: 'testuser',
        sha: 'abc123',
        ref: 'refs/heads/main',
        workflow: 'Deploy',
        runId: 12345,
      },
      getOctokit: vi.fn(),
    }));
    global.fetch = mockFetch;
    await import('../src/index.js');

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Blocked by policy')
    );
  });

  it('creates check run on approval_required', async () => {
    setInputs(defaultInputs);
    process.env.GITHUB_TOKEN = 'gh-token';

    const mockChecksCreate = vi.fn().mockResolvedValue({});
    const { getOctokit } = await import('@actions/github');
    (getOctokit as any).mockReturnValue({
      rest: { checks: { create: mockChecksCreate } },
    });

    // First call: evaluate returns approval_required
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        decision: 'approval_required',
        trace_id: 'trace-003',
        approval_request_id: 'appr-003',
        reason: 'Requires human review',
        policy_rule_id: 'rule-003',
      }),
    });

    // Second call: approval status returns approved
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'appr-003',
        status: 'approved',
        decided_at: '2026-03-23T12:00:00Z',
        approver_name: 'reviewer',
        decision_note: 'Looks good',
      }),
    });

    vi.resetModules();
    vi.mock('@actions/core', () => mockCore);
    vi.mock('@actions/github', () => ({
      context: {
        repo: { owner: 'testorg', repo: 'testrepo' },
        actor: 'testuser',
        sha: 'abc123',
        ref: 'refs/heads/main',
        workflow: 'Deploy',
        runId: 12345,
      },
      getOctokit: vi.fn(() => ({
        rest: { checks: { create: mockChecksCreate } },
      })),
    }));
    global.fetch = mockFetch;
    await import('../src/index.js');

    expect(mockCore.setOutput).toHaveBeenCalledWith('decision', 'approval_required');
    expect(mockCore.setOutput).toHaveBeenCalledWith('approval-id', 'appr-003');
  });

  it('includes GitHub context in evaluation', async () => {
    setInputs(defaultInputs);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        decision: 'allow',
        trace_id: 'trace-004',
        approval_request_id: null,
        reason: 'Allowed',
        policy_rule_id: null,
      }),
    });

    vi.resetModules();
    vi.mock('@actions/core', () => mockCore);
    vi.mock('@actions/github', () => ({
      context: {
        repo: { owner: 'testorg', repo: 'testrepo' },
        actor: 'testuser',
        sha: 'abc123',
        ref: 'refs/heads/main',
        workflow: 'Deploy',
        runId: 12345,
      },
      getOctokit: vi.fn(),
    }));
    global.fetch = mockFetch;
    await import('../src/index.js');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.context.github_repository).toBe('testorg/testrepo');
    expect(callBody.context.github_actor).toBe('testuser');
    expect(callBody.context.github_sha).toBe('abc123');
  });

  it('skips wait when wait-for-approval is false', async () => {
    setInputs({ ...defaultInputs, 'wait-for-approval': 'false' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        decision: 'approval_required',
        trace_id: 'trace-005',
        approval_request_id: 'appr-005',
        reason: 'Requires review',
        policy_rule_id: null,
      }),
    });

    vi.resetModules();
    vi.mock('@actions/core', () => mockCore);
    vi.mock('@actions/github', () => ({
      context: {
        repo: { owner: 'testorg', repo: 'testrepo' },
        actor: 'testuser',
        sha: 'abc123',
        ref: 'refs/heads/main',
        workflow: 'Deploy',
        runId: 12345,
      },
      getOctokit: vi.fn(),
    }));
    global.fetch = mockFetch;
    await import('../src/index.js');

    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('wait-for-approval is false')
    );
    expect(mockCore.setFailed).not.toHaveBeenCalled();
  });
});
