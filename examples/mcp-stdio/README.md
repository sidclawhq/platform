# MCP stdio — Standalone `@sidclaw/mcp-tools` server

Add SidClaw's governance tools to any MCP host (Claude Code, Claude Desktop,
Cursor) without writing any SDK code.

## Option 1: With Claude Code / Claude Desktop

Add to `.mcp.json` / `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sidclaw": {
      "command": "npx",
      "args": ["-y", "@sidclaw/mcp-tools"],
      "env": {
        "SIDCLAW_BASE_URL": "https://api.sidclaw.com",
        "SIDCLAW_API_KEY": "ai_your_key_here",
        "SIDCLAW_AGENT_ID": "claude-code"
      }
    }
  }
}
```

Restart the host. The agent now has `sidclaw_evaluate`, `sidclaw_record`,
`sidclaw_approve`, `sidclaw_policies`, `sidclaw_session_start`, and
`sidclaw_session_end` tools.

## Option 2: Governance proxy — wrap an existing MCP server

For example, wrap the official Postgres MCP so every SQL call is policy-checked:

```json
{
  "mcpServers": {
    "postgres-governed": {
      "command": "npx",
      "args": ["-y", "@sidclaw/sdk", "sidclaw-mcp-proxy", "--transport", "stdio"],
      "env": {
        "SIDCLAW_API_KEY": "ai_...",
        "SIDCLAW_AGENT_ID": "postgres-admin",
        "SIDCLAW_UPSTREAM_CMD": "npx",
        "SIDCLAW_UPSTREAM_ARGS": "-y,@modelcontextprotocol/server-postgres,postgresql://localhost/mydb"
      }
    }
  }
}
```

## Both at once

You can run both the tools server AND a proxy — the agent gets explicit
governance primitives AND every underlying MCP tool is automatically gated.
