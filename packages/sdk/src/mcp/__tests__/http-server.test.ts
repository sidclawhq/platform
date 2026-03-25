import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startHttpServer } from '../http-server.js';
import type { GovernanceMCPServerConfig } from '../config.js';
import type { AgentIdentityClient } from '../../client/agent-identity-client.js';

/** Parse SSE or JSON response body into a JSON-RPC result. */
async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (contentType.includes('text/event-stream')) {
    // Parse SSE: find the last "data: {...}" line
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i]!.startsWith('data: ')) {
        return JSON.parse(lines[i]!.slice(6));
      }
    }
    throw new Error('No data line found in SSE response');
  }
  return JSON.parse(text);
}

function createMockClient(): AgentIdentityClient {
  return {
    evaluate: vi.fn().mockResolvedValue({
      decision: 'allow',
      trace_id: 'trace-123',
    }),
    waitForApproval: vi.fn(),
    recordOutcome: vi.fn().mockResolvedValue(undefined),
  } as unknown as AgentIdentityClient;
}

function createConfig(overrides: Partial<GovernanceMCPServerConfig> = {}): GovernanceMCPServerConfig {
  return {
    client: createMockClient(),
    upstream: { transport: 'stdio', command: 'echo', args: ['test'] },
    toolMappings: [
      { toolName: 'search_docs', data_classification: 'internal' },
      { toolName: 'send_email', data_classification: 'confidential' },
    ],
    ...overrides,
  };
}

describe('HTTP MCP Server', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeServer) {
      await closeServer();
      closeServer = undefined;
    }
  });

  it('starts and responds to health check', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0, // Let OS assign port
      host: '127.0.0.1',
      apiKey: 'test-key-123',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('sidclaw-mcp-proxy');
    expect(body.transport).toBe('streamable-http');
  });

  it('rejects requests without authorization', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'test-key-123',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} }),
    });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.message).toContain('Unauthorized');
  });

  it('rejects requests with invalid API key', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'correct-key',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-key',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} }),
    });
    expect(res.status).toBe(401);
  });

  it('accepts valid Bearer token and handles initialization', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'valid-api-key',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer valid-api-key',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0' },
        },
      }),
    });

    // Should succeed (200 with SSE or JSON response)
    expect(res.status).toBeLessThan(400);
  });

  it('returns 404 for unknown paths', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'test-key',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(res.status).toBe(404);
  });

  it('handles CORS preflight', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'test-key',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'OPTIONS',
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('returns 400 for POST without session ID or initialize', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'my-key',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer my-key',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it('health check does not require auth', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'secret-key',
    });
    closeServer = close;

    // No Authorization header
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
  });

  it('accepts raw API key without Bearer prefix', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'raw-key-123',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'raw-key-123',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }),
    });

    expect(res.status).toBeLessThan(400);
  });

  it('returns session ID header on initialization', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'key',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer key',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }),
    });

    expect(res.status).toBeLessThan(400);
    const sessionId = res.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();
    expect(sessionId!.length).toBeGreaterThan(0);
  });

  it('full session lifecycle: initialize → notifications/initialized → tools/list', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'lifecycle-key',
    });
    closeServer = close;

    const authHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': 'Bearer lifecycle-key',
    };

    // 1. Initialize
    const initRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }),
    });
    expect(initRes.status).toBeLessThan(400);
    const sessionId = initRes.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    // 2. Send notifications/initialized
    const notifRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { ...authHeaders, 'Mcp-Session-Id': sessionId! },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });
    expect(notifRes.status).toBeLessThan(400);

    // 3. List tools
    const toolsRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { ...authHeaders, 'Mcp-Session-Id': sessionId! },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 2,
        params: {},
      }),
    });
    expect(toolsRes.status).toBeLessThan(400);

    const toolsBody = await parseResponse(toolsRes) as { result?: { tools?: Array<{ name: string }> } };
    // Should have the 2 tools from config (search_docs, send_email)
    expect(toolsBody.result!.tools).toHaveLength(2);
    expect(toolsBody.result!.tools![0]!.name).toBe('search_docs');
    expect(toolsBody.result!.tools![1]!.name).toBe('send_email');
  });

  it('tools/call invokes governance evaluation', async () => {
    const mockClient = createMockClient();
    const config = createConfig({ client: mockClient });
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'call-key',
    });
    closeServer = close;

    const authHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': 'Bearer call-key',
    };

    // Initialize session
    const initRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }),
    });
    const sessionId = initRes.headers.get('mcp-session-id')!;

    // Send initialized notification
    await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { ...authHeaders, 'Mcp-Session-Id': sessionId },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    // Call a tool
    const callRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { ...authHeaders, 'Mcp-Session-Id': sessionId },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 3,
        params: { name: 'search_docs', arguments: { query: 'test' } },
      }),
    });

    expect(callRes.status).toBeLessThan(400);

    // Verify the governance client was called
    expect(mockClient.evaluate).toHaveBeenCalled();
    const evalCall = (mockClient.evaluate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(evalCall.operation).toBe('search_docs');
  });

  it('skip_governance tools bypass evaluation', async () => {
    const mockClient = createMockClient();
    const config = createConfig({
      client: mockClient,
      toolMappings: [
        { toolName: 'safe_tool', skip_governance: true },
        { toolName: 'governed_tool', data_classification: 'confidential' },
      ],
    });
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'skip-key',
    });
    closeServer = close;

    // Tools/list should only show governed tools (skip_governance tools are filtered out)
    const authHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': 'Bearer skip-key',
    };

    const initRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }),
    });
    const sessionId = initRes.headers.get('mcp-session-id')!;

    await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { ...authHeaders, 'Mcp-Session-Id': sessionId },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    const toolsRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { ...authHeaders, 'Mcp-Session-Id': sessionId },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 2, params: {} }),
    });

    const body = await parseResponse(toolsRes) as { result?: { tools?: Array<{ name: string }> } };
    // Only governed_tool should appear (safe_tool has skip_governance)
    expect(body.result!.tools).toHaveLength(1);
    expect(body.result!.tools![0]!.name).toBe('governed_tool');
  });

  it('health check reports session count', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'session-count-key',
    });
    closeServer = close;

    // Before any sessions
    const healthBefore = await fetch(`http://127.0.0.1:${port}/health`);
    const before = await healthBefore.json();
    expect(before.sessions).toBe(0);

    // Create a session
    await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer session-count-key',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }),
    });

    // After creating session
    const healthAfter = await fetch(`http://127.0.0.1:${port}/health`);
    const after = await healthAfter.json();
    expect(after.sessions).toBe(1);
  });

  it('GET /mcp without session returns 400', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'get-key',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer get-key' },
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /mcp without session returns 400', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'del-key',
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer del-key' },
    });
    expect(res.status).toBe(400);
  });

  it('custom CORS allowed origins are respected', async () => {
    const config = createConfig();
    const { port, close } = await startHttpServer(config, {
      port: 0,
      host: '127.0.0.1',
      apiKey: 'cors-key',
      allowedOrigins: ['https://myapp.com'],
    });
    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'OPTIONS',
      headers: { 'Origin': 'https://myapp.com' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://myapp.com');
  });
});
