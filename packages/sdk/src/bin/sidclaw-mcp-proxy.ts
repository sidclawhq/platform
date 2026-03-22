#!/usr/bin/env node

/**
 * SidClaw MCP Governance Proxy
 *
 * Wraps any MCP server with SidClaw policy evaluation.
 * Intended for use as an MCP server entry point in OpenClaw, Claude Desktop,
 * Cursor, or any MCP-compatible client.
 *
 * Configuration via environment variables:
 *   SIDCLAW_API_KEY      — SidClaw API key (required)
 *   SIDCLAW_API_URL      — SidClaw API URL (default: https://api.sidclaw.com)
 *   SIDCLAW_AGENT_ID     — Agent ID in SidClaw (required)
 *   SIDCLAW_UPSTREAM_CMD — Command to start the upstream MCP server (required)
 *   SIDCLAW_UPSTREAM_ARGS — Comma-separated args for upstream command (optional)
 *   SIDCLAW_DEFAULT_CLASSIFICATION — Default data classification (default: internal)
 *   SIDCLAW_TOOL_MAPPINGS — JSON string of tool mappings (optional)
 *   SIDCLAW_APPROVAL_MODE — 'error' or 'block' (default: error)
 */

import { AgentIdentityClient } from '../client/agent-identity-client.js';
import { GovernanceMCPServer } from '../mcp/governance-server.js';
import type { ToolMapping } from '../mcp/config.js';
import type { DataClassification } from '@sidclaw/shared';

async function main() {
  const apiKey = process.env.SIDCLAW_API_KEY;
  const apiUrl = process.env.SIDCLAW_API_URL ?? 'https://api.sidclaw.com';
  const agentId = process.env.SIDCLAW_AGENT_ID;
  const upstreamCmd = process.env.SIDCLAW_UPSTREAM_CMD;
  const upstreamArgsRaw = process.env.SIDCLAW_UPSTREAM_ARGS ?? '';
  const defaultClassification = (process.env.SIDCLAW_DEFAULT_CLASSIFICATION ?? 'internal') as DataClassification;
  const toolMappingsRaw = process.env.SIDCLAW_TOOL_MAPPINGS;
  const approvalMode = (process.env.SIDCLAW_APPROVAL_MODE ?? 'error') as 'error' | 'block';

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
  if (!upstreamCmd) {
    console.error('Error: SIDCLAW_UPSTREAM_CMD is required');
    console.error('Set the command to start your upstream MCP server (e.g., "npx")');
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
      command: upstreamCmd,
      args: upstreamArgs,
    },
    toolMappings,
    defaultDataClassification: defaultClassification,
    approvalWaitMode: approvalMode,
    approvalBlockTimeoutMs: 30000,
  });

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

main();
