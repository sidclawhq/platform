#!/usr/bin/env node
/**
 * Binary entry for `npx @sidclaw/mcp-tools`.
 *
 * Starts the SidClawMcpToolsServer over stdio. Required env:
 *   SIDCLAW_BASE_URL   — SidClaw instance URL
 *   SIDCLAW_API_KEY    — API key
 *
 * Optional:
 *   SIDCLAW_AGENT_ID   — default agent (default: "claude-code")
 *   SIDCLAW_MCP_NAME   — server name advertised to MCP clients
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SidClawMcpToolsServer } from './index.js';

async function main() {
  const baseUrl = process.env.SIDCLAW_BASE_URL;
  const apiKey = process.env.SIDCLAW_API_KEY;

  if (!baseUrl || !apiKey) {
    console.error(
      'SidClaw MCP tools server: SIDCLAW_BASE_URL and SIDCLAW_API_KEY are required.',
    );
    process.exit(1);
  }

  const server = new SidClawMcpToolsServer({
    baseUrl,
    apiKey,
    defaultAgentId: process.env.SIDCLAW_AGENT_ID ?? 'claude-code',
    name: process.env.SIDCLAW_MCP_NAME ?? 'sidclaw-mcp-tools',
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stdio transport keeps the process alive.
}

main().catch((err) => {
  console.error('sidclaw-mcp-tools failed to start:', err);
  process.exit(1);
});
