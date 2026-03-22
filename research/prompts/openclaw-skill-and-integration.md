# Task: OpenClaw Skill & Governance Integration

## Context

You are working on the **SidClaw** platform. Read these files first:

1. `research/2026-03-20-product-development-plan.md` — Overview.
2. `packages/sdk/src/mcp/governance-server.ts` — existing GovernanceMCPServer (wraps upstream MCP, intercepts tool calls).
3. `packages/sdk/src/mcp/config.ts` — GovernanceMCPServerConfig interface.
4. `packages/sdk/src/mcp/tool-interceptor.ts` — tool interception logic.
5. `packages/sdk/src/mcp/tool-mapper.ts` — tool mapping with glob patterns.
6. `packages/sdk/package.json` — SDK package config.

**Goal:** Create an OpenClaw skill + CLI entry point so OpenClaw users can add SidClaw governance to any of their existing MCP servers with one command. This is the primary distribution channel into OpenClaw's 329K+ developer community.

## Background: How OpenClaw Works

OpenClaw is the most popular AI agent platform (329K GitHub stars). It uses:
- **Skills** — `SKILL.md` files in `~/.openclaw/workspace/skills/` that teach the agent new behaviors
- **MCP servers** — configured in `~/.openclaw/openclaw.json` under `mcpServers`, started as child processes via stdio

Skills provide instructions (loaded into agent context). MCP servers provide tools (callable by the agent). A skill can reference MCP tools but doesn't start its own MCP server — that's configured separately.

**OpenClaw's security crisis:** 1,184+ malicious skills found on ClawHub. No policy layer governing what skills/tools can do. SidClaw fills this gap.

## What To Build

Two things:

### 1. A CLI entry point for the governance MCP proxy

A standalone Node.js script that wraps `GovernanceMCPServer` and can be started via `npx`. OpenClaw users add it to their `openclaw.json` as a replacement for their existing MCP server — it proxies through to the real server with governance evaluation on every tool call.

### 2. An OpenClaw skill (SKILL.md + supporting files)

A skill that teaches the OpenClaw agent about SidClaw governance: what it is, how to handle blocked/approval-required responses, and where to direct the user for approvals.

---

## Part 1: CLI Entry Point (`packages/sdk/src/bin/sidclaw-mcp-proxy.ts`)

This is a CLI script that:
1. Reads configuration from environment variables
2. Creates an `AgentIdentityClient`
3. Creates a `GovernanceMCPServer` wrapping the upstream server
4. Starts the governance proxy on stdio

```typescript
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
 *
 * Usage in openclaw.json:
 *   {
 *     "mcpServers": {
 *       "my-server-governed": {
 *         "command": "npx",
 *         "args": ["-y", "@sidclaw/sdk", "mcp-proxy"],
 *         "env": {
 *           "SIDCLAW_API_KEY": "ai_...",
 *           "SIDCLAW_AGENT_ID": "agent-...",
 *           "SIDCLAW_UPSTREAM_CMD": "npx",
 *           "SIDCLAW_UPSTREAM_ARGS": "-y,@modelcontextprotocol/server-postgres,postgresql://..."
 *         }
 *       }
 *     }
 *   }
 */

import { AgentIdentityClient } from '../client/agent-identity-client.js';
import { GovernanceMCPServer } from '../mcp/governance-server.js';
import type { ToolMapping } from '../mcp/config.js';

async function main() {
  // Read configuration from environment
  const apiKey = process.env.SIDCLAW_API_KEY;
  const apiUrl = process.env.SIDCLAW_API_URL ?? 'https://api.sidclaw.com';
  const agentId = process.env.SIDCLAW_AGENT_ID;
  const upstreamCmd = process.env.SIDCLAW_UPSTREAM_CMD;
  const upstreamArgsRaw = process.env.SIDCLAW_UPSTREAM_ARGS ?? '';
  const defaultClassification = process.env.SIDCLAW_DEFAULT_CLASSIFICATION ?? 'internal';
  const toolMappingsRaw = process.env.SIDCLAW_TOOL_MAPPINGS;
  const approvalMode = (process.env.SIDCLAW_APPROVAL_MODE ?? 'error') as 'error' | 'block';

  // Validate required config
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

  // Parse upstream args (comma-separated)
  const upstreamArgs = upstreamArgsRaw ? upstreamArgsRaw.split(',').map(a => a.trim()) : [];

  // Parse tool mappings (JSON)
  let toolMappings: ToolMapping[] | undefined;
  if (toolMappingsRaw) {
    try {
      toolMappings = JSON.parse(toolMappingsRaw);
    } catch {
      console.error('Error: SIDCLAW_TOOL_MAPPINGS must be valid JSON');
      process.exit(1);
    }
  }

  // Create client
  const client = new AgentIdentityClient({
    apiKey,
    apiUrl,
    agentId,
    maxRetries: 2,
  });

  // Create and start governance proxy
  const server = new GovernanceMCPServer({
    client,
    upstream: {
      transport: 'stdio',
      command: upstreamCmd,
      args: upstreamArgs,
    },
    toolMappings,
    defaultDataClassification: defaultClassification as any,
    approvalWaitMode: approvalMode,
    approvalBlockTimeoutMs: 30000,
  });

  // Log to stderr (stdout is used for MCP stdio transport)
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
```

