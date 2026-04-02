import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { GovernanceMCPServerConfig } from './config.js';
import { interceptToolCall } from './tool-interceptor.js';
import { startHttpServer } from './http-server.js';
import type { Server as HttpServer } from 'node:http';

/**
 * MCP governance server that wraps an upstream MCP server and intercepts
 * tool calls for policy evaluation before forwarding.
 *
 * - tools/call: intercepted through AgentIdentityClient.evaluate()
 * - tools/list, resources/*, prompts/*: proxied directly to upstream
 */
export class GovernanceMCPServer {
  private server: Server;
  private upstreamClient: Client;
  private config: GovernanceMCPServerConfig;
  private upstreamServerName: string;

  constructor(config: GovernanceMCPServerConfig) {
    this.config = config;
    this.upstreamServerName = config.upstream?.command ?? 'upstream';

    this.server = new Server(
      { name: 'sidclaw-governance', version: '0.1.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    this.upstreamClient = new Client(
      { name: 'sidclaw-governance-client', version: '0.1.0' },
      { capabilities: {} }
    );

    if (config.introspect) {
      this.setupIntrospectHandlers();
    } else {
      this.setupHandlers();
    }
  }

  /**
   * Introspect mode: return static metadata without connecting to upstream.
   * Used by Glama and other MCP inspection tools to verify the server works.
   */
  private setupIntrospectHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'governance_proxy',
            description:
              'SidClaw MCP Governance Proxy — wraps any upstream MCP server with policy evaluation, ' +
              'human-in-the-loop approval, and tamper-evident audit trails. Configure SIDCLAW_API_KEY, ' +
              'SIDCLAW_AGENT_ID, and SIDCLAW_UPSTREAM_CMD to connect to your upstream server. ' +
              'See https://docs.sidclaw.com/docs/integrations/mcp for setup instructions.',
            inputSchema: {
              type: 'object' as const,
              properties: {
                message: {
                  type: 'string',
                  description: 'This is a placeholder tool. Configure the proxy with an upstream MCP server to use real tools.',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async () => {
      throw new McpError(
        -32001,
        'Introspect mode: tool execution is disabled. Configure SIDCLAW_API_KEY, SIDCLAW_AGENT_ID, and SIDCLAW_UPSTREAM_CMD to use the governance proxy.',
        { type: 'introspect_mode' }
      );
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: [] };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async () => {
      throw new McpError(-32001, 'Introspect mode: no resources available.');
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: [] };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async () => {
      throw new McpError(-32001, 'Introspect mode: no prompts available.');
    });
  }

  private setupHandlers(): void {
    // tools/list: proxy to upstream
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      return await this.upstreamClient.listTools(request.params);
    });

    // tools/call: intercept with governance
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: args } = request.params;

      const result = await interceptToolCall(
        toolName,
        (args ?? {}) as Record<string, unknown>,
        this.config.client!,
        this.config,
        this.upstreamServerName
      );

      if (result.action === 'error') {
        throw new McpError(
          result.error!.code,
          result.error!.message,
          result.error!.data
        );
      }

      // Forward to upstream
      try {
        const upstreamResult = await this.upstreamClient.callTool({
          name: toolName,
          arguments: args,
        });

        // Record success outcome (fire and forget)
        if (result.traceId) {
          this.config.client!.recordOutcome(result.traceId, {
            status: 'success',
            metadata: { mcp_tool: toolName },
          }).catch(() => {});
        }

        return upstreamResult;
      } catch (err) {
        // Record error outcome (fire and forget)
        if (result.traceId) {
          this.config.client!.recordOutcome(result.traceId, {
            status: 'error',
            metadata: {
              mcp_tool: toolName,
              error: err instanceof Error ? err.message : String(err),
            },
          }).catch(() => {});
        }
        throw err;
      }
    });

    // resources/list: proxy to upstream (no governance)
    this.server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
      return await this.upstreamClient.listResources(request.params);
    });

    // resources/read: proxy to upstream (no governance)
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return await this.upstreamClient.readResource(request.params);
    });

    // prompts/list: proxy to upstream (no governance)
    this.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
      return await this.upstreamClient.listPrompts(request.params);
    });

    // prompts/get: proxy to upstream (no governance)
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      return await this.upstreamClient.getPrompt(request.params);
    });
  }

  /** Connect to the upstream MCP server and start listening for agent connections on stdio. */
  async start(): Promise<void> {
    if (this.config.introspect) {
      // Introspect mode: no upstream, just start the server on stdio
      const serverTransport = new StdioServerTransport();
      await this.server.connect(serverTransport);
      return;
    }

    // Connect to upstream server
    if (this.config.upstream.transport === 'stdio') {
      if (!this.config.upstream.command) {
        throw new Error('stdio transport requires a command');
      }
      const clientTransport = new StdioClientTransport({
        command: this.config.upstream.command,
        args: this.config.upstream.args,
      });
      await this.upstreamClient.connect(clientTransport);
    } else {
      throw new Error(
        `Transport '${this.config.upstream.transport}' is not yet supported. Only 'stdio' is available.`
      );
    }

    // Start the governance server on stdio
    const serverTransport = new StdioServerTransport();
    await this.server.connect(serverTransport);
  }

  /**
   * Start the governance server in HTTP mode (Streamable HTTP transport).
   * Compatible with Microsoft Copilot Studio, GitHub Copilot, and any MCP client
   * supporting Streamable HTTP transport.
   */
  async startHttp(httpOptions: {
    port?: number;
    host?: string;
    apiKey: string;
    allowedOrigins?: string[];
  }): Promise<{ server: HttpServer; port: number; close: () => Promise<void> }> {
    return startHttpServer(this.config, httpOptions);
  }

  /** Disconnect from upstream and stop the governance server. */
  async stop(): Promise<void> {
    await this.server.close();
    await this.upstreamClient.close();
  }
}
