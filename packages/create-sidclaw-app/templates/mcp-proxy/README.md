# {{projectName}}

An MCP governance proxy powered by [SidClaw](https://sidclaw.com).

## What This Does

Wraps any MCP server with SidClaw governance. Tool calls are evaluated
against your policies before reaching the upstream server.

Tool mappings (glob patterns):
- `search_*` → Allowed instantly (internal data)
- `send_*` → Requires human approval (confidential)
- `export_*` → Blocked by policy (restricted data)

## How Governance Works

When you ran `create-sidclaw-app`, the CLI automatically created:

1. **An agent** registered in the SidClaw dashboard
2. **Three demo policies** that control what upstream MCP tools can do:

| Tool Pattern | Policy | Effect | Why |
|--------------|--------|--------|-----|
| `search_*` | Allow knowledge base search | Allowed | Safe read-only operation |
| `send_*` | Require approval for sends | Requires approval | High-risk: sends data externally |
| `export_*` | Block data export | Denied | Prevents unauthorized data extraction |

The proxy evaluates every tool call from the upstream MCP server against these policies before execution.

View and edit policies: [Dashboard → Policies](https://app.sidclaw.com/dashboard/policies)

### Add your own policy

1. Go to [app.sidclaw.com/dashboard/policies](https://app.sidclaw.com/dashboard/policies)
2. Click "Create Policy"
3. Set the operation name to match the MCP tool (glob patterns supported)
4. Choose the effect: allow, require approval, or deny

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
