# MCP Governance Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP governance server that wraps any existing MCP server, intercepts tool calls for policy evaluation, and proxies everything else through.

**Architecture:** The governance server sits between an AI agent and an upstream MCP server. It uses `@modelcontextprotocol/sdk` v1.27.1's low-level `Server` class (with `setRequestHandler`) to accept agent connections, and `Client` class to connect to the upstream server. Tool calls go through `interceptToolCall` which calls `AgentIdentityClient.evaluate()` before forwarding. Resources and prompts are proxied without governance.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` v1.27.1, Vitest

---

### Task 1: Configuration Types

**Files:**
- Create: `packages/sdk/src/mcp/config.ts`

- [ ] **Step 1: Create config.ts with GovernanceMCPServerConfig and ToolMapping interfaces**

```typescript
// packages/sdk/src/mcp/config.ts
import type { DataClassification } from '@sidclaw/shared';

export interface GovernanceMCPServerConfig {
  client: import('../client/agent-identity-client.js').AgentIdentityClient;
  upstream: {
    transport: 'stdio' | 'sse' | 'streamable-http';
    command?: string;
    args?: string[];
    url?: string;
  };
  toolMappings?: ToolMapping[];
  defaultDataClassification?: DataClassification;
  defaultResourceScope?: string;
  approvalWaitMode?: 'error' | 'block';
  approvalBlockTimeoutMs?: number;
}

export interface ToolMapping {
  toolName: string;
  operation?: string;
  target_integration?: string;
  resource_scope?: string;
  data_classification?: DataClassification;
  skip_governance?: boolean;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/sdk && npx tsc --noEmit src/mcp/config.ts 2>&1 || echo "check manually"`

---

### Task 2: Tool Mapper + Tests (TDD)

**Files:**
- Create: `packages/sdk/src/mcp/tool-mapper.ts`
- Create: `packages/sdk/src/mcp/__tests__/tool-mapper.test.ts`

- [ ] **Step 1: Write failing tests for findMapping and deriveResourceScope**

```typescript
// packages/sdk/src/mcp/__tests__/tool-mapper.test.ts
import { describe, it, expect } from 'vitest';
import { findMapping, deriveResourceScope } from '../tool-mapper.js';
import type { ToolMapping } from '../config.js';

describe('findMapping', () => {
  const mappings: ToolMapping[] = [
    { toolName: 'query', operation: 'database_query', data_classification: 'confidential' },
    { toolName: 'db_*', data_classification: 'internal' },
    { toolName: '*_query', resource_scope: 'queries' },
    { toolName: 'list_tables', skip_governance: true },
  ];

  it('exact match on tool name', () => {
    const result = findMapping('query', mappings);
    expect(result).toBeDefined();
    expect(result!.operation).toBe('database_query');
  });

  it('glob match with trailing wildcard (db_*)', () => {
    const result = findMapping('db_insert', mappings);
    expect(result).toBeDefined();
    expect(result!.data_classification).toBe('internal');
  });

  it('glob match with leading wildcard (*_query)', () => {
    const result = findMapping('slow_query', mappings);
    expect(result).toBeDefined();
    expect(result!.resource_scope).toBe('queries');
  });

  it('returns undefined when no mapping matches', () => {
    const result = findMapping('unknown_tool', mappings);
    expect(result).toBeUndefined();
  });

  it('exact match takes precedence over glob', () => {
    const result = findMapping('list_tables', mappings);
    expect(result).toBeDefined();
    expect(result!.skip_governance).toBe(true);
  });
});

describe('deriveResourceScope', () => {
  it('returns path arg if present', () => {
    expect(deriveResourceScope('tool', { path: '/etc/config' })).toBe('/etc/config');
  });

  it('returns table arg if present', () => {
    expect(deriveResourceScope('tool', { table: 'users' })).toBe('users');
  });

  it('returns database arg if present', () => {
    expect(deriveResourceScope('tool', { database: 'mydb' })).toBe('mydb');
  });

  it('prefers earlier scopeKeys (path over table)', () => {
    expect(deriveResourceScope('tool', { table: 'users', path: '/data' })).toBe('/data');
  });

  it('returns tool name as fallback', () => {
    expect(deriveResourceScope('my_tool', { count: 5 })).toBe('my_tool');
  });

  it('ignores non-string args', () => {
    expect(deriveResourceScope('tool', { path: 123, file: null })).toBe('tool');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk && npx vitest run src/mcp/__tests__/tool-mapper.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement tool-mapper.ts**

```typescript
// packages/sdk/src/mcp/tool-mapper.ts
import type { ToolMapping } from './config.js';

