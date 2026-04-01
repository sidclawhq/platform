# Govern MCP Servers in Claude Code with SidClaw

This example shows how to wrap an MCP PostgreSQL server with SidClaw governance so that every SQL query Claude Code runs is evaluated against your policies. SELECT queries are allowed instantly, DELETE/UPDATE queries require human approval, and DROP/TRUNCATE queries are blocked outright. No changes to the upstream MCP server are needed.

## Prerequisites

- Docker (for the example PostgreSQL database and the SidClaw platform)
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- Node.js 18+

## Setup

### 1. Start the example database

```bash
docker compose up -d
```

This starts a PostgreSQL instance with a sample `customers` table (5 rows) on port 5434.

### 2. Start the SidClaw platform

Follow the [main README](../../README.md) to start PostgreSQL (platform DB), the API, and the dashboard. In short:

```bash
# From the repo root — start the platform database
docker compose up db -d

# Generate Prisma client, run migrations, seed
cd apps/api && npx prisma generate && npx prisma migrate deploy && npx prisma db seed

# Start the API (port 4000)
cd apps/api && npm run dev

# Start the dashboard (port 3000) — optional, but useful for approvals
cd apps/dashboard && npm run dev
```

### 3. Create the agent and policies

```bash
SIDCLAW_API_KEY=$(grep AGENT_IDENTITY_API_KEY ../../deployment/.env.development | cut -d= -f2) \
  bash setup.sh
```

The script creates one agent and three policies:

| Policy | Effect | Matches |
|--------|--------|---------|
| Allow read queries | `allow` | SELECT statements |
| Require approval for writes | `approval_required` | DELETE, UPDATE statements |
| Block destructive DDL | `deny` | DROP, TRUNCATE statements |

It prints the agent ID at the end. The `.mcp.json` file is already configured with the default agent ID (`claude-code-db-agent`).

### 4. Configure Claude Code

Copy or symlink the `.mcp.json` file so Claude Code picks it up:

```bash
# Option A: use this directory as your working directory
cd examples/claude-code-governed
claude

# Option B: copy to your project root
cp .mcp.json /path/to/your/project/.mcp.json
```

Set the API key in the `.mcp.json` file (replace `YOUR_API_KEY`):

```bash
# Get the dev API key
grep AGENT_IDENTITY_API_KEY ../../deployment/.env.development

# Edit .mcp.json and replace YOUR_API_KEY with the actual key
```

### 5. Test it

Open Claude Code in the directory containing `.mcp.json` and try these three scenarios:

#### Scenario 1: Allowed query (SELECT)

> "List all customers in the database."

Claude Code calls the `query` tool with `SELECT * FROM customers`. SidClaw evaluates the policy, finds the "allow read queries" rule, and lets it through. You see the results immediately.

#### Scenario 2: Flagged query (DELETE)

> "Delete the customer named Eve Davis."

Claude Code calls `query` with `DELETE FROM customers WHERE name = 'Eve Davis'`. SidClaw matches the "require approval for writes" policy and returns an approval request. Open the dashboard at http://localhost:3000/dashboard/approvals to approve or deny.

#### Scenario 3: Denied query (DROP)

> "Drop the customers table."

Claude Code calls `query` with `DROP TABLE customers`. SidClaw matches the "block destructive DDL" policy and denies the request outright. Claude Code receives an error and tells you the operation was blocked by policy.

## How It Works

```
Claude Code
    |
    v
SidClaw MCP Governance Proxy  (sidclaw-mcp-proxy)
    |  -- evaluates policy via POST /api/v1/evaluate --
    v
MCP PostgreSQL Server          (@modelcontextprotocol/server-postgres)
    |
    v
PostgreSQL Database
```

The `.mcp.json` file tells Claude Code to start `sidclaw-mcp-proxy` instead of the raw MCP server. The proxy intercepts every `tools/call` request, evaluates it against SidClaw policies, and only forwards allowed requests to the upstream MCP PostgreSQL server.

## Files

| File | Purpose |
|------|---------|
| `.mcp.json` | Claude Code MCP server configuration |
| `docker-compose.yml` | Example PostgreSQL database with sample data |
| `init.sql` | Schema and seed data (customers table, 5 rows) |
| `setup.sh` | Creates the agent and policies via the SidClaw API |

## Configuration Reference

The proxy is configured entirely through environment variables in `.mcp.json`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SIDCLAW_API_KEY` | Yes | -- | Your SidClaw API key |
| `SIDCLAW_AGENT_ID` | Yes | -- | Agent ID registered in SidClaw |
| `SIDCLAW_API_URL` | No | `https://api.sidclaw.com` | SidClaw API URL |
| `SIDCLAW_UPSTREAM_CMD` | Yes | -- | Command to start the upstream MCP server |
| `SIDCLAW_UPSTREAM_ARGS` | No | -- | Comma-separated arguments for the upstream command |
| `SIDCLAW_TOOL_MAPPINGS` | No | -- | JSON array of tool-to-policy mappings |
| `SIDCLAW_APPROVAL_MODE` | No | `error` | `error` (return immediately) or `block` (wait for approval) |
