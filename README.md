<div align="center">

# SidClaw

**Approve, deny, and audit AI agent tool calls.**

Your agents call tools without oversight. SidClaw intercepts every tool call, checks it against your policies, and holds risky actions for human review before they execute.

```
Agent calls tool → SidClaw evaluates → allow | deny | hold for approval → trace recorded
```

Works with MCP, LangChain, OpenAI Agents, Claude Agent SDK, and 15+ more.

[![npm version](https://img.shields.io/npm/v/@sidclaw/sdk?style=flat-square&color=3B82F6)](https://www.npmjs.com/package/@sidclaw/sdk)
[![PyPI version](https://img.shields.io/pypi/v/sidclaw?style=flat-square&color=3B82F6&label=PyPI)](https://pypi.org/project/sidclaw/)
[![License: Apache-2.0](https://img.shields.io/badge/SDK-Apache%202.0-22C55E?style=flat-square)](LICENSE)
[![License: FSL](https://img.shields.io/badge/Platform-FSL%201.1-F59E0B?style=flat-square)](LICENSE-PLATFORM)
[![CI](https://img.shields.io/github/actions/workflow/status/sidclawhq/platform/ci.yml?style=flat-square&label=tests)](https://github.com/sidclawhq/platform/actions)

<a href="https://sidclaw.com" target="_blank">Website</a> · <a href="https://docs.sidclaw.com" target="_blank">Docs</a> · <a href="https://demo.sidclaw.com" target="_blank">Live Demo</a> · <a href="https://www.npmjs.com/package/@sidclaw/sdk" target="_blank">npm</a> · <a href="https://pypi.org/project/sidclaw/" target="_blank">PyPI</a>

</div>

---

### See it in action

![Atlas Financial Demo](docs/assets/atlas_demo.gif)

*Agent wants to send an email → policy flags it → reviewer sees full context → approves or denies → trace recorded.*

---

## Add governance in one line

```typescript
// Before: the agent decides, nobody reviews
await sendEmail({ to: "customer@example.com", subject: "Follow-up", body: "..." });

// After: wrap with SidClaw — now policies apply
const sendEmail = withGovernance(client, {
  operation: 'send_email',
  data_classification: 'confidential',
}, sendEmailFn);

await sendEmail({ to: "customer@example.com", subject: "Follow-up", body: "..." });
// → allow (executes) | approval_required (human reviews) | deny (blocked)
```

<details>
<summary>Same thing in Python</summary>

```python
@with_governance(client, GovernanceConfig(
    operation="send_email",
    data_classification="confidential",
))
def send_email(to, subject, body):
    email_service.send(to=to, subject=subject, body=body)
```
</details>

---

## MCP Governance Proxy

Wrap any MCP server with policy evaluation and approval workflows. Works with Claude Desktop, Cursor, VS Code, GitHub Copilot — any MCP client. Listed on the <a href="https://registry.modelcontextprotocol.io" target="_blank">official MCP Registry</a>.

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "postgres-governed": {
      "command": "npx",
      "args": ["-y", "@sidclaw/sdk", "sidclaw-mcp-proxy", "--transport", "stdio"],
      "env": {
        "SIDCLAW_API_KEY": "ai_your_key",
        "SIDCLAW_AGENT_ID": "your-agent-id",
        "SIDCLAW_UPSTREAM_CMD": "npx",
        "SIDCLAW_UPSTREAM_ARGS": "-y,@modelcontextprotocol/server-postgres,postgresql://localhost/mydb"
      }
    }
  }
}
```

- `SELECT * FROM customers` → **allowed** (~50ms overhead)
- `DELETE FROM customers WHERE id = 5` → **held for human approval**
- `DROP TABLE customers` → **denied by policy**

<a href="https://docs.sidclaw.com/docs/integrations/claude-code" target="_blank">Full MCP governance docs →</a>

## Quick Start

```bash
npx create-sidclaw-app my-agent
cd my-agent
npm start
```

The CLI creates a governed agent with 3 demo policies. Run `npm start` to see all three outcomes:
- `search_docs` → **allowed**
- `send_email` → **requires approval** (go to the <a href="https://app.sidclaw.com/dashboard/approvals" target="_blank">dashboard</a> to approve)
- `export_data` → **denied**

<details>
<summary><strong>Add to Existing Project (TypeScript)</strong></summary>

```bash
npm install @sidclaw/sdk
```

```typescript
import { AgentIdentityClient, withGovernance } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY,
  apiUrl: 'https://api.sidclaw.com',
  agentId: process.env.SIDCLAW_AGENT_ID,
});

const sendEmail = withGovernance(client, {
  operation: 'send_email',
  target_integration: 'email_service',
  resource_scope: 'customer_emails',
  data_classification: 'confidential',
}, async (to, subject, body) => {
  await emailService.send({ to, subject, body });
});

await sendEmail('customer@example.com', 'Follow-up', 'Hello...');
// allow → executes | approval_required → waits for human | deny → throws
```

</details>

<details>
<summary><strong>Add to Existing Project (Python)</strong></summary>

```bash
pip install sidclaw
```

```python
import os
from sidclaw import SidClaw
from sidclaw.middleware.generic import with_governance, GovernanceConfig

client = SidClaw(
    api_key=os.environ["SIDCLAW_API_KEY"],
    agent_id=os.environ["SIDCLAW_AGENT_ID"],
)

@with_governance(client, GovernanceConfig(
    operation="send_email",
    target_integration="email_service",
    data_classification="confidential",
))
def send_email(to, subject, body):
    email_service.send(to=to, subject=subject, body=body)
```

</details>

## Why not just auth / sandboxing / logging?

| Approach | What it solves | What it doesn't solve |
|----------|---------------|----------------------|
| **Auth (Okta, OAuth)** | Who is this agent? | Should this specific action execute right now? |
| **Sandboxing (Docker, WASM)** | Blast radius if something goes wrong | Whether the action should happen at all |
| **Logging (Langfuse, LangSmith)** | What happened after the fact | Intercepting actions before they execute |
| **Policy engines (OPA)** | General-purpose policy evaluation | Approval workflows, agent-specific context, audit trails |
| **SidClaw** | All of the above, plus the **Approval** primitive | — |

SidClaw sits at the **tool-call layer**: the moment an agent decides to act in the real world.

## Integrations

SidClaw wraps your existing agent tools — no changes to your agent logic.

### Agent Frameworks

| | TypeScript | Python |
|--|-----------|--------|
| Core client | `@sidclaw/sdk` | `sidclaw` |
| MCP proxy | `@sidclaw/sdk/mcp` | `sidclaw.mcp` |
| LangChain | `@sidclaw/sdk/langchain` | `sidclaw.middleware.langchain` |
| OpenAI Agents | `@sidclaw/sdk/openai-agents` | `sidclaw.middleware.openai_agents` |
| CrewAI | `@sidclaw/sdk/crewai` | `sidclaw.middleware.crewai` |
| Vercel AI | `@sidclaw/sdk/vercel-ai` | — |
| Pydantic AI | — | `sidclaw.middleware.pydantic_ai` |
| Claude Agent SDK | `@sidclaw/sdk/claude-agent-sdk` | `sidclaw.middleware.claude_agent_sdk` |
| Google ADK | `@sidclaw/sdk/google-adk` | `sidclaw.middleware.google_adk` |
| LlamaIndex | `@sidclaw/sdk/llamaindex` | `sidclaw.middleware.llamaindex` |
| Composio | `@sidclaw/sdk/composio` | `sidclaw.middleware.composio` |
| NemoClaw | `@sidclaw/sdk/nemoclaw` | `sidclaw.middleware.nemoclaw` |
| Webhooks | `@sidclaw/sdk/webhooks` | `sidclaw.webhooks` |

### Platform Integrations

| Integration | Description |
|---|---|
| **Claude Code** | Govern any MCP server in Claude Code. Add a `.mcp.json` entry — zero code changes. <a href="https://docs.sidclaw.com/docs/integrations/claude-code" target="_blank">Guide →</a> |
| **OpenClaw** | Governance proxy for OpenClaw skills. Published as `sidclaw-governance` on ClawHub. <a href="https://docs.sidclaw.com/docs/integrations/openclaw" target="_blank">Guide →</a> |
| **MCP** | Governance proxy for any MCP server. Listed on the <a href="https://registry.modelcontextprotocol.io" target="_blank">official MCP Registry</a>. <a href="https://docs.sidclaw.com/docs/integrations/mcp" target="_blank">Guide →</a> |
| **NemoClaw** | Govern NVIDIA NemoClaw sandbox tools with MCP-compatible proxy generation. <a href="https://docs.sidclaw.com/docs/integrations/nemoclaw" target="_blank">Guide →</a> |
| **Copilot Studio** | Governance for Microsoft Copilot Studio skills via OpenAPI action. <a href="https://docs.sidclaw.com/docs/integrations/copilot-studio" target="_blank">Guide →</a> |
| **GitHub Copilot** | Governance for GitHub Copilot agents via HTTP transport. <a href="https://docs.sidclaw.com/docs/integrations/github-copilot" target="_blank">Guide →</a> |
| **GitHub Action** | `sidclawhq/governance-action@v1` — reusable CI governance step. <a href="https://docs.sidclaw.com/docs/integrations/github-action" target="_blank">Guide →</a> |

### Notification Channels

Reviewers can approve or deny directly from chat — no need to open the dashboard.

| Channel | Features |
|---|---|
| **Slack** | Block Kit messages with interactive Approve/Deny buttons. Messages update in-place. |
| **Microsoft Teams** | Adaptive Card notifications with Approve/Deny buttons. |
| **Telegram** | HTML messages with inline keyboard. |
| **Email** | Transactional email notifications via Resend. |

## Licensing

| Component | License | What you can do |
|-----------|---------|----------------|
| SDK (`@sidclaw/sdk`, `sidclaw` on PyPI) | Apache 2.0 | Use freely, modify, distribute, commercial use |
| MCP Proxy (`sidclaw-mcp-proxy`) | Apache 2.0 | Same as SDK |
| Platform (API, Dashboard, Docs) | FSL 1.1 | Free for orgs under CHF 1M revenue. Converts to Apache 2.0 in 2028 |

**Start with just the SDK?** You don't need the platform. The SDK works standalone with the free hosted API at <a href="https://app.sidclaw.com/signup" target="_blank">app.sidclaw.com</a>, or you can <a href="https://docs.sidclaw.com/docs/enterprise/self-hosting" target="_blank">self-host everything</a>.

## How It Works

```
Agent wants to act → SidClaw evaluates → Policy decides → Human approves (if needed) → Action executes → Trace recorded
```

Four primitives govern every agent action:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Identity │ →  │  Policy  │ →  │ Approval │ →  │  Trace   │
│          │    │          │    │          │    │          │
│ Every    │    │ Every    │    │ High-risk│    │ Every    │
│ agent    │    │ action   │    │ actions  │    │ decision │
│ has an   │    │ evaluated│    │ get human│    │ creates  │
│ owner &  │    │ against  │    │ review   │    │ tamper-  │
│ scoped   │    │ explicit │    │ with rich│    │ proof    │
│ perms    │    │ rules    │    │ context  │    │ audit    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

## More Demos

| [Financial Services](https://demo.sidclaw.com) | [DevOps](https://demo-devops.sidclaw.com) | [Healthcare](https://demo-health.sidclaw.com) |
|:---:|:---:|:---:|
| AI sends customer email → approval required | AI scales production → approval required | AI orders labs → physician approves |

<details>
<summary>DevOps Demo</summary>

![DevOps Demo](docs/assets/devops_demo.gif)

*An AI agent wants to scale production services. High-risk deployments require human approval. Read-only monitoring is allowed instantly.*
</details>

<details>
<summary>Healthcare Demo</summary>

![Healthcare Demo](docs/assets/health_demo.gif)

*An AI assistant recommends lab orders. The physician reviews the clinical context and approves. Medication prescribing is blocked by policy.*
</details>

## Why This Exists

AI agents are being deployed in production, but the governance layer is missing:

- **73% of CISOs** fear AI agent risks, but only **30%** are ready (<a href="https://neuraltrust.ai/guides/the-state-of-ai-agent-security-2026" target="_blank">NeuralTrust 2026</a>)
- **79% of enterprises** have blind spots where agents act without oversight
- **OpenClaw** has 329K+ stars — but <a href="https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html" target="_blank">1,184 malicious skills were found</a> in the ClawHavoc campaign

### Compliance

SidClaw maps to regulatory requirements across the US, EU, Switzerland, and Singapore:

🇺🇸 <a href="https://docs.sidclaw.com/docs/compliance/finra-2026" target="_blank">FINRA 2026</a> · 🇪🇺 <a href="https://docs.sidclaw.com/docs/compliance/eu-ai-act" target="_blank">EU AI Act</a> · 🇨🇭 <a href="https://docs.sidclaw.com/docs/compliance/finma" target="_blank">FINMA</a> · 🇸🇬 <a href="https://docs.sidclaw.com/docs/compliance/mas-trm" target="_blank">MAS TRM</a> · 🇺🇸 <a href="https://docs.sidclaw.com/docs/compliance/nist-ai-rmf" target="_blank">NIST AI RMF</a> · 🌐 <a href="https://docs.sidclaw.com/docs/compliance/owasp-agentic" target="_blank">OWASP Agentic</a>

## Platform Features

### For Developers
- **60-second setup** — `npx create-sidclaw-app` scaffolds a working governed agent
- **<50ms evaluation overhead** — the governance layer is invisible to your users
- **5-minute integration** — wrap existing tools, no code changes
- **MCP-native** — governance proxy for any MCP server
- **Framework-agnostic** — LangChain, Vercel AI, OpenAI, CrewAI, Pydantic AI, Composio, Claude Agent SDK, Google ADK, LlamaIndex, NemoClaw, or plain functions
- **Typed SDKs** — TypeScript (npm) + Python (PyPI)

### For Security & Compliance Teams
- **Policy engine** — allow / approval_required / deny with priority ordering and classification hierarchy
- **Approval workflow** — context-rich cards with agent reasoning, risk classification, and separation of duties
- **Audit trails** — correlated traces with integrity hash chains (tamper-proof)
- **SIEM export** — JSON and CSV, continuous webhook delivery

### For Platform Teams
- **RBAC** — admin, reviewer, viewer roles with enforced permissions
- **Tenant isolation** — automatic tenant scoping on every query
- **API key management** — scoped keys with rotation
- **Rate limiting** — per-tenant, per-endpoint-category
- **Webhooks** — real-time notifications for approvals, traces, lifecycle events
- **Chat integrations** — approve/deny from Slack, Teams, or Telegram
- **Self-serve signup** — GitHub, Google, email/password

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│ Your Agent  │     │  SidClaw SDK │     │  SidClaw API     │
│             │ ──► │              │ ──► │                  │
│ LangChain   │     │ evaluate()   │     │ Policy Engine    │
│ MCP Server  │     │ withGovern() │     │ Approval Service │
│ OpenAI SDK  │     │ governTools()│     │ Trace Store      │
│ Any tool    │     │              │     │ Webhook Delivery │
└─────────────┘     └──────────────┘     └──────────────────┘
                                                   │
                                          ┌────────┴────────┐
                                          ▼                 ▼
                                ┌──────────────┐  ┌──────────────┐
                                │  Dashboard   │  │ Notifications│
                                │              │  │              │
                                │ Agents       │  │ Slack        │
                                │ Policies     │  │ Teams        │
                                │ Approvals    │  │ Telegram     │
                                │ Traces       │  │ Email        │
                                │ Settings     │  │ Webhooks     │
                                └──────────────┘  └──────────────┘
```

## Deploy

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/github?repo=sidclawhq/platform)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsidclawhq%2Fplatform&root-directory=apps/dashboard&env=NEXT_PUBLIC_API_URL&envDescription=SidClaw%20API%20URL&envLink=https%3A%2F%2Fdocs.sidclaw.com%2Fdocs%2Fenterprise%2Fself-hosting&project-name=sidclaw-dashboard&repository-name=sidclaw-dashboard)

### Self-Host (Docker)

```bash
curl -sSL https://raw.githubusercontent.com/sidclawhq/platform/main/deploy/self-host/setup.sh | bash
```

Or manually:

```bash
git clone https://github.com/sidclawhq/platform.git
cd platform
cp deployment/env.example .env  # edit with your values
docker compose -f docker-compose.production.yml up -d
```

**Development credentials:**
- Email: `admin@example.com` / Password: `admin`
- Or click **"Sign in with SSO"** on the login page to auto-login without a password

### Hosted Cloud

No infrastructure to manage. <a href="https://app.sidclaw.com/signup" target="_blank">Start free at app.sidclaw.com</a>

See <a href="https://docs.sidclaw.com/docs/enterprise/self-hosting" target="_blank">deployment docs</a> for production configuration, environment variables, and upgrade guides.

## Documentation

- <a href="https://docs.sidclaw.com/docs/quickstart" target="_blank">Quick Start</a> — 2 minutes to first governed action
- <a href="https://docs.sidclaw.com/docs/sdk/client" target="_blank">SDK Reference</a> — every method documented
- <a href="https://docs.sidclaw.com/docs/integrations" target="_blank">Integrations</a> — MCP, LangChain, OpenAI, Claude Agent SDK, Google ADK, and more
- <a href="https://docs.sidclaw.com/docs/platform/policies" target="_blank">Policy Guide</a> — authoring, versioning, testing
- <a href="https://docs.sidclaw.com/docs/compliance/finra-2026" target="_blank">Compliance</a> — 🇺🇸 FINRA · 🇪🇺 EU AI Act · 🇨🇭 FINMA · 🇸🇬 MAS TRM · 🌐 OWASP
- <a href="https://docs.sidclaw.com/docs/api-reference" target="_blank">API Reference</a> — every endpoint

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

- **SDK** (`packages/sdk/`, `packages/shared/`): [Apache License 2.0](LICENSE) — use freely for any purpose
- **Platform** (`apps/api/`, `apps/dashboard/`, `apps/docs/`, `apps/landing/`, `apps/demo*/`): [Functional Source License 1.1](LICENSE-PLATFORM) — source-available, converts to Apache 2.0 in March 2028

## Links

- <a href="https://sidclaw.com" target="_blank">Website</a>
- <a href="https://docs.sidclaw.com" target="_blank">Documentation</a>
- <a href="https://app.sidclaw.com" target="_blank">Dashboard</a>
- <a href="https://www.npmjs.com/package/@sidclaw/sdk" target="_blank">TypeScript SDK (npm)</a>
- <a href="https://pypi.org/project/sidclaw/" target="_blank">Python SDK (PyPI)</a>
- <a href="https://github.com/sidclawhq/python-sdk" target="_blank">Python SDK (GitHub)</a>
- <a href="https://www.npmjs.com/package/create-sidclaw-app" target="_blank">create-sidclaw-app (npm)</a>
- <a href="https://github.com/sidclawhq/governance-action" target="_blank">GitHub Action</a>
- <a href="https://github.com/apps/sidclaw-governance" target="_blank">GitHub App</a>
- <a href="mailto:hello@sidclaw.com">Contact</a>