### Register the CLI in package.json

Update `packages/sdk/package.json` to add a `bin` field:

```json
{
  "bin": {
    "sidclaw-mcp-proxy": "./dist/bin/sidclaw-mcp-proxy.cjs"
  }
}
```

Also add the bin entry point to `tsup.config.ts`:

```typescript
entry: {
  // ... existing entries ...
  'bin/sidclaw-mcp-proxy': 'src/bin/sidclaw-mcp-proxy.ts',
},
```

Ensure the built file has a shebang line. Add a `banner` option to tsup for the bin entry:

```typescript
// In tsup.config.ts, if tsup supports per-entry banners, add:
// Otherwise, add a postbuild script that prepends #!/usr/bin/env node
```

If tsup doesn't support per-entry banners, create a simple wrapper script:

Create `packages/sdk/bin/sidclaw-mcp-proxy.js`:

```javascript
#!/usr/bin/env node
require('../dist/bin/sidclaw-mcp-proxy.cjs');
```

And point the bin field to this wrapper instead:

```json
{
  "bin": {
    "sidclaw-mcp-proxy": "./bin/sidclaw-mcp-proxy.js"
  }
}
```

Add `"bin"` to the `files` field in package.json:

```json
{
  "files": ["dist", "bin", "README.md", "LICENSE", "CHANGELOG.md"]
}
```

### Verify the CLI works locally

```bash
cd packages/sdk
npm run build

# Test the CLI shows help when missing env vars:
node dist/bin/sidclaw-mcp-proxy.cjs
# Should print: "Error: SIDCLAW_API_KEY is required"

# Test with env vars (against local API):
SIDCLAW_API_KEY=<key> \
SIDCLAW_AGENT_ID=agent-001 \
SIDCLAW_API_URL=http://localhost:4000 \
SIDCLAW_UPSTREAM_CMD=npx \
SIDCLAW_UPSTREAM_ARGS="-y,@modelcontextprotocol/server-filesystem,/tmp" \
node dist/bin/sidclaw-mcp-proxy.cjs
# Should print: [SidClaw] Governance proxy starting ...
```

---

## Part 2: OpenClaw Skill

Create a skill directory that can be installed in OpenClaw:

### Directory Structure

```
openclaw-skill/
  SKILL.md                    # The skill definition
  README.md                   # Installation guide for ClawHub listing
  setup.sh                    # Optional helper script for setup
```

Create this at `packages/openclaw-skill/` in the monorepo (it will be published to ClawHub separately).

### SKILL.md

```markdown
---
name: sidclaw-governance
description: Add policy evaluation, human approval, and audit trails to any tool. Powered by SidClaw.
version: 1.0.0
homepage: https://sidclaw.com
metadata:
  openclaw:
    emoji: "🛡️"
    requires:
      env:
        - SIDCLAW_API_KEY
        - SIDCLAW_AGENT_ID
      bins:
        - node
    primaryEnv: SIDCLAW_API_KEY
    os:
      - macos
      - linux
      - windows
---

# SidClaw Governance

You have SidClaw governance enabled. Every tool call is evaluated against security policies before execution.

## How governance affects your behavior

When you use a tool, the SidClaw policy engine evaluates whether the action is allowed. There are three possible outcomes:

### 1. ALLOWED
The tool executes normally. No changes to your behavior needed. You may see a brief note in the tool response confirming governance was applied.

### 2. APPROVAL REQUIRED
The tool call is paused pending human review. You will receive an error response containing:
- `type: "approval_required"`
- `approval_request_id`: the ID of the pending approval
- `reason`: why this action requires approval

When this happens:
- Tell the user: "This action requires human approval before I can proceed."
- Share the reason from the policy.
- Direct the user to approve or deny the request in the SidClaw dashboard.
- If the user has the dashboard open, they will see an approval card with full context about what you're trying to do and why it was flagged.
- Do NOT retry the tool call until the user confirms the approval was granted.

### 3. DENIED
The tool call was blocked by policy. You will receive an error response containing:
- `type: "action_denied"`
- `reason`: why this action was blocked

When this happens:
- Tell the user: "This action was blocked by a security policy."
- Share the reason from the policy.
- Do NOT retry the tool call or attempt to work around the block.
- Suggest alternative approaches if possible (e.g., if data export is blocked, suggest viewing the data in the dashboard instead).

## Rules

1. NEVER ignore governance errors. If a tool call is denied, respect the denial.
2. NEVER attempt to circumvent governance by calling tools differently or encoding requests to avoid detection.
3. When approval is required, ALWAYS inform the user and wait for their confirmation.
4. Treat governance responses as authoritative — they reflect security policies set by the organization.
5. If multiple tools are governed, each call is evaluated independently.

## Dashboard

The SidClaw dashboard is available at the URL configured by the administrator. It shows:
- **Approval Queue**: Pending approval requests with full context
- **Audit Trail**: Complete trace of every tool call, policy decision, and outcome
- **Policy Rules**: The security policies governing your actions

If a user asks about governance policies or why an action was blocked, direct them to the SidClaw dashboard for details.
```

