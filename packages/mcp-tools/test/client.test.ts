import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SidClawClient, SidClawApiError } from '../src/client';

describe('SidClawClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stubFetch(responder: (url: string, init: RequestInit) => Response | Promise<Response>) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      return responder(String(input), init ?? {});
    }) as typeof fetch;
  }

  it('evaluate sends correct body + headers', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    stubFetch((url, init) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          decision: 'allow',
          trace_id: 't1',
          approval_request_id: null,
          reason: 'ok',
          policy_rule_id: null,
        }),
        { status: 200 },
      );
    });
    const c = new SidClawClient({ baseUrl: 'https://api.example.com', apiKey: 'ai_key' });
    const res = await c.evaluate({
      agent_id: 'a',
      operation: 'op',
      target_integration: 'mcp',
      resource_scope: 'r',
      data_classification: 'internal',
    });
    expect(res.decision).toBe('allow');
    expect(calls[0].url).toBe('https://api.example.com/api/v1/evaluate');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer ai_key');
  });

  it('throws SidClawApiError on non-2xx', async () => {
    stubFetch(() => new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }));
    const c = new SidClawClient({ baseUrl: 'https://api.example.com', apiKey: 'ai_key' });
    await expect(
      c.evaluate({
        agent_id: 'a',
        operation: 'op',
        target_integration: 'mcp',
        resource_scope: 'r',
        data_classification: 'internal',
      }),
    ).rejects.toThrow(SidClawApiError);
  });

  it('waitForApproval returns final status', async () => {
    let call = 0;
    stubFetch(() => {
      call++;
      const status = call < 2 ? 'pending' : 'approved';
      return new Response(JSON.stringify({ status, approver_name: 'Alice' }), { status: 200 });
    });
    const c = new SidClawClient({ baseUrl: 'https://api.example.com', apiKey: 'ai_key' });
    const res = await c.waitForApproval('ap-1', 5, 0.01);
    expect(res.status).toBe('approved');
    expect(res.approver_name).toBe('Alice');
  });

  it('waitForApproval returns "timeout" when deadline hits', async () => {
    stubFetch(() => new Response(JSON.stringify({ status: 'pending' }), { status: 200 }));
    const c = new SidClawClient({ baseUrl: 'https://api.example.com', apiKey: 'ai_key' });
    // 0.1s timeout, 0.01s poll interval — should resolve to timeout
    const res = await c.waitForApproval('ap-1', 0.1, 0.01);
    expect(res.status).toBe('timeout');
  });
});
