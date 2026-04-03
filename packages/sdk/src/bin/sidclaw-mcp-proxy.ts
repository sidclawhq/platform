#!/usr/bin/env node

/**
 * SidClaw MCP Governance Proxy
 *
 * Wraps any MCP server with SidClaw policy evaluation.
 * Supports two transport modes:
 *
 *   stdio (default) — for OpenClaw, Claude Desktop, Cursor
 *   http            — for Microsoft Copilot Studio, GitHub Copilot, VS Code
 *
 * Configuration via environment variables:
 *   SIDCLAW_API_KEY      — SidClaw API key (required)
 *   SIDCLAW_API_URL      — SidClaw API URL (default: https://api.sidclaw.com)
 *   SIDCLAW_AGENT_ID     — Agent ID in SidClaw (required)
 *   SIDCLAW_UPSTREAM_CMD — Command to start the upstream MCP server (required for stdio)
 *   SIDCLAW_UPSTREAM_ARGS — Comma-separated args for upstream command (optional)
 *   SIDCLAW_DEFAULT_CLASSIFICATION — Default data classification (default: internal)
 *   SIDCLAW_TOOL_MAPPINGS — JSON string of tool mappings (optional)
 *   SIDCLAW_APPROVAL_MODE — 'error' or 'block' (default: error)
 *   SIDCLAW_TRANSPORT    — 'stdio' or 'http' (default: stdio, overridden by --transport)
 *   SIDCLAW_PORT         — HTTP port (default: 8080, overridden by --port)
 */

import { AgentIdentityClient } from '../client/agent-identity-client.js';
import { GovernanceMCPServer } from '../mcp/governance-server.js';
import type { ToolMapping } from '../mcp/config.js';
import type { DataClassification } from '@sidclaw/shared';

function parseArgs(): { transport: 'stdio' | 'http'; port: number; introspect: boolean } {
  const args = process.argv.slice(2);
  let transport: 'stdio' | 'http' = (process.env['SIDCLAW_TRANSPORT'] as 'stdio' | 'http') ?? 'stdio';
  let port = parseInt(process.env['SIDCLAW_PORT'] ?? '8080', 10);
  let introspect = process.env['SIDCLAW_INTROSPECT'] === 'true';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--transport' && args[i + 1]) {
      const val = args[i + 1]!;
      if (val === 'http' || val === 'stdio') transport = val;
      else { console.error(`Error: --transport must be 'stdio' or 'http', got '${val}'`); process.exit(1); }
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1]!, 10);
      if (isNaN(port)) { console.error('Error: --port must be a number'); process.exit(1); }
      i++;
    } else if (args[i] === '--introspect') {
      introspect = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.error('Usage: sidclaw-mcp-proxy [--transport stdio|http] [--port 8080] [--introspect]');
      console.error('');
      console.error('Modes:');
      console.error('  stdio (default)  Local proxy for Claude Desktop, Cursor, OpenClaw');
      console.error('  http             Remote server for Copilot Studio, GitHub Copilot, VS Code');
      console.error('  --introspect     Return static metadata without upstream (for MCP inspection tools)');
      console.error('');
      console.error('Environment variables:');
      console.error('  SIDCLAW_API_KEY, SIDCLAW_AGENT_ID, SIDCLAW_API_URL,');
      console.error('  SIDCLAW_UPSTREAM_CMD, SIDCLAW_UPSTREAM_ARGS,');
      console.error('  SIDCLAW_TOOL_MAPPINGS, SIDCLAW_DEFAULT_CLASSIFICATION,');
      console.error('  SIDCLAW_APPROVAL_MODE, SIDCLAW_TRANSPORT, SIDCLAW_PORT,');
      console.error('  SIDCLAW_INTROSPECT');
      process.exit(0);
    }
  }

  return { transport, port, introspect };
}

