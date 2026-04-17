import { describe, it, expect, vi } from 'vitest';
import {
  createSidClawPlugin,
  createSidClawOpenClawPluginEntry,
  PLUGIN_ID,
  PLUGIN_VERSION,
} from '../src/index';

function mockClient(opts: { decision?: string; approvalRequestId?: string | null } = {}) {
  return {
    evaluate: vi.fn(async (req: any) => ({
      decision: opts.decision ?? 'allow',
      trace_id: `trace-${req?.resource_scope ?? 'x'}`,
      approval_request_id: opts.approvalRequestId ?? null,
      reason: 'ok',
      policy_rule_id: 'pol-1',
    })),
    recordOutcome: vi.fn(async () => undefined),
    recordTelemetry: vi.fn(async () => undefined),
  } as any;
}

describe('createSidClawPlugin', () => {
  it('exposes the expected plugin shape', () => {
    const plugin = createSidClawPlugin({ client: mockClient() });
    expect(plugin.id).toBe(PLUGIN_ID);
    expect(plugin.version).toBe(PLUGIN_VERSION);
    expect(plugin.version).toBe('0.3.0');
    expect(plugin.hooks.before_tool_call).toBeInstanceOf(Function);
    expect(plugin.hooks.after_tool_call).toBeInstanceOf(Function);
    expect(plugin.hooks.llm_output).toBeInstanceOf(Function);
    expect(plugin.hooks.agent_end).toBeInstanceOf(Function);
  });

  it('skips read-only tools by default', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });
    await plugin.hooks.before_tool_call({ tool_name: 'read_file', tool_call_id: 't1' });
    expect(client.evaluate).not.toHaveBeenCalled();
  });

  it('evaluates write tools', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });
    await plugin.hooks.before_tool_call({ tool_name: 'send_email', tool_call_id: 't1' });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'openclaw.send_email' }),
    );
  });

  it('blocks on deny in enforce mode', async () => {
    const client = mockClient({ decision: 'deny' });
    const plugin = createSidClawPlugin({ client, mode: 'enforce' });
    const result = await plugin.hooks.before_tool_call({
      tool_name: 'delete_record',
      tool_call_id: 't1',
    });
    expect(result).toEqual(expect.objectContaining({ abort: true }));
  });

  it('does not block on deny in observe mode', async () => {
    const client = mockClient({ decision: 'deny' });
    const plugin = createSidClawPlugin({ client, mode: 'observe' });
    const result = await plugin.hooks.before_tool_call({
      tool_name: 'delete_record',
      tool_call_id: 't1',
    });
    expect(result).toBeUndefined();
  });

  it('records outcome after_tool_call', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });
    await plugin.hooks.before_tool_call({ tool_name: 'send_email', tool_call_id: 't1' });
    await plugin.hooks.after_tool_call({
      tool_name: 'send_email',
      tool_call_id: 't1',
      output: 'email sent',
    });
    expect(client.recordOutcome).toHaveBeenCalledWith(
      'trace-send_email',
      expect.objectContaining({ status: 'success', outcome_summary: 'email sent' }),
    );
  });

  it('records error_classification for errors', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });
    await plugin.hooks.before_tool_call({ tool_name: 'send_email', tool_call_id: 't2' });
    await plugin.hooks.after_tool_call({
      tool_call_id: 't2',
      error: new Error('permission denied'),
    });
    expect(client.recordOutcome).toHaveBeenCalledWith(
      'trace-send_email',
      expect.objectContaining({ status: 'error', error_classification: 'permission' }),
    );
  });

  it('attributes token usage on llm_output (per session)', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });
    await plugin.hooks.before_tool_call({
      tool_name: 'send_email',
      tool_call_id: 't3',
      session_id: 'sess-A',
    });
    await plugin.hooks.llm_output({
      session_id: 'sess-A',
      usage: {
        input_tokens: 2000,
        output_tokens: 500,
        cache_read_input_tokens: 0,
        model: 'claude-sonnet-4-6',
      },
    });
    expect(client.recordTelemetry).toHaveBeenCalledWith(
      'trace-send_email',
      expect.objectContaining({
        tokens_in: 2000,
        tokens_out: 500,
        model: 'claude-sonnet-4-6',
      }),
    );
  });

  it('clears state on agent_end', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });
    await plugin.hooks.before_tool_call({ tool_name: 'send_email', tool_call_id: 't4' });
    await plugin.hooks.agent_end();
    // After clear, after_tool_call should do nothing
    await plugin.hooks.after_tool_call({ tool_call_id: 't4' });
    expect(client.recordOutcome).not.toHaveBeenCalled();
  });

  it('applies custom toolClassifier', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({
      client,
      toolClassifier: (name) =>
        name === 'custom_tool'
          ? {
              operation: 'custom_op',
              target_integration: 'custom',
              resource_scope: 'scope',
              data_classification: 'restricted',
            }
          : null,
    });
    await plugin.hooks.before_tool_call({ tool_name: 'custom_tool', tool_call_id: 't5' });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'custom_op', data_classification: 'restricted' }),
    );
  });

  it('isolates pending traces per session', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });

    // Two sessions each open one trace with colliding tool_call_ids.
    await plugin.hooks.before_tool_call({
      tool_name: 'send_email',
      tool_call_id: 'dup',
      session_id: 'sess-A',
    });
    await plugin.hooks.before_tool_call({
      tool_name: 'create_ticket',
      tool_call_id: 'dup',
      session_id: 'sess-B',
    });

    expect(plugin._internal.pendingCount('sess-A')).toBe(1);
    expect(plugin._internal.pendingCount('sess-B')).toBe(1);
    expect(plugin._internal.pendingCount()).toBe(2);

    // llm_output on sess-A should only record telemetry against sess-A's trace.
    await plugin.hooks.llm_output({
      session_id: 'sess-A',
      usage: { input_tokens: 100, output_tokens: 50, model: 'claude-sonnet-4-6' },
    });
    expect(client.recordTelemetry).toHaveBeenCalledTimes(1);
    expect(client.recordTelemetry).toHaveBeenCalledWith(
      'trace-send_email',
      expect.anything(),
    );

    // Ending session A should not drop session B's trace.
    await plugin.hooks.agent_end({ session_id: 'sess-A' });
    expect(plugin._internal.pendingCount('sess-A')).toBe(0);
    expect(plugin._internal.pendingCount('sess-B')).toBe(1);
  });

  it('does NOT flag removeFilter as destructive (false-positive guard)', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });

    await plugin.hooks.before_tool_call({
      tool_name: 'removeFilter',
      tool_call_id: 't-rf',
    });
    // Leading verb = `remove`, which was dropped from the destructive set.
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'openclaw.removeFilter',
        context: expect.objectContaining({ reversible: true, risk_score: 30 }),
      }),
    );
  });

  it('flags delete_record as destructive (first-token match)', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });

    await plugin.hooks.before_tool_call({
      tool_name: 'delete_record',
      tool_call_id: 't-del',
    });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'openclaw.delete_record',
        context: expect.objectContaining({ reversible: false, risk_score: 70 }),
      }),
    );
  });

  it('does NOT flag list_delete_candidates (verb is `list`, not `delete`)', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });

    await plugin.hooks.before_tool_call({
      tool_name: 'list_delete_candidates',
      tool_call_id: 't-list',
    });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'openclaw.list_delete_candidates',
        context: expect.objectContaining({ reversible: true, risk_score: 30 }),
      }),
    );
  });

  it('prefers agent_id from hook context over defaultAgentId', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client, defaultAgentId: 'agent-default' });

    await plugin.hooks.before_tool_call({
      tool_name: 'send_email',
      tool_call_id: 't-a',
      agent_id: 'agent-from-ctx',
    });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ agent_id: 'agent-from-ctx' }),
    );

    client.evaluate.mockClear();

    // Without agent_id in context, falls back to defaultAgentId.
    await plugin.hooks.before_tool_call({
      tool_name: 'send_email',
      tool_call_id: 't-b',
    });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ agent_id: 'agent-default' }),
    );
  });

  it('uses data_classification for sensitivity, not destructiveness', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });

    await plugin.hooks.before_tool_call({ tool_name: 'drop_table', tool_call_id: 't-dt' });
    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        data_classification: 'internal',
        context: expect.objectContaining({ reversible: false, risk_score: 70 }),
      }),
    );
  });

  it('dedupes telemetry per runId (same run fires llm_output twice = one call)', async () => {
    const client = mockClient();
    const plugin = createSidClawPlugin({ client });
    await plugin.hooks.before_tool_call({
      tool_name: 'send_email',
      tool_call_id: 't-dedup',
      session_id: 'sess-R',
    });

    await plugin.hooks.llm_output({
      session_id: 'sess-R',
      run_id: 'run-1',
      usage: { input_tokens: 100, output_tokens: 50, model: 'claude-sonnet-4-6' },
    });
    await plugin.hooks.llm_output({
      session_id: 'sess-R',
      run_id: 'run-1',
      usage: { input_tokens: 100, output_tokens: 50, model: 'claude-sonnet-4-6' },
    });
    expect(client.recordTelemetry).toHaveBeenCalledTimes(1);

    // A new runId should attribute again.
    await plugin.hooks.llm_output({
      session_id: 'sess-R',
      run_id: 'run-2',
      usage: { input_tokens: 100, output_tokens: 50, model: 'claude-sonnet-4-6' },
    });
    expect(client.recordTelemetry).toHaveBeenCalledTimes(2);
  });

  it('gracefully no-ops llm_output when client lacks recordTelemetry', async () => {
    // Simulate older SDK: only evaluate + recordOutcome.
    const client = {
      evaluate: vi.fn(async (req: any) => ({
        decision: 'allow',
        trace_id: `trace-${req?.resource_scope ?? 'x'}`,
        approval_request_id: null,
        reason: 'ok',
        policy_rule_id: 'pol-1',
      })),
      recordOutcome: vi.fn(async () => undefined),
      // recordTelemetry intentionally missing
    } as any;
    const plugin = createSidClawPlugin({ client });

    await plugin.hooks.before_tool_call({
      tool_name: 'send_email',
      tool_call_id: 't-old',
      session_id: 'sess-old',
    });
    // Must not throw.
    await expect(
      plugin.hooks.llm_output({
        session_id: 'sess-old',
        usage: { input_tokens: 100, output_tokens: 50, model: 'claude-sonnet-4-6' },
      }),
    ).resolves.toBeUndefined();
  });

  it('returns requireApproval shape from before_tool_call on approval_required', async () => {
    const client = mockClient({ decision: 'approval_required', approvalRequestId: 'appr-123' });
    const plugin = createSidClawPlugin({
      client,
      approvalDashboardUrl: 'https://app.sidclaw.com',
    });
    const result = await plugin.hooks.before_tool_call({
      tool_name: 'send_email',
      tool_call_id: 't-appr',
    });
    expect(result).toEqual({
      requireApproval: {
        reason: 'ok',
        url: 'https://app.sidclaw.com/dashboard/approvals/appr-123',
        approval_request_id: 'appr-123',
      },
    });
  });
});

