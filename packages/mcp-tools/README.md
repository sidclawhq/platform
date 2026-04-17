# @sidclaw/mcp-tools

MCP server that exposes SidClaw governance as callable **tools** — the
complement to the transparent MCP proxy shipped with `@sidclaw/sdk`.

Where the proxy wraps an upstream MCP server and gates its tools, this server
**provides** governance primitives (evaluate, record, approve, policies) that
any MCP-aware agent can call directly. Use it with Claude Code, Claude
Desktop, or any MCP host.

MIT licensed.

## Install

```bash
npx @sidclaw/mcp-tools --version
```

## Configure (Claude Code / Claude Desktop)

Add to your MCP config:

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

Restart your MCP host. The agent can now call:

| Tool | What it does |
|------|--------------|
| `sidclaw_evaluate` | Pre-action policy check. Returns allow / approval_required / deny. |
| `sidclaw_record` | Log an action outcome (success/error + token usage). |
| `sidclaw_approve` | Block until a human decides on a flagged action. |
| `sidclaw_policies` | List active policies. |
| `sidclaw_session_start` | Register a session. |
| `sidclaw_session_end` | Close a session. |

Plus three resources:
- `sidclaw://policies` — active rules
- `sidclaw://status` — instance health
- `sidclaw://agent/{agent_id}/history` — last 50 traces for an agent

## Environment

| Variable | Required | Default |
|----------|----------|---------|
| `SIDCLAW_BASE_URL` | yes | — |
| `SIDCLAW_API_KEY` | yes | — |
| `SIDCLAW_AGENT_ID` | no | `claude-code` |
| `SIDCLAW_MCP_NAME` | no | `sidclaw-mcp-tools` |

## When to use this vs the MCP proxy

| Scenario | Pick |
|----------|------|
| Wrap an existing MCP server (Postgres, filesystem, GitHub) | `@sidclaw/sdk` → `sidclaw-mcp-proxy` |
| Give the agent explicit governance tools to call | `@sidclaw/mcp-tools` (this) |
| You want both — agent self-governs AND downstream MCPs are gated | Load both servers |

Both approaches are complementary and can run side-by-side.

## Develop

```bash
npm install
npm test       # vitest unit tests
npm run build  # tsup → dist/
npm run typecheck
```