async function main() {
  const { transport, port, introspect } = parseArgs();

  // Introspect mode: skip ALL validation and client creation.
  // Returns static metadata for MCP inspection tools (Glama, registries).
  if (introspect) {
    console.error('[SidClaw] Introspect mode — no credentials, no upstream, static metadata only');
    const server = new GovernanceMCPServer({
      client: null,
      introspect: true,
      upstream: { transport: 'stdio' },
    });
    await server.start();
    console.error('[SidClaw] Introspect server running on stdio');
    return;
  }

  const apiKey = process.env['SIDCLAW_API_KEY'];
  const apiUrl = process.env['SIDCLAW_API_URL'] ?? 'https://api.sidclaw.com';
  const agentId = process.env['SIDCLAW_AGENT_ID'];
  const upstreamCmd = process.env['SIDCLAW_UPSTREAM_CMD'];
  const upstreamArgsRaw = process.env['SIDCLAW_UPSTREAM_ARGS'] ?? '';
  const defaultClassification = (process.env['SIDCLAW_DEFAULT_CLASSIFICATION'] ?? 'internal') as DataClassification;
  const toolMappingsRaw = process.env['SIDCLAW_TOOL_MAPPINGS'];
  const approvalMode = (process.env['SIDCLAW_APPROVAL_MODE'] ?? 'error') as 'error' | 'block';

  if (!apiKey) {
    console.error('Error: SIDCLAW_API_KEY is required');
    console.error('Get your API key at https://app.sidclaw.com/dashboard/settings/api-keys');
    process.exit(1);
  }
  if (!agentId) {
    console.error('Error: SIDCLAW_AGENT_ID is required');
    console.error('Register your agent at https://app.sidclaw.com/dashboard/agents');
    process.exit(1);
  }

  // stdio mode requires upstream command
  if (transport === 'stdio' && !upstreamCmd) {
    console.error('Error: SIDCLAW_UPSTREAM_CMD is required for stdio transport');
    console.error('Set the command to start your upstream MCP server (e.g., "npx")');
    console.error('');
    console.error('For HTTP mode (Copilot Studio, GitHub Copilot), use:');
    console.error('  sidclaw-mcp-proxy --transport http --port 8080');
    process.exit(1);
  }

  const upstreamArgs = upstreamArgsRaw ? upstreamArgsRaw.split(',').map(a => a.trim()) : [];

  let toolMappings: ToolMapping[] | undefined;
  if (toolMappingsRaw) {
    try {
      toolMappings = JSON.parse(toolMappingsRaw);
    } catch {
      console.error('Error: SIDCLAW_TOOL_MAPPINGS must be valid JSON');
      process.exit(1);
    }
  }

  const client = new AgentIdentityClient({
    apiKey,
    apiUrl,
    agentId,
    maxRetries: 2,
  });

  const server = new GovernanceMCPServer({
    client,
    upstream: {
      transport: 'stdio',
      command: upstreamCmd ?? 'echo',
      args: upstreamCmd ? upstreamArgs : [],
    },
    toolMappings,
    defaultDataClassification: defaultClassification,
    approvalWaitMode: approvalMode,
    approvalBlockTimeoutMs: 30000,
  });

  if (transport === 'http') {
    // HTTP mode — serve Streamable HTTP transport
    console.error(`[SidClaw] Starting HTTP MCP governance proxy`);
    console.error(`[SidClaw] Agent: ${agentId}`);
    console.error(`[SidClaw] API: ${apiUrl}`);
    console.error(`[SidClaw] Approval mode: ${approvalMode}`);

    try {
      const { port: actualPort } = await server.startHttp({
        port,
        apiKey,
        host: '0.0.0.0',
      });

      console.error(`[SidClaw] HTTP MCP server listening on port ${actualPort}`);
      console.error(`[SidClaw] MCP endpoint: http://0.0.0.0:${actualPort}/mcp`);
      console.error(`[SidClaw] Health check: http://0.0.0.0:${actualPort}/health`);
      console.error(`[SidClaw] Auth: Bearer token required (use your SidClaw API key)`);
    } catch (error) {
      console.error('[SidClaw] Failed to start HTTP server:', error);
      process.exit(1);
    }
  } else {
    // stdio mode — existing behavior
    console.error(`[SidClaw] Governance proxy starting`);
    console.error(`[SidClaw] Agent: ${agentId}`);
    console.error(`[SidClaw] Upstream: ${upstreamCmd} ${upstreamArgs.join(' ')}`);
    console.error(`[SidClaw] API: ${apiUrl}`);
    console.error(`[SidClaw] Approval mode: ${approvalMode}`);
    console.error(`[SidClaw] Every tool call will be evaluated against your SidClaw policies`);

    try {
      await server.start();
    } catch (error) {
      console.error('[SidClaw] Failed to start governance proxy:', error);
      process.exit(1);
    }
  }
}

main();
