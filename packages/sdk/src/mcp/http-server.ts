/**
 * HTTP server for the MCP governance proxy.
 *
 * Exposes a Streamable HTTP transport (MCP spec 2025-03-26) at /mcp
 * with API key authentication. Compatible with:
 *   - Microsoft Copilot Studio (Streamable HTTP + API key auth)
 *   - GitHub Copilot / VS Code (http transport type)
 *   - Any MCP client supporting Streamable HTTP
 */

import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { GovernanceMCPServerConfig } from './config.js';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import { interceptToolCall } from './tool-interceptor.js';

export interface HttpServerOptions {
  /** Port to listen on (default: 8080). */
  port?: number;
  /** Host to bind to (default: '0.0.0.0'). */
  host?: string;
  /** API key required for authentication. Connections without a valid key are rejected with 401. */
  apiKey: string;
  /** CORS allowed origins (default: ['*']). */
  allowedOrigins?: string[];
}

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: Server;
}

/**
 * Starts an HTTP server that serves the MCP governance proxy over Streamable HTTP transport.
 * Each session gets its own MCP Server + Transport pair.
 */
export async function startHttpServer(
  config: GovernanceMCPServerConfig,
  options: HttpServerOptions,
): Promise<{ server: HttpServer; port: number; close: () => Promise<void> }> {
  const port = options.port ?? 8080;
  const host = options.host ?? '0.0.0.0';
  const allowedOrigins = options.allowedOrigins ?? ['*'];

  const sessions = new Map<string, SessionEntry>();

  /** Create a new MCP Server with governance handlers wired up. */
  function createGovernanceServer(upstreamServerName: string): Server {
    const server = new Server(
      { name: 'sidclaw-governance', version: '0.1.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } },
    );

    // tools/list: return tool definitions from tool mappings (no upstream in HTTP mode)
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      // In HTTP mode without upstream, tools are defined by toolMappings.
      // Each tool accepts a free-form JSON object (additionalProperties: true)
      // since we don't know the upstream schema.
      const tools = (config.toolMappings ?? [])
        .filter(m => !m.skip_governance)
        .map(m => ({
          name: m.operation ?? m.toolName,
          description: `Governed tool: ${m.toolName} (${m.data_classification ?? config.defaultDataClassification ?? 'internal'} classification)`,
          inputSchema: {
            type: 'object' as const,
            properties: {
              input: { type: 'string', description: 'Input for the tool' },
            },
            additionalProperties: true,
          },
        }));
      return { tools };
    });

    // tools/call: intercept with governance
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: args } = request.params;

      const result = await interceptToolCall(
        toolName,
        (args ?? {}) as Record<string, unknown>,
        config.client!,
        config,
        upstreamServerName,
      );

      if (result.action === 'error') {
        throw new McpError(
          result.error!.code,
          result.error!.message,
          result.error!.data,
        );
      }

      // In HTTP mode without upstream, return a success message
      // (the governance evaluation itself is the action)
      if (result.traceId) {
        config.client!.recordOutcome(result.traceId, {
          status: 'success',
          metadata: { mcp_tool: toolName },
        }).catch((err: unknown) => {
          console.error('[SidClaw] Failed to record outcome:', err instanceof Error ? err.message : err);
        });
      }

      return {
        content: [
          { type: 'text', text: `Action "${toolName}" allowed by governance policy.` },
        ],
      };
    });

    // resources/list: empty in HTTP standalone mode
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
    server.setRequestHandler(ReadResourceRequestSchema, async () => ({ contents: [] }));
    server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
    server.setRequestHandler(GetPromptRequestSchema, async () => ({
      messages: [{ role: 'user', content: { type: 'text', text: '' } }],
    }));

    return server;
  }

  /** Validate the Authorization header. */
  function authenticate(req: IncomingMessage): boolean {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return false;

    // Support "Bearer <key>" format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7) === options.apiKey;
    }

    return authHeader === options.apiKey;
  }

  /** Set CORS headers. */
  function setCorsHeaders(res: ServerResponse, origin?: string): void {
    const allowed = allowedOrigins.includes('*')
      ? '*'
      : (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Origin', allowed ?? '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  /** Read the request body as a parsed JSON object. */
  function readBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const MAX_BODY = 4 * 1024 * 1024; // 4 MB

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY) {
          reject(new Error('Request body too large'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve(body ? JSON.parse(body) : undefined);
        } catch {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase() ?? 'GET';
    const origin = req.headers['origin'] as string | undefined;

    setCorsHeaders(res, origin);

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'sidclaw-mcp-proxy',
        transport: 'streamable-http',
        sessions: sessions.size,
      });
      return;
    }

    // Only /mcp handled from here
    if (pathname !== '/mcp') {
      sendJson(res, 404, { error: 'Not found. MCP endpoint is at /mcp' });
      return;
    }

    // Authenticate
    if (!authenticate(req)) {
      sendJson(res, 401, {
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: valid API key required in Authorization header' },
        id: null,
      });
      return;
    }

    try {
      if (method === 'POST') {
        const body = await readBody(req);
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        if (sessionId && sessions.has(sessionId)) {
          // Existing session
          const session = sessions.get(sessionId)!;
          await session.transport.handleRequest(req, res, body);
        } else if (!sessionId && isInitializeRequest(body)) {
          // New session — track by ID once initialized, clean up on close
          let trackedSessionId: string | undefined;
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid: string) => {
              trackedSessionId = sid;
              sessions.set(sid, { transport, server: mcpServer });
            },
          });

          transport.onclose = () => {
            // Use tracked ID (set by onsessioninitialized) as primary,
            // fall back to transport.sessionId
            const sid = trackedSessionId ?? transport.sessionId;
            if (sid) sessions.delete(sid);
          };

          const mcpServer = createGovernanceServer('http-proxy');
          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, body);
        } else {
          sendJson(res, 400, {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: missing or invalid session ID' },
            id: null,
          });
        }
      } else if (method === 'GET') {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !sessions.has(sessionId)) {
          sendJson(res, 400, { error: 'Invalid or missing Mcp-Session-Id header' });
          return;
        }
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
      } else if (method === 'DELETE') {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !sessions.has(sessionId)) {
          sendJson(res, 400, { error: 'Invalid or missing Mcp-Session-Id header' });
          return;
        }
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
      } else {
        res.writeHead(405);
        res.end('Method Not Allowed');
      }
    } catch (error) {
      console.error('[SidClaw] Error handling MCP request:', error);
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  return new Promise((resolve, reject) => {
    httpServer.on('error', reject);
    httpServer.listen(port, host, () => {
      const actualPort = (httpServer.address() as AddressInfo).port;
      resolve({
        server: httpServer,
        port: actualPort,
        close: async () => {
          // Close all active sessions
          for (const [sid, session] of sessions) {
            try {
              await session.transport.close();
              await session.server.close();
            } catch {
              // ignore cleanup errors
            }
            sessions.delete(sid);
          }
          return new Promise<void>((res, rej) => {
            httpServer.close((err) => (err ? rej(err) : res()));
          });
        },
      });
    });
  });
}