/* -------------------------------------------------------------------------- *
 * createSidClawOpenClawPluginEntry: integration with OpenClaw's real
 * `OpenClawPluginApi`. We build an in-memory hook registry that mirrors the
 * real `api.on(name, handler)` shape and fire events that match OpenClaw's
 * actual payloads (PluginHookBeforeToolCallEvent + PluginHookToolContext etc.).
 * -------------------------------------------------------------------------- */

type Registry = Map<string, (...args: unknown[]) => unknown>;

function fakeApi(): { api: any; registry: Registry; logs: Record<string, string[]> } {
  const registry: Registry = new Map();
  const logs = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  const api = {
    id: 'test',
    name: 'test',
    logger: {
      info: (m: string) => logs.info.push(m),
      warn: (m: string) => logs.warn.push(m),
      error: (m: string) => logs.error.push(m),
    },
    on: (name: string, handler: (...args: unknown[]) => unknown) => {
      registry.set(name, handler);
    },
  };
  return { api, registry, logs };
}

describe('createSidClawOpenClawPluginEntry', () => {
  it('returns a definePluginEntry-compatible object', () => {
    const entry = createSidClawOpenClawPluginEntry({ client: mockClient() });
    expect(entry.id).toBe(PLUGIN_ID);
    expect(entry.name).toBeTruthy();
    expect(entry.description).toBeTruthy();
    expect(entry.version).toBe('0.3.0');
    expect(typeof entry.register).toBe('function');
    expect(entry.hooks.before_tool_call).toBeInstanceOf(Function);
  });

  it('registers the OpenClaw hook names via api.on', () => {
    const entry = createSidClawOpenClawPluginEntry({ client: mockClient() });
    const { api, registry } = fakeApi();
    entry.register(api);
    expect([...registry.keys()].sort()).toEqual(
      ['after_tool_call', 'agent_end', 'before_tool_call', 'llm_output', 'session_end'].sort(),
    );
  });

  it('warns (does not throw) when the host API lacks `on`', () => {
    const entry = createSidClawOpenClawPluginEntry({ client: mockClient() });
    const warnings: string[] = [];
    expect(() => {
      entry.register({
        logger: { warn: (m: string) => warnings.push(m) },
      } as any);
    }).not.toThrow();
    expect(warnings.some((m) => m.includes('on'))).toBe(true);
  });

  it('before_tool_call: maps OpenClaw event/ctx → evaluate call and returns block shape on deny', async () => {
    const client = mockClient({ decision: 'deny' });
    const entry = createSidClawOpenClawPluginEntry({ client, mode: 'enforce' });
    const { api, registry } = fakeApi();
    entry.register(api);

    const handler = registry.get('before_tool_call')!;
    const result = await handler(
      { toolName: 'delete_record', params: { id: 'r-1' }, runId: 'run-1', toolCallId: 'tc-1' },
      { toolName: 'delete_record', sessionKey: 'sess-1', sessionId: 'sess-1', agentId: 'agent-x', runId: 'run-1', toolCallId: 'tc-1' },
    );

    expect(client.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: 'agent-x',
        operation: 'openclaw.delete_record',
        target_integration: 'openclaw',
        context: expect.objectContaining({ session_id: 'sess-1' }),
      }),
    );
    expect(result).toEqual({ block: true, blockReason: expect.any(String) });
  });

  it('before_tool_call: returns requireApproval shape on approval_required', async () => {
    const client = mockClient({ decision: 'approval_required', approvalRequestId: 'appr-1' });
    const entry = createSidClawOpenClawPluginEntry({
      client,
      approvalDashboardUrl: 'https://app.sidclaw.com',
    });
    const { api, registry } = fakeApi();
    entry.register(api);

    const handler = registry.get('before_tool_call')!;
    const result = (await handler(
      { toolName: 'send_email', params: {}, toolCallId: 'tc-2' },
      { toolName: 'send_email', sessionId: 'sess-1' },
    )) as any;

    expect(result).toEqual({
      requireApproval: expect.objectContaining({
        title: 'SidClaw approval required',
        description: expect.stringContaining('https://app.sidclaw.com/dashboard/approvals/appr-1'),
        severity: 'warning',
        pluginId: PLUGIN_ID,
      }),
    });
  });

  it('before_tool_call: returns void on allow (no block/approval)', async () => {
    const client = mockClient({ decision: 'allow' });
    const entry = createSidClawOpenClawPluginEntry({ client });
    const { api, registry } = fakeApi();
    entry.register(api);

    const handler = registry.get('before_tool_call')!;
    const result = await handler(
      { toolName: 'send_email', params: {}, toolCallId: 'tc-ok' },
      { toolName: 'send_email', sessionId: 'sess-1' },
    );
    expect(result).toBeUndefined();
  });

  it('after_tool_call: records outcome with classified error', async () => {
    const client = mockClient();
    const entry = createSidClawOpenClawPluginEntry({ client });
    const { api, registry } = fakeApi();
    entry.register(api);

    const before = registry.get('before_tool_call')!;
    await before(
      { toolName: 'send_email', params: {}, toolCallId: 'tc-a' },
      { toolName: 'send_email', sessionId: 'sess-A' },
    );

    const after = registry.get('after_tool_call')!;
    await after(
      {
        toolName: 'send_email',
        params: {},
        toolCallId: 'tc-a',
        error: 'permission denied',
        durationMs: 42,
      },
      { toolName: 'send_email', sessionId: 'sess-A' },
    );

    expect(client.recordOutcome).toHaveBeenCalledWith(
      'trace-send_email',
      expect.objectContaining({ status: 'error', error_classification: 'permission' }),
    );
  });

  it('llm_output: translates OpenClaw usage fields into SidClaw telemetry', async () => {
    const client = mockClient();
    const entry = createSidClawOpenClawPluginEntry({ client });
    const { api, registry } = fakeApi();
    entry.register(api);

    const before = registry.get('before_tool_call')!;
    await before(
      { toolName: 'send_email', params: {}, toolCallId: 'tc-1' },
      { toolName: 'send_email', sessionId: 'sess-1' },
    );

    const llmOut = registry.get('llm_output')!;
    await llmOut(
      {
        runId: 'run-1',
        sessionId: 'sess-1',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        assistantTexts: ['hi'],
        usage: { input: 2000, output: 500, cacheRead: 0 },
      },
      { sessionId: 'sess-1' },
    );

    expect(client.recordTelemetry).toHaveBeenCalledWith(
      'trace-send_email',
      expect.objectContaining({
        tokens_in: 2000,
        tokens_out: 500,
        model: 'claude-sonnet-4-6',
      }),
    );
  });

  it('session_end: flushes pending state for that session', async () => {
    const client = mockClient();
    const entry = createSidClawOpenClawPluginEntry({ client });
    const { api, registry } = fakeApi();
    entry.register(api);

    const before = registry.get('before_tool_call')!;
    await before(
      { toolName: 'send_email', params: {}, toolCallId: 'tc-x' },
      { toolName: 'send_email', sessionId: 'sess-end' },
    );

    const sessionEnd = registry.get('session_end')!;
    await sessionEnd(
      {
        sessionId: 'sess-end',
        messageCount: 10,
      },
      { sessionId: 'sess-end' },
    );

    // After session_end, a late after_tool_call should be a no-op.
    const after = registry.get('after_tool_call')!;
    await after(
      { toolName: 'send_email', params: {}, toolCallId: 'tc-x' },
      { toolName: 'send_email', sessionId: 'sess-end' },
    );
    expect(client.recordOutcome).not.toHaveBeenCalled();
  });
});
