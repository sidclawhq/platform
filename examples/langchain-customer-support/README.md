# LangChain Customer Support with Governance

A customer support agent built with [LangChain.js](https://js.langchain.com/) where every tool call is governed by [SidClaw](https://sidclaw.dev) policies.

## What This Demonstrates

Three tools with three different governance outcomes:

| Tool | Action | Policy | Result |
|------|--------|--------|--------|
| `search_knowledge_base` | Search internal docs | allow | Executes immediately |
| `send_email_to_customer` | Send email to customer | approval_required | Waits for human approval |
| `export_customer_data` | Export customer PII | deny | Blocked by policy |

## Prerequisites

- The SidClaw platform running locally ([setup instructions](../../README.md))
- A SidClaw API key (created by `prisma db seed`, found in `deployment/.env.development`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Make sure the SidClaw API is running at http://localhost:4000

3. Seed the agent and policies:
   ```bash
   SIDCLAW_API_KEY=<your-key> npx tsx seed.ts
   ```

## Usage

Run the agent with a query:

```bash
# Allowed — searches internal knowledge base
SIDCLAW_API_KEY=<your-key> npx tsx index.ts "What is the refund policy?"

# Blocked — approval required for sending email (throws ActionDeniedError)
SIDCLAW_API_KEY=<your-key> npx tsx index.ts "Send a follow-up email to alice@example.com"

# Blocked — data export denied by policy
SIDCLAW_API_KEY=<your-key> npx tsx index.ts "Export all data for customer-123"
```

## How It Works

```typescript
import { governTools } from '@sidclaw/sdk/langchain';

// One line wraps all tools with governance
const governedTools = governTools(myTools, { client });
```

Every `tool.invoke()` call is intercepted:
1. The action is evaluated against the policy engine
2. If **allowed**: the tool executes normally
3. If **approval_required**: throws `ActionDeniedError` with the approval request ID
4. If **denied**: throws `ActionDeniedError` with the denial reason

Open the dashboard at http://localhost:3000 to see traces and approval requests.

## Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `SIDCLAW_API_KEY` | Yes | — | Your SidClaw API key |
| `SIDCLAW_API_URL` | No | `http://localhost:4000` | SidClaw API URL |
| `AGENT_ID` | No | `support-agent` | Agent ID (from seed output) |
