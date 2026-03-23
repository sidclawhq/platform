import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startHttpServer } from '../http-server.js';
import type { GovernanceMCPServerConfig } from '../config.js';
import type { AgentIdentityClient } from '../../client/agent-identity-client.js';

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
});
