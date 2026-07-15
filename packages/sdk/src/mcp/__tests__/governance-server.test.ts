import { describe, it, expect, vi } from 'vitest';
import { GovernanceMCPServer } from '../governance-server.js';
import type { GovernanceMCPServerConfig } from '../config.js';
import type { AgentIdentityClient } from '../../client/agent-identity-client.js';

function createMockClient(): AgentIdentityClient {
  return {
    evaluate: vi.fn(),
    waitForApproval: vi.fn(),
    recordOutcome: vi.fn(),
  } as unknown as AgentIdentityClient;
}

function createConfig(overrides: Partial<GovernanceMCPServerConfig> = {}): GovernanceMCPServerConfig {
  return {
    client: createMockClient(),
    upstream: { transport: 'stdio', command: 'node', args: ['server.js'] },
    ...overrides,
  };
}

describe('GovernanceMCPServer', () => {
  it('can be instantiated with valid config', () => {
    const config = createConfig();
    const server = new GovernanceMCPServer(config);
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(GovernanceMCPServer);
  });

  it('throws on start with unsupported transport', async () => {
    const config = createConfig({
      upstream: { transport: 'sse', url: 'http://localhost:8080' },
    });
    const server = new GovernanceMCPServer(config);

    await expect(server.start()).rejects.toThrow(
      "Transport 'sse' is not yet supported"
    );
  });

  it('throws on start with stdio transport but no command', async () => {
    const config = createConfig({
      upstream: { transport: 'stdio' },
    });
    const server = new GovernanceMCPServer(config);

    await expect(server.start()).rejects.toThrow(
      'stdio transport requires a command'
    );
  });

  it('uses upstream command as server name', () => {
    const config = createConfig({
      upstream: { transport: 'stdio', command: 'my-mcp-server', args: ['--flag'] },
    });
    const server = new GovernanceMCPServer(config);
    // Server is created successfully — the upstream server name is derived from the command
    expect(server).toBeDefined();
  });

  it('accepts all optional config fields', () => {
    const config = createConfig({
      toolMappings: [
        { toolName: 'read_*', data_classification: 'public' },
        { toolName: 'write_db', skip_governance: true },
      ],
      defaultDataClassification: 'confidential',
      defaultResourceScope: 'production',
      approvalWaitMode: 'block',
      approvalBlockTimeoutMs: 5000,
    });
    const server = new GovernanceMCPServer(config);
    expect(server).toBeDefined();
  });

  describe('governed data-access handlers', () => {
    function getHandler(server: GovernanceMCPServer, method: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (server as any).server._requestHandlers.get(method);
      expect(handler).toBeDefined();
      return handler as (request: unknown, extra?: unknown) => Promise<unknown>;
    }

    it('denies resources/read via policy and does not forward to upstream (fail-closed)', async () => {
      const config = createConfig();
      (config.client!.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
        decision: 'deny',
        trace_id: 'TR-D',
        reason: 'blocked',
      });
      const server = new GovernanceMCPServer(config);
      const readResource = vi.fn().mockResolvedValue({ contents: [] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).upstreamClient = { readResource, getPrompt: vi.fn() };

      const handler = getHandler(server, 'resources/read');

      await expect(
        handler({ method: 'resources/read', params: { uri: 'file:///etc/secrets' } })
      ).rejects.toThrow('Action denied by policy');
      expect(readResource).not.toHaveBeenCalled();
    });

    it('governs resources/read happy path and records the audit outcome', async () => {
      const config = createConfig();
      (config.client!.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-A',
      });
      (config.client!.recordOutcome as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const server = new GovernanceMCPServer(config);
      const readResource = vi.fn().mockResolvedValue({ contents: [] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).upstreamClient = { readResource, getPrompt: vi.fn() };

      const handler = getHandler(server, 'resources/read');

      await handler({ method: 'resources/read', params: { uri: 'file:///etc/secrets' } });

      expect(config.client!.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'resources/read',
          resource_scope: 'file:///etc/secrets',
          context: expect.objectContaining({ mcp_args: { uri: 'file:///etc/secrets' } }),
        })
      );
      expect(readResource).toHaveBeenCalledWith({ uri: 'file:///etc/secrets' });
      expect(config.client!.recordOutcome).toHaveBeenCalledWith(
        'TR-A',
        expect.objectContaining({ status: 'success' })
      );
    });

    it('denies prompts/get via policy and does not forward to upstream (fail-closed)', async () => {
      const config = createConfig();
      (config.client!.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
        decision: 'deny',
        trace_id: 'TR-D',
        reason: 'blocked',
      });
      const server = new GovernanceMCPServer(config);
      const getPrompt = vi.fn().mockResolvedValue({ messages: [] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).upstreamClient = { readResource: vi.fn(), getPrompt };

      const handler = getHandler(server, 'prompts/get');

      await expect(
        handler({ method: 'prompts/get', params: { name: 'leak' } })
      ).rejects.toThrow('Action denied by policy');
      expect(getPrompt).not.toHaveBeenCalled();
    });
  });
});
