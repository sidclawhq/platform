# Vercel AI Assistant with Governance

A Next.js chat application using the [Vercel AI SDK](https://sdk.vercel.ai) with tools governed by [SidClaw](https://sidclaw.dev).

## What This Demonstrates

A web-based chat interface where the AI assistant has three tools, each with a different governance policy:

| Tool | Action | Policy | Result |
|------|--------|--------|--------|
| `check_inventory` | Check product stock levels | allow | Executes immediately |
| `send_notification` | Send email to customer | approval_required | Blocked until approved |
| `delete_records` | Delete customer records | deny | Blocked by policy |

## Prerequisites

- The SidClaw platform running locally ([setup instructions](../../README.md))
- A SidClaw API key (created by `prisma db seed`, found in `deployment/.env.development`)
- An OpenAI API key (for the chat model)

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

4. Start the development server:
   ```bash
   SIDCLAW_API_KEY=<your-key> OPENAI_API_KEY=<your-openai-key> npm run dev
   ```

5. Open http://localhost:3001 and start chatting

6. Open the SidClaw dashboard at http://localhost:3000 to see traces and approval requests

## How It Works

```typescript
import { governVercelTools } from '@sidclaw/sdk/vercel-ai';

// Wrap all tools with governance — one line
const governedTools = governVercelTools(tools, { client });
```

Every tool execution is intercepted:
1. The action is evaluated against the policy engine
2. If **allowed**: the tool executes normally and the result streams back
3. If **approval_required**: throws an error — the AI explains the action needs approval
4. If **denied**: throws an error — the AI explains the action was blocked

## Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `SIDCLAW_API_KEY` | Yes | — | Your SidClaw API key |
| `SIDCLAW_API_URL` | No | `http://localhost:4000` | SidClaw API URL |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for the chat model |
| `AGENT_ID` | No | `assistant-agent` | Agent ID (from seed output) |

## Note on the Chat Model

This example uses OpenAI's `gpt-4o-mini` as the chat model. You can replace it with any model supported by the Vercel AI SDK. The governance layer is model-agnostic — it governs the **tools**, not the model.
