# NemoClaw + SidClaw Governance Example

[NemoClaw](https://developer.nvidia.com/nemoclaw) secures the sandbox. [SidClaw](https://sidclaw.com) governs what happens inside it. Together they give you sandboxed execution **and** policy-driven human oversight for every tool call your AI agent makes.

## What This Demonstrates

Three tools with three different governance outcomes:

| Tool | Action | Policy | Result |
|------|--------|--------|--------|
| `search_docs` | Search internal documentation | allow (priority 50) | Executes immediately |
| `send_email` | Send outbound email | approval_required (priority 100) | Waits for human approval |
| `export_data` | Export user data in bulk | deny (priority 200) | Blocked by policy |

## Prerequisites

- Node.js 18+ (for TypeScript demo) or Python 3.10+ (for Python demo)
- A SidClaw account and API key ([sign up](https://app.sidclaw.com) or run the platform locally)
- For local development: the SidClaw platform running ([setup instructions](../../README.md))

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Seed the agent and policies:
   ```bash
   # Against production
   SIDCLAW_API_KEY=<your-key> npx tsx seed.ts

   # Against local dev
   SIDCLAW_API_KEY=<your-key> SIDCLAW_API_URL=http://localhost:4000 npx tsx seed.ts
   ```
   This creates a "NemoClaw Sandbox Agent" with three policies (allow, approval_required, deny). Note the agent ID printed at the end.

3. Run the TypeScript demo:
   ```bash
   SIDCLAW_API_KEY=<your-key> SIDCLAW_AGENT_ID=<agent-id> npx tsx index.ts
   ```

4. Or run the Python demo:
   ```bash
   pip install sidclaw
   SIDCLAW_API_KEY=<your-key> SIDCLAW_AGENT_ID=<agent-id> python demo.py
   ```

5. Open the dashboard to see approval requests and traces:
   - Production: https://app.sidclaw.com/dashboard/audit
   - Local: http://localhost:3000/dashboard/audit

## How It Works

```
NemoClaw Sandbox
+------------------------------------------------------+
|                                                      |
|  Your AI Agent                                       |
|      |                                               |
|      v                                               |
|  SidClaw Middleware  -----> SidClaw API               |
|      |                      (policy evaluation,      |
|      |                       approval queue,         |
|      |                       audit traces)           |
|      v                                               |
|  [allow]  -> Tool executes inside sandbox            |
|  [deny]   -> ActionDeniedError thrown                |
|  [review] -> Approval request created, agent waits   |
|                                                      |
+------------------------------------------------------+
       ^
       | Network policy: sidclaw-preset.yaml
       | Only api.sidclaw.com:443 is allowed out
```

NemoClaw restricts all network access from the sandbox. The `sidclaw-preset.yaml` network policy preset allows the sandbox to reach only the SidClaw API endpoints it needs:

- `POST /api/v1/evaluate` -- policy evaluation
- `GET /api/v1/approvals/*` -- approval status polling
- `POST /api/v1/traces/*/outcome` -- recording execution outcomes
- `GET /api/v1/agents/*` -- agent configuration

## Two Deployment Options

### Option A: SDK Middleware (this example)

Wrap tools directly in your agent code:

```typescript
import { AgentIdentityClient } from '@sidclaw/sdk';
import { governNemoClawTools } from '@sidclaw/sdk/nemoclaw';

const client = new AgentIdentityClient({ apiKey, agentId, apiUrl });
const governed = governNemoClawTools(client, myTools, {
  sandboxName: 'prod-sandbox',
  dataClassification: 'confidential',
});
```

### Option B: MCP Proxy

Route all MCP tool calls through the SidClaw governance proxy. See `openclaw-config.json` for an example config. No code changes needed in your agent -- governance is enforced at the transport layer.

```bash
# Start the governance proxy
SIDCLAW_API_KEY=<key> SIDCLAW_AGENT_ID=<id> \
  npx -y @sidclaw/sdk mcp-proxy \
  --upstream "npx -y @modelcontextprotocol/server-postgres postgresql://localhost/mydb"
```

## NemoClaw Network Policy

Copy `sidclaw-preset.yaml` into your NemoClaw blueprint to allow the sandbox to reach the SidClaw API:

```bash
cp sidclaw-preset.yaml nemoclaw-blueprint/policies/presets/sidclaw.yaml
```

For self-hosted SidClaw, update the `host` field in the preset to your API hostname.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SIDCLAW_API_KEY` | Yes | -- | Your SidClaw API key |
| `SIDCLAW_AGENT_ID` | Yes | -- | Agent ID (from seed output) |
| `SIDCLAW_API_URL` | No | `https://api.sidclaw.com` | SidClaw API URL |
