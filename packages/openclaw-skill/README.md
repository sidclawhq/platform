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
