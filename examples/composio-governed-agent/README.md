# Composio Governed Agent

Demonstrates governing [Composio](https://composio.dev) tool execution with SidClaw policies. Three tools, three different policy outcomes:

| Scenario | Composio Tool | SidClaw Decision |
|---|---|---|
| `github` | `GITHUB_CREATE_ISSUE` | **Allow** (internal data, safe) |
| `gmail` | `GMAIL_SEND_EMAIL` | **Approval Required** (outbound email) |
| `salesforce` | `SALESFORCE_QUERY_LEADS` | **Deny** (restricted CRM data) |

## Prerequisites

1. Start the SidClaw API locally (see main README)
2. Create the agent and policies via the dashboard or seed script

## Usage

```bash
# Set your API key
export SIDCLAW_API_KEY=$(grep AGENT_IDENTITY_API_KEY ../../deployment/.env.development | cut -d= -f2)

# Run each scenario
npx tsx src/index.ts github      # -> ALLOW
npx tsx src/index.ts gmail       # -> APPROVAL REQUIRED
npx tsx src/index.ts salesforce  # -> DENY
```

## How It Works

1. The agent requests a Composio tool execution (e.g., `GITHUB_CREATE_ISSUE`)
2. `governComposioExecution` maps the Composio slug to SidClaw policy fields:
   - `GITHUB_CREATE_ISSUE` -> `operation: "create_issue"`, `target_integration: "github"`
3. SidClaw evaluates the request against your policies
4. Based on the decision:
   - **Allow**: Composio executes the tool, outcome is recorded to the audit trace
   - **Approval Required**: Execution waits for human approval (or throws if `waitForApproval: false`)
   - **Deny**: `ActionDeniedError` is thrown, tool never executes

## Production Usage

Replace the mock Composio client with the real `@composio/core` SDK:

```typescript
import { Composio } from '@composio/core';

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const execute = governComposioExecution(sidclaw, composio, { ... });
```
