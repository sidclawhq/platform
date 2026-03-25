<div align="center">

# SidClaw

**The approval and accountability layer for agentic AI**

Identity. Policy. Approval. Trace.

[![npm version](https://img.shields.io/npm/v/@sidclaw/sdk?style=flat-square&color=3B82F6)](https://www.npmjs.com/package/@sidclaw/sdk)
[![PyPI version](https://img.shields.io/pypi/v/sidclaw?style=flat-square&color=3B82F6&label=PyPI)](https://pypi.org/project/sidclaw/)
[![License: Apache-2.0](https://img.shields.io/badge/SDK-Apache%202.0-22C55E?style=flat-square)](LICENSE)
[![License: FSL](https://img.shields.io/badge/Platform-FSL%201.1-F59E0B?style=flat-square)](LICENSE-PLATFORM)
[![CI](https://img.shields.io/github/actions/workflow/status/sidclawhq/platform/ci.yml?style=flat-square&label=tests)](https://github.com/sidclawhq/platform/actions)
[![Tests](https://img.shields.io/badge/tests-794-22C55E?style=flat-square)]()

<a href="https://sidclaw.com" target="_blank">Website</a> · <a href="https://docs.sidclaw.com" target="_blank">Documentation</a> · <a href="https://demo.sidclaw.com" target="_blank">Live Demo</a> · <a href="https://www.npmjs.com/package/@sidclaw/sdk" target="_blank">SDK on npm</a>

</div>

---

Your AI agents are acting without oversight. SidClaw adds the missing governance layer — policy evaluation, human approval with rich context, and tamper-proof audit trails — without changing your agent code.

**What makes SidClaw different:** Everyone else does Identity + Policy + Audit. SidClaw adds the **Approval** primitive — where a human sees exactly what an agent wants to do, why it was flagged, the agent's reasoning, and the risk level — then approves or denies with one click. That's what <a href="https://docs.sidclaw.com/docs/compliance/finra-2026" target="_blank">FINRA 2026 mandates</a>, what the <a href="https://docs.sidclaw.com/docs/compliance/eu-ai-act" target="_blank">EU AI Act requires</a>, and what no one else has shipped.

**Try it right now — no signup needed:**

| 🏦 [Financial Services Demo](https://demo.sidclaw.com) | 🔧 [DevOps Demo](https://demo-devops.sidclaw.com) | 🏥 [Healthcare Demo](https://demo-health.sidclaw.com) |
|:---:|:---:|:---:|
| AI sends customer email → approval required | AI scales production → approval required | AI orders labs → physician approves |

## See It In Action

### Customer Support Agent (Financial Services)

<!-- GIF: Atlas Financial demo — agent sends email → approval card appears → reviewer approves → trace complete -->
![Atlas Financial Demo](docs/assets/atlas_demo.gif)

*An AI agent wants to send a customer email. Policy flags it for review. The reviewer sees full context — who, what, why — and approves with one click. Every step is traced.*

### Infrastructure Automation (DevOps)

<!-- GIF: Nexus DevOps demo — agent scales service → approval required → approve → deployed -->
![DevOps Demo](docs/assets/devops_demo.gif)

*An AI agent wants to scale production services. High-risk deployments require human approval. Read-only monitoring is allowed instantly.*

### Clinical Decision Support (Healthcare)

<!-- GIF: MedAssist demo — agent orders labs → approval required → physician approves → order placed -->
![Healthcare Demo](docs/assets/health_demo.gif)

*An AI assistant recommends lab orders. The physician reviews the clinical context and approves. Medication prescribing is blocked by policy — only physicians can prescribe.*

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

- **allow** → action executes immediately, trace recorded
- **approval_required** → human sees context card, approves/denies, trace recorded
- **deny** → blocked before execution, no data accessed, trace recorded

## Quick Start

### Fastest Way (60 seconds)

```bash
npx create-sidclaw-app my-agent
cd my-agent
npm start
```

This creates a working governed agent with 3 demo tools:
- ✅ `search_docs` — allowed instantly
- ⏳ `send_email` — requires YOUR approval ([open dashboard](https://app.sidclaw.com/dashboard/approvals))
- ❌ `export_data` — blocked by policy

No configuration needed — the CLI creates your agent, policies, and API key automatically.

<details>
<summary><strong>Manual Setup (TypeScript)</strong></summary>

### 1. Install

```bash
npm install @sidclaw/sdk
```

### 2. Wrap your agent's tools

```typescript
import { AgentIdentityClient, withGovernance } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY,
  apiUrl: 'https://api.sidclaw.com',
  agentId: 'your-agent-id',
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
// Policy says "allow"? → executes immediately
// Policy says "approval_required"? → waits for human approval
// Policy says "deny"? → throws ActionDeniedError, no email sent
```

### 3. See governance in the dashboard

Open <a href="https://app.sidclaw.com" target="_blank">app.sidclaw.com</a> to see approval requests, audit traces, and policy decisions in real-time.

</details>

<details>
<summary><strong>Manual Setup (Python)</strong></summary>

```bash
pip install sidclaw
```

```python
from sidclaw import SidClaw
from sidclaw.middleware.generic import with_governance, GovernanceConfig

client = SidClaw(api_key="ai_...", agent_id="your-agent-id")

@with_governance(client, GovernanceConfig(
    operation="send_email",
    target_integration="email_service",
    data_classification="confidential",
))
def send_email(to, subject, body):
    email_service.send(to=to, subject=subject, body=body)
```

</details>

## Integrations

SidClaw wraps your existing agent tools — no changes to your agent logic.

### SDK Availability

| | TypeScript | Python |
|--|-----------|--------|
| Core client | `@sidclaw/sdk` | `sidclaw` |
| MCP proxy | `@sidclaw/sdk/mcp` | `sidclaw[mcp]` |
| LangChain | `@sidclaw/sdk/langchain` | `sidclaw[langchain]` |
| CrewAI | `@sidclaw/sdk/crewai` | `sidclaw[crewai]` |
| OpenAI Agents | `@sidclaw/sdk/openai-agents` | `sidclaw[openai-agents]` |
| Pydantic AI | — | `sidclaw[pydantic-ai]` |
| Vercel AI | `@sidclaw/sdk/vercel-ai` | — |
| Composio | `@sidclaw/sdk/composio` | `sidclaw` (built-in) |
| Claude Agent SDK | `@sidclaw/sdk/claude-agent-sdk` | `sidclaw` (built-in) |
| Google ADK | `@sidclaw/sdk/google-adk` | `sidclaw` (built-in) |
| LlamaIndex | `@sidclaw/sdk/llamaindex` | `sidclaw` (built-in) |
| Webhooks | `@sidclaw/sdk/webhooks` | `sidclaw` (built-in) |

### MCP (Model Context Protocol)

Wrap any MCP server with governance. Works with Claude, ChatGPT, Cursor, Microsoft Copilot Studio, GitHub Copilot, and any MCP-compatible client. Supports both stdio (local) and Streamable HTTP (remote) transports.

```typescript
import { AgentIdentityClient, GovernanceMCPServer } from '@sidclaw/sdk';

const server = new GovernanceMCPServer({
  client,
  upstream: { transport: 'stdio', command: 'npx', args: ['your-mcp-server'] },
  toolMappings: [
    { toolName: 'query', data_classification: 'confidential' },
    { toolName: 'list_tables', skip_governance: true },
  ],
});
await server.start();
```

### OpenClaw

Add governance to any OpenClaw skill. SidClaw evaluates every tool call against your policies before execution. <a href="https://docs.sidclaw.com/docs/integrations/openclaw" target="_blank">See the OpenClaw integration guide →</a>

### LangChain / LangGraph

```typescript
import { governTools } from '@sidclaw/sdk/langchain';
const governedTools = governTools(myTools, { client });
```

### Vercel AI SDK

```typescript
import { governVercelTool } from '@sidclaw/sdk/vercel-ai';
const governed = governVercelTool('myTool', myTool, { client });
```

### OpenAI Agents SDK

```typescript
import { governOpenAITool } from '@sidclaw/sdk/openai-agents';
const governed = governOpenAITool(myTool, { client });
```

Also supports: CrewAI, generic function wrapping, any async tool.

## Live Demos

Try SidClaw without installing anything:

| Demo | Industry | What You'll See | Link |
|------|----------|----------------|------|
| **Atlas Financial** | Finance (FINRA) | AI support agent with email approval flow | <a href="https://demo.sidclaw.com" target="_blank">demo.sidclaw.com</a> |
| **Nexus DevOps** | Platform Engineering | Infrastructure scaling with deployment approval | <a href="https://demo-devops.sidclaw.com" target="_blank">demo-devops.sidclaw.com</a> |
| **MedAssist** | Healthcare (HIPAA) | Clinical AI with physician approval for lab orders | <a href="https://demo-health.sidclaw.com" target="_blank">demo-health.sidclaw.com</a> |

Each demo uses **real SidClaw governance** — the policy evaluation, approval workflow, and audit traces are 100% authentic. Only the business data is simulated.

## Why This Exists

AI agents are being deployed in production, but the governance layer is missing:

- **73% of CISOs** fear AI agent risks, but only **30%** are ready (<a href="https://neuraltrust.ai/guides/the-state-of-ai-agent-security-2026" target="_blank">NeuralTrust 2026</a>)
- **79% of enterprises** have blind spots where agents act without oversight
- **FINRA 2026** explicitly requires "documented human checkpoints" for AI agent actions in financial services
- **EU AI Act** (August 2026) mandates human oversight, automatic logging, and risk management for high-risk AI systems
- **OpenClaw** has 329K+ stars and 5,700+ skills — but <a href="https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html" target="_blank">1,184 malicious skills were found</a> in the ClawHavoc campaign. There's no policy layer governing what skills can do.

The big vendors (Okta, SailPoint, WorkOS) handle identity and authorization. But none of them ship the **approval step** — the part where a human sees rich context and makes an informed decision before an agent acts.

## Platform Features

### For Developers
- **60-second setup** — `npx create-sidclaw-app` scaffolds a working governed agent
- **<50ms evaluation overhead** — the governance layer is invisible to your users
- **5-minute integration** — wrap existing tools, no code changes
- **MCP-native** — governance proxy for any MCP server
- **Framework-agnostic** — LangChain, Vercel AI, OpenAI, CrewAI, Pydantic AI, Composio, or plain functions
- **Typed SDKs** — TypeScript (npm) + Python (PyPI)

### For Security & Compliance Teams
- **Policy engine** — allow / approval_required / deny with priority ordering and classification hierarchy
- **Approval workflow** — context-rich cards with agent reasoning, risk classification, and separation of duties
- **Audit trails** — correlated traces with integrity hash chains (tamper-proof)
- **SIEM export** — JSON and CSV, continuous webhook delivery
- **Compliance mapping** — <a href="https://docs.sidclaw.com/docs/compliance/finra-2026" target="_blank">FINRA 2026</a>, <a href="https://docs.sidclaw.com/docs/compliance/eu-ai-act" target="_blank">EU AI Act</a>, <a href="https://docs.sidclaw.com/docs/compliance/nist-ai-rmf" target="_blank">NIST AI RMF</a>

### For Platform Teams
- **RBAC** — admin, reviewer, viewer roles with enforced permissions
- **Tenant isolation** — automatic tenant scoping on every query
- **API key management** — scoped keys with rotation
- **Rate limiting** — per-tenant, per-endpoint-category, plan-based tiers
- **Webhooks** — real-time notifications for approvals, traces, lifecycle events
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
                                                   ▼
                                         ┌──────────────────┐
                                         │  Dashboard       │
                                         │                  │
                                         │ Agent Registry   │
                                         │ Policy Management│
                                         │ Approval Queue   │
                                         │ Trace Viewer     │
                                         │ Settings & RBAC  │
                                         └──────────────────┘
```

## Deploy

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/github?repo=sidclawhq/platform)

Deploy from the GitHub repo to Railway. Add a PostgreSQL database, configure environment variables, and you're live.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsidclawhq%2Fplatform&root-directory=apps/dashboard&env=NEXT_PUBLIC_API_URL&envDescription=SidClaw%20API%20URL&envLink=https%3A%2F%2Fdocs.sidclaw.com%2Fdocs%2Fenterprise%2Fself-hosting&project-name=sidclaw-dashboard&repository-name=sidclaw-dashboard)

Deploy the dashboard to Vercel (requires a separately hosted API).

<details>
<summary>Deploy Docs or Landing Page to Vercel</summary>

**Docs:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsidclawhq%2Fplatform&root-directory=apps/docs&project-name=sidclaw-docs&repository-name=sidclaw-docs)

**Landing Page:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsidclawhq%2Fplatform&root-directory=apps/landing&project-name=sidclaw-landing&repository-name=sidclaw-landing)

</details>

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

See <a href="https://docs.sidclaw.com/docs/enterprise/self-hosting" target="_blank">deployment documentation</a> for production configuration, environment variables, and upgrade guides.

## Pricing

| | Free | Starter | Business | Enterprise |
|--|------|---------|----------|-----------|
| **Price** | CHF 0/mo | CHF 199/mo | CHF 999/mo | From CHF 3,000/mo |
| Agents | 5 | 15 | 100 | Unlimited |
| Policies per agent | 10 | 50 | Unlimited | Unlimited |
| API keys | 2 | 5 | 20 | Unlimited |
| Trace retention | 7 days | 30 days | 90 days | Custom |
| Webhooks | 1 | 3 | 10 | Unlimited |
| Support | Community | Email | Priority email | Dedicated + SLA |
| SSO/OIDC | — | — | ✓ | ✓ |
| Self-hosted | — | — | — | ✓ |
| | <a href="https://app.sidclaw.com/signup" target="_blank">Start Free</a> | <a href="mailto:hello@sidclaw.com">Start Starter</a> | <a href="mailto:hello@sidclaw.com">Start Business</a> | <a href="mailto:hello@sidclaw.com">Contact Sales</a> |

## Documentation

- <a href="https://docs.sidclaw.com/docs/quickstart" target="_blank">Quick Start</a> — 2 minutes to first governed action
- <a href="https://docs.sidclaw.com/docs/sdk/client" target="_blank">SDK Reference</a> — every method documented
- <a href="https://docs.sidclaw.com/docs/integrations/mcp" target="_blank">Integrations</a> — MCP, LangChain, Vercel AI, OpenAI, CrewAI, Composio
- <a href="https://docs.sidclaw.com/docs/platform/policies" target="_blank">Policy Guide</a> — authoring, versioning, testing
- <a href="https://docs.sidclaw.com/docs/compliance/finra-2026" target="_blank">Compliance</a> — FINRA, EU AI Act, NIST AI RMF
- <a href="https://docs.sidclaw.com/docs/api-reference" target="_blank">API Reference</a> — every endpoint

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

The SDK (`packages/sdk/`) is Apache 2.0. The platform (`apps/`) is FSL 1.1.

## License

- **SDK** (`packages/sdk/`, `packages/shared/`): [Apache License 2.0](LICENSE) — use freely for any purpose
- **Platform** (`apps/api/`, `apps/dashboard/`, `apps/docs/`, `apps/landing/`, `apps/demo*/`): [Functional Source License 1.1](LICENSE-PLATFORM) — free for evaluation, testing, education, and production use by organizations with annual revenue under CHF 1,000,000. Organizations above this threshold require a commercial license. Cannot offer as a competing hosted service. Converts to Apache 2.0 after 2 years.

## Links

- <a href="https://sidclaw.com" target="_blank">Website</a>
- <a href="https://docs.sidclaw.com" target="_blank">Documentation</a>
- <a href="https://app.sidclaw.com" target="_blank">Dashboard</a>
- <a href="https://www.npmjs.com/package/@sidclaw/sdk" target="_blank">npm</a>
- <a href="https://pypi.org/project/sidclaw/" target="_blank">Python SDK (PyPI)</a>
- <a href="https://github.com/sidclawhq/python-sdk" target="_blank">Python SDK (GitHub)</a>
- <a href="https://github.com/sidclawhq/platform" target="_blank">GitHub</a>
- <a href="mailto:hello@sidclaw.com">Contact</a>