/**
 * Matches a tool name against a ToolMapping using glob-like patterns.
 * Supports: exact match, trailing wildcard ("db_*"), leading wildcard ("*_query").
 */
export function findMapping(toolName: string, mappings: ToolMapping[]): ToolMapping | undefined {
  const exact = mappings.find(m => m.toolName === toolName);
  if (exact) return exact;

  for (const mapping of mappings) {
    if (mapping.toolName.includes('*')) {
      const regex = new RegExp('^' + mapping.toolName.replace(/\*/g, '.*') + '$');
      if (regex.test(toolName)) return mapping;
    }
  }

  return undefined;
}

/**
 * Derives resource_scope from tool arguments when no explicit mapping exists.
 */
export function deriveResourceScope(toolName: string, args: Record<string, unknown>): string {
  const scopeKeys = ['path', 'file', 'table', 'database', 'collection', 'bucket', 'resource', 'url', 'endpoint'];
  for (const key of scopeKeys) {
    if (typeof args[key] === 'string') return args[key] as string;
  }
  return toolName;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk && npx vitest run src/mcp/__tests__/tool-mapper.test.ts`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/mcp/config.ts packages/sdk/src/mcp/tool-mapper.ts packages/sdk/src/mcp/__tests__/tool-mapper.test.ts
git commit -m "feat(sdk): add MCP tool mapper with glob pattern matching"
```

---

### Task 3: Tool Interceptor + Tests (TDD)

**Files:**
- Create: `packages/sdk/src/mcp/tool-interceptor.ts`
- Create: `packages/sdk/src/mcp/__tests__/tool-interceptor.test.ts`

- [ ] **Step 1: Write failing tests for interceptToolCall**

```typescript
// packages/sdk/src/mcp/__tests__/tool-interceptor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interceptToolCall } from '../tool-interceptor.js';
import type { GovernanceMCPServerConfig } from '../config.js';
import type { AgentIdentityClient } from '../../client/agent-identity-client.js';

function createMockClient(overrides: Record<string, unknown> = {}): AgentIdentityClient {
  return {
    evaluate: vi.fn(),
    waitForApproval: vi.fn(),
    recordOutcome: vi.fn(),
    ...overrides,
  } as unknown as AgentIdentityClient;
}

function createConfig(overrides: Partial<GovernanceMCPServerConfig> = {}): GovernanceMCPServerConfig {
  return {
    client: createMockClient(),
    upstream: { transport: 'stdio', command: 'node', args: ['server.js'] },
    ...overrides,
  };
}

describe('interceptToolCall', () => {
  it('returns forward action when policy allows', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-001',
        reason: 'Policy allows',
        policy_rule_id: 'rule-1',
      }),
    });
    const config = createConfig({ client });

    const result = await interceptToolCall('read_file', { path: '/tmp' }, client, config, 'test-server');

    expect(result.action).toBe('forward');
    expect(result.traceId).toBe('TR-001');
    expect(result.error).toBeUndefined();
  });

  it('returns error with structured data when policy denies', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'deny',
        trace_id: 'TR-002',
        reason: 'Blocked by policy',
        policy_rule_id: 'rule-2',
      }),
    });
    const config = createConfig({ client });

    const result = await interceptToolCall('delete_all', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.traceId).toBe('TR-002');
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe(-32001);
    expect(result.error!.data).toMatchObject({
      type: 'action_denied',
      trace_id: 'TR-002',
      reason: 'Blocked by policy',
      policy_rule_id: 'rule-2',
    });
  });

  it('returns error with approval_request_id when approval_required (error mode)', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-003',
        reason: 'Needs approval',
        policy_rule_id: 'rule-3',
        approval_request_id: 'apr-001',
      }),
    });
    const config = createConfig({ client, approvalWaitMode: 'error' });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.error!.data).toMatchObject({
      type: 'approval_required',
      trace_id: 'TR-003',
      approval_request_id: 'apr-001',
    });
  });

  it('blocks and returns forward when approval granted (block mode)', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-004',
        reason: 'Needs approval',
        policy_rule_id: 'rule-4',
        approval_request_id: 'apr-002',
      }),
      waitForApproval: vi.fn().mockResolvedValue({
        id: 'apr-002',
        status: 'approved',
        decided_at: '2026-03-21T00:00:00Z',
        approver_name: 'admin',
        decision_note: 'Looks good',
      }),
    });
    const config = createConfig({ client, approvalWaitMode: 'block', approvalBlockTimeoutMs: 5000 });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('forward');
    expect(result.traceId).toBe('TR-004');
    expect(client.waitForApproval).toHaveBeenCalledWith('apr-002', {
      timeout: 5000,
      pollInterval: 1000,
    });
  });

  it('blocks and returns error when approval denied (block mode)', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-005',
        reason: 'Needs approval',
        policy_rule_id: 'rule-5',
        approval_request_id: 'apr-003',
      }),
      waitForApproval: vi.fn().mockResolvedValue({
        id: 'apr-003',
        status: 'denied',
        decided_at: '2026-03-21T00:00:00Z',
        approver_name: 'admin',
        decision_note: 'Too risky',
      }),
    });
    const config = createConfig({ client, approvalWaitMode: 'block' });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.error!.message).toContain('denied');
    expect(result.error!.data).toMatchObject({
      type: 'approval_denied',
      trace_id: 'TR-005',
      approval_request_id: 'apr-003',
    });
  });

  it('blocks and returns timeout error when approval times out (block mode)', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'approval_required',
        trace_id: 'TR-006',
        reason: 'Needs approval',
        policy_rule_id: 'rule-6',
        approval_request_id: 'apr-004',
      }),
      waitForApproval: vi.fn().mockRejectedValue(new Error('Timeout')),
    });
    const config = createConfig({ client, approvalWaitMode: 'block', approvalBlockTimeoutMs: 1000 });

    const result = await interceptToolCall('write_db', {}, client, config, 'test-server');

    expect(result.action).toBe('error');
    expect(result.error!.data).toMatchObject({
      type: 'approval_required',
      trace_id: 'TR-006',
      approval_request_id: 'apr-004',
    });
  });

  it('skips governance for tools with skip_governance mapping', async () => {
    const client = createMockClient();
    const config = createConfig({
      client,
      toolMappings: [{ toolName: 'list_tables', skip_governance: true }],
    });

    const result = await interceptToolCall('list_tables', {}, client, config, 'test-server');

    expect(result.action).toBe('forward');
    expect(client.evaluate).not.toHaveBeenCalled();
  });

  it('uses tool mapping overrides for operation/integration/scope/classification', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-007',
        reason: 'OK',
        policy_rule_id: 'rule-7',
      }),
    });
    const config = createConfig({
      client,
      toolMappings: [{
        toolName: 'query',
        operation: 'database_query',
        target_integration: 'postgres',
        resource_scope: 'production_db',
        data_classification: 'confidential',
      }],
    });

    await interceptToolCall('query', { sql: 'SELECT 1' }, client, config, 'test-server');

    expect(client.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'database_query',
      target_integration: 'postgres',
      resource_scope: 'production_db',
      data_classification: 'confidential',
    }));
  });

  it('falls back to defaults when no mapping exists', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-008',
        reason: 'OK',
        policy_rule_id: 'rule-8',
      }),
    });
    const config = createConfig({
      client,
      defaultDataClassification: 'public',
      defaultResourceScope: 'default-scope',
    });

    await interceptToolCall('some_tool', {}, client, config, 'my-server');

    expect(client.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'some_tool',
      target_integration: 'my-server',
      resource_scope: 'some_tool',
      data_classification: 'public',
    }));
  });

  it('includes mcp_tool and mcp_args in evaluation context', async () => {
    const client = createMockClient({
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',
        trace_id: 'TR-009',
        reason: 'OK',
        policy_rule_id: 'rule-9',
      }),
    });
    const config = createConfig({ client });
    const args = { path: '/tmp/file.txt' };

    await interceptToolCall('read_file', args, client, config, 'fs-server');

    expect(client.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      context: { mcp_tool: 'read_file', mcp_args: args, mcp_server: 'fs-server' },
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk && npx vitest run src/mcp/__tests__/tool-interceptor.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement tool-interceptor.ts**

```typescript
// packages/sdk/src/mcp/tool-interceptor.ts
import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import type { GovernanceMCPServerConfig } from './config.js';
import { findMapping, deriveResourceScope } from './tool-mapper.js';

export interface InterceptResult {
  action: 'forward' | 'error';
  traceId?: string;
  error?: { code: number; message: string; data?: Record<string, unknown> };
}

export async function interceptToolCall(
  toolName: string,
  args: Record<string, unknown>,
  client: AgentIdentityClient,
  config: GovernanceMCPServerConfig,
  upstreamServerName: string
): Promise<InterceptResult> {
  const mapping = findMapping(toolName, config.toolMappings ?? []);

  if (mapping?.skip_governance) {
    return { action: 'forward' };
  }

  const evalRequest = {
    operation: mapping?.operation ?? toolName,
    target_integration: mapping?.target_integration ?? upstreamServerName,
    resource_scope: mapping?.resource_scope ?? deriveResourceScope(toolName, args),
    data_classification: mapping?.data_classification ?? config.defaultDataClassification ?? 'internal',
    context: { mcp_tool: toolName, mcp_args: args, mcp_server: upstreamServerName },
  };

  const decision = await client.evaluate(evalRequest);

  if (decision.decision === 'allow') {
    return { action: 'forward', traceId: decision.trace_id };
  }

  if (decision.decision === 'deny') {
    return {
      action: 'error',
      traceId: decision.trace_id,
      error: {
        code: -32001,
        message: `Action denied by policy: ${decision.reason}`,
        data: {
          type: 'action_denied',
          trace_id: decision.trace_id,
          reason: decision.reason,
          policy_rule_id: decision.policy_rule_id,
        },
      },
    };
  }

  // approval_required
  if (config.approvalWaitMode === 'block') {
    try {
      const approval = await client.waitForApproval(decision.approval_request_id!, {
        timeout: config.approvalBlockTimeoutMs ?? 30000,
        pollInterval: 1000,
      });
      if (approval.status === 'approved') {
        return { action: 'forward', traceId: decision.trace_id };
      }
      return {
        action: 'error',
        traceId: decision.trace_id,
        error: {
          code: -32001,
          message: `Approval ${approval.status}: ${approval.decision_note ?? 'No reason provided'}`,
          data: {
            type: `approval_${approval.status}`,
            trace_id: decision.trace_id,
            approval_request_id: decision.approval_request_id,
          },
        },
      };
    } catch {
      return {
        action: 'error',
        traceId: decision.trace_id,
        error: {
          code: -32001,
          message: `Approval required but timed out waiting: ${decision.reason}`,
          data: {
            type: 'approval_required',
            trace_id: decision.trace_id,
            approval_request_id: decision.approval_request_id,
            reason: decision.reason,
          },
        },
      };
    }
  }

  // Error mode (default)
  return {
    action: 'error',
    traceId: decision.trace_id,
    error: {
      code: -32001,
      message: `Approval required: ${decision.reason}`,
      data: {
        type: 'approval_required',
        trace_id: decision.trace_id,
        approval_request_id: decision.approval_request_id,
        reason: decision.reason,
      },
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk && npx vitest run src/mcp/__tests__/tool-interceptor.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/mcp/tool-interceptor.ts packages/sdk/src/mcp/__tests__/tool-interceptor.test.ts
git commit -m "feat(sdk): add MCP tool interceptor with policy evaluation"
```

---

### Task 4: Governance MCP Server

**Files:**
- Create: `packages/sdk/src/mcp/governance-server.ts`

Key API facts from `@modelcontextprotocol/sdk` v1.27.1:
- `Server` from `@modelcontextprotocol/sdk/server/index.js` — low-level server
- `Client` from `@modelcontextprotocol/sdk/client/index.js` — client to connect upstream
- `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
- `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`
- `McpError` from `@modelcontextprotocol/sdk/types.js` — `new McpError(code, message, data)`
- Request schemas: `ListToolsRequestSchema`, `CallToolRequestSchema`, `ListResourcesRequestSchema`, `ReadResourceRequestSchema`, `ListPromptsRequestSchema`, `GetPromptRequestSchema` from `@modelcontextprotocol/sdk/types.js`
- `server.setRequestHandler(Schema, handler)` — handler receives `(request, extra)`
- `client.listTools()`, `client.callTool({ name, arguments })`, `client.listResources()`, `client.readResource()`, `client.listPrompts()`, `client.getPrompt()`

- [ ] **Step 1: Implement governance-server.ts**

```typescript
// packages/sdk/src/mcp/governance-server.ts
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

export class GovernanceMCPServer {
  private server: Server;
  private upstreamClient: Client;
  private config: GovernanceMCPServerConfig;
  private upstreamServerName: string;

  constructor(config: GovernanceMCPServerConfig) {
    this.config = config;
    this.upstreamServerName = config.upstream.command ?? 'upstream';

    this.server = new Server(
      { name: 'sidclaw-governance', version: '0.1.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    this.upstreamClient = new Client(
      { name: 'sidclaw-governance-client', version: '0.1.0' },
      { capabilities: {} }
    );

    this.setupHandlers();
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
        this.config.client,
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
      const upstreamResult = await this.upstreamClient.callTool({
        name: toolName,
        arguments: args,
      });

      // Record outcome (fire and forget)
      if (result.traceId) {
        this.config.client.recordOutcome(result.traceId, {
          status: 'success',
          metadata: { mcp_tool: toolName },
        }).catch(() => {});
      }

      return upstreamResult;
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

  async start(): Promise<void> {
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
      throw new Error(`Transport '${this.config.upstream.transport}' is not yet supported. Only 'stdio' is available.`);
    }

    // Start the governance server on stdio
    const serverTransport = new StdioServerTransport();
    await this.server.connect(serverTransport);
  }

  async stop(): Promise<void> {
    await this.server.close();
    await this.upstreamClient.close();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/sdk && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/mcp/governance-server.ts
git commit -m "feat(sdk): add GovernanceMCPServer with upstream proxy and tool interception"
```

---

### Task 5: Barrel Exports and Package Configuration

**Files:**
- Create: `packages/sdk/src/mcp/index.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/sdk/package.json`

- [ ] **Step 1: Create mcp/index.ts barrel export**

```typescript
// packages/sdk/src/mcp/index.ts
export { GovernanceMCPServer } from './governance-server.js';
export type { GovernanceMCPServerConfig, ToolMapping } from './config.js';
```

- [ ] **Step 2: Update packages/sdk/src/index.ts to export MCP module**

Add to the end of `packages/sdk/src/index.ts`:

```typescript
export { GovernanceMCPServer } from './mcp/index.js';
export type { GovernanceMCPServerConfig, ToolMapping } from './mcp/index.js';
```

- [ ] **Step 3: Add `/mcp` subpath export to package.json**

Add to the `exports` field in `packages/sdk/package.json`:

```json
{
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./mcp": {
      "types": "./src/mcp/index.ts",
      "default": "./src/mcp/index.ts"
    }
  }
}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd packages/sdk && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/mcp/index.ts packages/sdk/src/index.ts packages/sdk/package.json
git commit -m "feat(sdk): export GovernanceMCPServer from main and /mcp subpath"
```

---

### Task 6: Full Test Suite Verification

- [ ] **Step 1: Run SDK tests**

Run: `cd packages/sdk && npx vitest run`
Expected: All tests pass (existing + new tool-mapper + tool-interceptor)

- [ ] **Step 2: Run turbo test across all packages**

Run: `cd /Users/vlpetrov/Documents/Programming/agent-identity && npx turbo test`
Expected: All packages pass

- [ ] **Step 3: Final commit if any fixes were needed**

---

### Task 7: Verification Checklist

Verify all acceptance criteria:

- [ ] `GovernanceMCPServer` class exists and can be instantiated
- [ ] `tools/list` handler proxies to upstream via `setRequestHandler(ListToolsRequestSchema, ...)`
- [ ] `tools/call` handler intercepts with governance evaluation
- [ ] Allowed tools: forwarded to upstream, result returned, trace created
- [ ] Denied tools: `McpError` thrown with structured data (type, trace_id, reason)
- [ ] Approval required (error mode): `McpError` with trace_id and approval_request_id, no blocking
- [ ] Approval required (block mode): waits up to timeout, forwards on approval, errors on denial/timeout
- [ ] Tool mappings: exact match, glob patterns, skip_governance all work
- [ ] `resources/*` and `prompts/*` proxied without governance
- [ ] All unit tests pass with mocked client
- [ ] `import { GovernanceMCPServer } from '@sidclaw/sdk'` works
- [ ] `import { GovernanceMCPServer } from '@sidclaw/sdk/mcp'` works
