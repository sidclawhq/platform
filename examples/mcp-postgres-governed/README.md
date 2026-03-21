# MCP PostgreSQL with Governance

Wraps the standard [MCP PostgreSQL server](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres) with [SidClaw](https://sidclaw.dev) governance. Zero changes to the MCP server — just a policy layer in front of it.

## What This Demonstrates

| Query | Result | Why |
|-------|--------|-----|
| `SELECT * FROM products` | Allowed | General read policy matches |
| `SELECT * FROM customers` | Requires human approval | PII policy — customer data needs review |
| `DROP TABLE products` | Blocked by policy | Destructive operations are prohibited |

## Prerequisites

- Docker (for the example PostgreSQL database)
- The SidClaw platform running locally ([setup instructions](../../README.md))
- A SidClaw API key (created by `prisma db seed`, found in `deployment/.env.development`)

## Setup

1. Start the example database:
   ```bash
   docker compose up -d
   ```

2. Make sure the SidClaw API is running at http://localhost:4000

3. Seed the agent and policies:
   ```bash
   SIDCLAW_API_KEY=<your-key> npx tsx seed.ts
   ```
   This creates a "PostgreSQL Query Agent" with three policies (allow, approval_required, deny).

4. Start the governed MCP server:
   ```bash
   SIDCLAW_API_KEY=<your-key> DATABASE_URL=postgresql://example:example@localhost:5434/example npx tsx index.ts
   ```

5. Connect your MCP client (Claude Desktop, Cursor, etc.) to this server

6. Open the dashboard at http://localhost:3000 to see approval requests and traces

## How It Works

```
Your AI Agent (Claude Desktop, Cursor, etc.)
    |
    v
SidClaw Governance MCP Server  <-- policies evaluated here
    |
    v
Real MCP PostgreSQL Server     <-- actual database queries
```

The governance server intercepts every `tools/call` request and evaluates it against your policies before forwarding to the real MCP server. Other MCP operations (`tools/list`, `resources/*`, `prompts/*`) are proxied directly.

## Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `SIDCLAW_API_KEY` | Yes | — | Your SidClaw API key |
| `SIDCLAW_API_URL` | No | `http://localhost:4000` | SidClaw API URL |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `AGENT_ID` | No | `postgres-agent` | Agent ID (from seed output) |