### README.md (for ClawHub listing)

```markdown
# SidClaw Governance for OpenClaw

Add policy evaluation, human approval workflows, and audit trails to your OpenClaw agent's tools.

## What it does

SidClaw evaluates every MCP tool call against your security policies:
- **Allowed** actions execute instantly
- **High-risk** actions require human approval before execution
- **Prohibited** actions are blocked before any data is accessed
- Every decision is logged with a tamper-proof audit trail

## Why you need this

OpenClaw skills execute with your local privileges. The ClawHavoc campaign found 1,184 malicious skills on ClawHub. SidClaw adds the missing security layer — policy-based governance that evaluates every tool call before it executes.

## Setup

### 1. Sign up for SidClaw

Get a free account at [app.sidclaw.com/signup](https://app.sidclaw.com/signup) (5 agents, no credit card required).

### 2. Register your OpenClaw agent

In the SidClaw dashboard, go to Agents → Register Agent. Note the Agent ID.

### 3. Create policies

In the SidClaw dashboard, go to Policies → Create Policy. Define rules for your tools:
- Which tools are allowed without review
- Which tools require human approval
- Which tools are blocked entirely

### 4. Install the skill

```bash
# Copy to your OpenClaw skills directory
cp -r sidclaw-governance ~/.openclaw/workspace/skills/
```

Or install via ClawHub:
```bash
openclaw skills install sidclaw-governance
```

### 5. Configure governance proxy

In your `~/.openclaw/openclaw.json`, replace your existing MCP server with the SidClaw governance proxy:

**Before (unprotected):**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
      "env": {}
    }
  }
}
```

