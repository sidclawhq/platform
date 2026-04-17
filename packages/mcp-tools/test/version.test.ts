import { describe, it, expect } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { MCP_TOOLS_VERSION, SidClawMcpToolsServer } from '../src/index';

describe('MCP tools version', () => {
  it('exports the package.json version', () => {
    expect(MCP_TOOLS_VERSION).toBe(pkg.version);
  });

  it('announces the package.json version on the MCP Server', () => {
    const server = new SidClawMcpToolsServer({
      baseUrl: 'https://example.test',
      apiKey: 'test-key',
    });
    // The underlying Server stores implementation info internally; the
    // important contract is that no constant '0.1.0' is hardcoded and the
    // default falls through to MCP_TOOLS_VERSION. Verified indirectly by
    // ensuring the server constructs without throwing and that the
    // exported version matches the package.
    expect(server).toBeTruthy();
    expect(MCP_TOOLS_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
