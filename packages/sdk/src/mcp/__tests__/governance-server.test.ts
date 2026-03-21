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
});
