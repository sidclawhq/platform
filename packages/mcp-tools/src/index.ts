import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SidClawClient } from './client.js';
import { handleToolCall, TOOL_DEFINITIONS } from './tools.js';
import { readResource, RESOURCE_DEFINITIONS } from './resources.js';
// Read package version at build time so the MCP server announces the
// correct version without hardcoding. tsup inlines this JSON import.
import pkg from '../package.json' with { type: 'json' };

export const MCP_TOOLS_VERSION: string = pkg.version;

export interface SidClawMcpToolsServerConfig {
  baseUrl: string;
  apiKey: string;
  defaultAgentId?: string;
  name?: string;
  version?: string;
}

/**
 * MCP server that exposes SidClaw governance primitives as callable tools
 * and readable resources. Use with Claude Code, Claude Desktop, or any
 * MCP-compatible host.
 */
export class SidClawMcpToolsServer {
  readonly server: Server;
  private client: SidClawClient;
  private defaultAgentId: string;

  constructor(config: SidClawMcpToolsServerConfig) {
    if (!config.baseUrl) throw new Error('SidClawMcpToolsServer requires baseUrl');
    if (!config.apiKey) throw new Error('SidClawMcpToolsServer requires apiKey');

    this.client = new SidClawClient({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    this.defaultAgentId = config.defaultAgentId ?? 'claude-code';

    this.server = new Server(
      {
        name: config.name ?? 'sidclaw-mcp-tools',
        version: config.version ?? MCP_TOOLS_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    this.wireHandlers();
  }

  private wireHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return handleToolCall(this.client, this.defaultAgentId, name, args ?? {});
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: RESOURCE_DEFINITIONS.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return readResource(this.client, request.params.uri);
    });
  }

  async connect(transport: Transport) {
    await this.server.connect(transport);
  }
}

export { TOOL_DEFINITIONS, RESOURCE_DEFINITIONS };
export { SidClawClient, SidClawApiError } from './client.js';