**After (governed by SidClaw):**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@sidclaw/sdk", "mcp-proxy"],
      "env": {
        "SIDCLAW_API_KEY": "ai_your_key_here",
        "SIDCLAW_AGENT_ID": "your-agent-id",
        "SIDCLAW_UPSTREAM_CMD": "npx",
        "SIDCLAW_UPSTREAM_ARGS": "-y,@modelcontextprotocol/server-postgres,postgresql://localhost/mydb"
      }
    }
  }
}
```

That's it. Every tool call now goes through SidClaw policy evaluation.

### 6. Set environment variables

Add your SidClaw credentials to the skill configuration in `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "sidclaw-governance": {
        "env": {
          "SIDCLAW_API_KEY": "ai_your_key_here",
          "SIDCLAW_AGENT_ID": "your-agent-id"
        }
      }
    }
  }
}
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `SIDCLAW_API_KEY` | Yes | Your SidClaw API key |
| `SIDCLAW_AGENT_ID` | Yes | Agent ID from the SidClaw dashboard |
| `SIDCLAW_API_URL` | No | API URL (default: https://api.sidclaw.com) |
| `SIDCLAW_UPSTREAM_CMD` | Yes | Command to start upstream MCP server |
| `SIDCLAW_UPSTREAM_ARGS` | No | Comma-separated args for upstream |
| `SIDCLAW_DEFAULT_CLASSIFICATION` | No | Default data classification (default: internal) |
| `SIDCLAW_APPROVAL_MODE` | No | 'error' or 'block' (default: error) |
| `SIDCLAW_TOOL_MAPPINGS` | No | JSON tool-specific overrides |

## Tool Mappings

For fine-grained control, set `SIDCLAW_TOOL_MAPPINGS` to a JSON array:

```json
[
  {"toolName": "query", "data_classification": "confidential", "operation": "database_query"},
  {"toolName": "list_tables", "skip_governance": true},
  {"toolName": "drop_*", "data_classification": "restricted"}
]
```

## Links

- [SidClaw Website](https://sidclaw.com)
- [Documentation](https://docs.sidclaw.com)
- [Dashboard](https://app.sidclaw.com)
- [GitHub](https://github.com/sidclawhq/platform)
- [SDK on npm](https://www.npmjs.com/package/@sidclaw/sdk)
```

---

## Part 3: Update SDK README

Add an OpenClaw section to `packages/sdk/README.md` (if not already present):

```markdown
### OpenClaw Integration

Add governance to any OpenClaw MCP server:

1. Install the skill: `openclaw skills install sidclaw-governance`
2. Replace your MCP server config in `openclaw.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@sidclaw/sdk", "mcp-proxy"],
      "env": {
        "SIDCLAW_API_KEY": "ai_...",
        "SIDCLAW_AGENT_ID": "agent-...",
        "SIDCLAW_UPSTREAM_CMD": "npx",
        "SIDCLAW_UPSTREAM_ARGS": "-y,@modelcontextprotocol/server-postgres,postgresql://..."
      }
    }
  }
}
```

Every tool call is now evaluated against your SidClaw policies.
```

---

## Part 4: Tests

Create `packages/sdk/src/bin/__tests__/sidclaw-mcp-proxy.test.ts`:

```typescript
describe('sidclaw-mcp-proxy CLI', () => {
  it('exits with error when SIDCLAW_API_KEY is missing');
  it('exits with error when SIDCLAW_AGENT_ID is missing');
  it('exits with error when SIDCLAW_UPSTREAM_CMD is missing');
  it('parses comma-separated SIDCLAW_UPSTREAM_ARGS');
  it('parses JSON SIDCLAW_TOOL_MAPPINGS');
  it('uses default values for optional config');
  it('logs startup info to stderr (not stdout)');
});
```

Test by spawning the CLI as a child process and checking stderr output and exit codes. Do NOT test the actual MCP server connection (that's covered by existing GovernanceMCPServer tests).

---

## Part 5: Docs Page

Create `apps/docs/content/docs/integrations/openclaw.mdx`:

```markdown
---
title: OpenClaw Integration
description: Add SidClaw governance to your OpenClaw agent's tools
---

# OpenClaw Integration

Add policy evaluation, human approval, and audit trails to any OpenClaw MCP server tool.

## Overview

OpenClaw agents use MCP servers for tool access. SidClaw's governance proxy sits between OpenClaw and your MCP servers, evaluating every tool call against your security policies before forwarding to the real server.

[... complete documentation matching the skill README ...]
```

---

## Part 6: Build & Verify

```bash
# Build SDK with new bin entry
cd packages/sdk
npm run build

# Verify bin exists
ls -la dist/bin/sidclaw-mcp-proxy.cjs

# Verify bin is executable
node dist/bin/sidclaw-mcp-proxy.cjs
# Should print: "Error: SIDCLAW_API_KEY is required"

# Verify npm pack includes bin
npm pack --dry-run 2>&1 | grep -i bin

# Verify skill directory
ls -la packages/openclaw-skill/
# Should have: SKILL.md, README.md

# Run tests
turbo test
```

---

## Acceptance Criteria

- [ ] CLI entry point (`sidclaw-mcp-proxy`) works: reads env vars, creates GovernanceMCPServer, starts on stdio
- [ ] CLI prints helpful errors when required env vars are missing
- [ ] CLI logs to stderr (not stdout — stdout is for MCP stdio transport)
- [ ] `bin` field added to SDK package.json, included in npm pack
- [ ] After `npm install @sidclaw/sdk`, running `npx @sidclaw/sdk mcp-proxy` or `npx sidclaw-mcp-proxy` works
- [ ] OpenClaw skill created: SKILL.md with proper frontmatter, instructions for handling governance responses
- [ ] Skill README includes complete setup guide: signup → register agent → create policies → install skill → configure proxy
- [ ] Before/after config example clearly shows how to wrap an existing MCP server
- [ ] Tool mappings documentation with JSON example
- [ ] Docs page created for OpenClaw integration
- [ ] SDK README updated with OpenClaw section
- [ ] All tests pass
- [ ] `turbo build` succeeds

## Constraints

- Do NOT modify the existing GovernanceMCPServer class or any MCP internals
- Do NOT submit to ClawHub (that's a manual step after review)
- The skill MUST teach the agent to respect governance decisions (never retry denied actions, never circumvent)
- All logging from the proxy must go to stderr (stdout is the MCP transport channel)
- Follow code style: files in `kebab-case.ts`, strict TypeScript
