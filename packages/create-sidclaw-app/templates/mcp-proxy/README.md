# {{projectName}}

An MCP governance proxy powered by [SidClaw](https://sidclaw.com).

## What This Does

Wraps any MCP server with SidClaw governance. Tool calls are evaluated
against your policies before reaching the upstream server.

Tool mappings (glob patterns):
- `search_*` → Allowed instantly (internal data)
- `send_*` → Requires human approval (confidential)
- `export_*` → Blocked by policy (restricted data)

## Setup

1. Set your upstream MCP server command in `.env`:
   ```
   UPSTREAM_MCP_COMMAND=npx
   UPSTREAM_MCP_ARGS=-y @modelcontextprotocol/server-postgres postgres://...
   ```

2. Configure in your MCP client (e.g., Claude Desktop):
   ```json
   {
     "mcpServers": {
       "governed-server": {
         "command": "npx",
         "args": ["tsx", "index.ts"],
         "env": {
           "SIDCLAW_API_KEY": "ai_...",
           "SIDCLAW_AGENT_ID": "...",
           "UPSTREAM_MCP_COMMAND": "npx",
           "UPSTREAM_MCP_ARGS": "-y @modelcontextprotocol/server-postgres postgres://..."
         }
       }
     }
   }
   ```

## Run Standalone

```bash
npm start
```

## Approve Requests

When a tool call requires approval:
https://app.sidclaw.com/dashboard/approvals

## View Traces

See the complete audit trail at:
https://app.sidclaw.com/dashboard/audit
