import { describe, it, expect, vi } from 'vitest';
import { GovernanceCallbackHandler } from '../src/callbacks.js';

function makeMockClient() {
  return {
    evaluate: vi.fn().mockResolvedValue({ trace_id: 'trace-123', decision: 'allow', reason: 'ok' }),
    recordOutcome: vi.fn().mockResolvedValue(undefined),
    waitForApproval: vi.fn(),
    config: { apiKey: 'test', apiUrl: 'test', agentId: 'test', maxRetries: 0, retryBaseDelayMs: 500 },
  } as any;
}

describe('GovernanceCallbackHandler', () => {
  it('creates trace on handleToolStart', async () => {
    const client = makeMockClient();
    const handler = new GovernanceCallbackHandler(client);

    await handler.handleToolStart({ name: 'search' }, 'query text', 'run-1');

    expect(client.evaluate).toHaveBeenCalledOnce();
    const call = client.evaluate.mock.calls[0][0];
    expect(call.operation).toBe('search');
    expect(call.context.mode).toBe('observe');
  });

  it('records success on handleToolEnd', async () => {
    const client = makeMockClient();
    const handler = new GovernanceCallbackHandler(client);

    await handler.handleToolStart({ name: 'search' }, 'query', 'run-1');
    await handler.handleToolEnd('result', 'run-1');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-123', { status: 'success' });
  });

  it('records error on handleToolError', async () => {
    const client = makeMockClient();
    const handler = new GovernanceCallbackHandler(client);

    await handler.handleToolStart({ name: 'search' }, 'query', 'run-1');
    await handler.handleToolError(new Error('boom'), 'run-1');

    expect(client.recordOutcome).toHaveBeenCalledWith('trace-123', {
      status: 'error',
      metadata: { error: 'boom' },
    });
  });

  it('never blocks on evaluate failure', async () => {
    const client = makeMockClient();
    client.evaluate.mockRejectedValue(new Error('API down'));
    const handler = new GovernanceCallbackHandler(client);

    // Should not throw
    await handler.handleToolStart({ name: 'search' }, 'query', 'run-1');
  });

  it('never blocks on recordOutcome failure', async () => {
    const client = makeMockClient();
    client.recordOutcome.mockRejectedValue(new Error('API down'));
    const handler = new GovernanceCallbackHandler(client);

    await handler.handleToolStart({ name: 'search' }, 'query', 'run-1');
    // Should not throw
    await handler.handleToolEnd('result', 'run-1');
  });

  it('truncates long input', async () => {
    const client = makeMockClient();
    const handler = new GovernanceCallbackHandler(client);
    const longInput = 'x'.repeat(1000);

    await handler.handleToolStart({ name: 'search' }, longInput, 'run-1');

    const call = client.evaluate.mock.calls[0][0];
    expect(call.context.input.length).toBe(500);
  });

  it('uses default data classification', async () => {
    const client = makeMockClient();
    const handler = new GovernanceCallbackHandler(client, 'confidential');

    await handler.handleToolStart({ name: 'search' }, 'query', 'run-1');

    const call = client.evaluate.mock.calls[0][0];
    expect(call.data_classification).toBe('confidential');
  });
});
