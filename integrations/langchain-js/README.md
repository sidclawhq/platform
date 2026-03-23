# @sidclaw/langchain-governance

[![npm version](https://img.shields.io/npm/v/@sidclaw/langchain-governance)](https://www.npmjs.com/package/@sidclaw/langchain-governance)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**SidClaw governance integration for LangChain.js** — policy evaluation, human approval, and audit trails for AI agent tools.

## What it does

Wraps your LangChain.js tools with governance. Before any tool executes:
- **Allowed** actions run immediately
- **High-risk** actions require human approval
- **Prohibited** actions are blocked before execution
- Every decision is logged with a tamper-proof audit trail

## Installation

```bash
npm install @sidclaw/langchain-governance @langchain/core
```

## Quick Start

### Option 1: Enforce policies (recommended)

```typescript
import { governTools } from '@sidclaw/langchain-governance';
import { AgentIdentityClient } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: 'ai_...',
  apiUrl: 'https://api.sidclaw.com',
  agentId: 'your-agent-id',
});

// Wrap your existing tools — no changes to tool code
const governed = governTools(myTools, { client, data_classification: 'confidential' });
```

### Option 2: Monitor only (audit without blocking)

```typescript
import { GovernanceCallbackHandler } from '@sidclaw/langchain-governance';

const handler = new GovernanceCallbackHandler(client);
// Pass as callback — every tool call is logged, nothing is blocked
```

## Links

- [SidClaw Website](https://sidclaw.com)
- [Documentation](https://docs.sidclaw.com/docs/integrations/langchain)
- [Dashboard](https://app.sidclaw.com)
- [GitHub](https://github.com/sidclawhq/platform)
