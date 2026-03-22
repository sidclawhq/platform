# Task: Create GitHub README & Polish Repository for Launch

## Context

You are working on the **SidClaw** platform — the approval and accountability layer for agentic AI. Read these files first:

1. `research/2026-03-20-product-development-plan.md` — Overview section for product understanding.
2. `research/2026-03-20-market-viability-assessment.md` — Executive summary and positioning.
3. `packages/sdk/README.md` — existing SDK README (for code examples).
4. `packages/sdk/package.json` — SDK metadata.
5. `apps/landing/src/app/page.tsx` — landing page content (for consistent messaging).
6. `apps/demo/`, `apps/demo-devops/`, `apps/demo-healthcare/` — three demo apps.

**Brand:** SidClaw. Domain: `sidclaw.com`. GitHub: `github.com/sidclawhq/platform`. npm: `@sidclaw/sdk`.

**Key context from market research:**
- 73% of CISOs fear AI agent risks, only 30% are ready (NeuralTrust 2026)
- FINRA 2026 explicitly mandates human-in-the-loop for AI agent actions
- EU AI Act high-risk enforcement hits August 2026
- No competitor has shipped the full Identity + Policy + Approval + Trace stack
- OpenClaw (329K+ GitHub stars) has a documented security crisis with its skills ecosystem — SidClaw is the governance layer it's missing

**The README is your storefront.** Most developers will see this before anything else. It must communicate the value proposition in 5 seconds, show the product in 15 seconds (GIFs), and let them try it in 2 minutes (quick start).

## What To Do

### 1. Create Root README.md

Create `/Users/vlpetrov/Documents/Programming/agent-identity/README.md` with the following structure and content:

```markdown
<div align="center">

# SidClaw

**The approval and accountability layer for agentic AI**

Identity. Policy. Approval. Trace.

[![npm version](https://img.shields.io/npm/v/@sidclaw/sdk?style=flat-square&color=3B82F6)](https://www.npmjs.com/package/@sidclaw/sdk)
[![License: Apache-2.0](https://img.shields.io/badge/SDK-Apache%202.0-22C55E?style=flat-square)](LICENSE)
[![License: FSL](https://img.shields.io/badge/Platform-FSL%201.1-F59E0B?style=flat-square)](LICENSE-PLATFORM)
[![CI](https://img.shields.io/github/actions/workflow/status/sidclawhq/platform/ci.yml?style=flat-square&label=tests)](https://github.com/sidclawhq/platform/actions)
[![Tests](https://img.shields.io/badge/tests-688-22C55E?style=flat-square)]()

[Website](https://sidclaw.com) · [Documentation](https://docs.sidclaw.com) · [Live Demo](https://demo.sidclaw.com) · [SDK on npm](https://www.npmjs.com/package/@sidclaw/sdk)

</div>

---

Your AI agents are acting without oversight. SidClaw adds the missing governance layer — policy evaluation, human approval with rich context, and tamper-proof audit trails — without changing your agent code.

**What makes SidClaw different:** Everyone else does Identity + Policy + Audit. SidClaw adds the **Approval** primitive — where a human sees exactly what an agent wants to do, why it was flagged, the agent's reasoning, and the risk level — then approves or denies with one click. That's what [FINRA 2026 mandates](https://docs.sidclaw.com/docs/compliance/finra-2026), what the [EU AI Act requires](https://docs.sidclaw.com/docs/compliance/eu-ai-act), and what no one else has shipped.

## See It In Action

### Customer Support Agent (Financial Services)

<!-- GIF: Atlas Financial demo — agent sends email → approval card appears → reviewer approves → trace complete -->
![Atlas Financial Demo](docs/assets/demo-financial.gif)

*An AI agent wants to send a customer email. Policy flags it for review. The reviewer sees full context — who, what, why — and approves with one click. Every step is traced.*

### Infrastructure Automation (DevOps)

<!-- GIF: Nexus DevOps demo — agent scales service → approval required → approve → deployed -->
![DevOps Demo](docs/assets/demo-devops.gif)

*An AI agent wants to scale production services. High-risk deployments require human approval. Read-only monitoring is allowed instantly.*

### Clinical Decision Support (Healthcare)

<!-- GIF: MedAssist demo — agent orders labs → approval required → physician approves → order placed -->
![Healthcare Demo](docs/assets/demo-healthcare.gif)

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

Open [app.sidclaw.com](https://app.sidclaw.com) to see approval requests, audit traces, and policy decisions in real-time.

## Integrations

SidClaw wraps your existing agent tools — no changes to your agent logic.

### MCP (Model Context Protocol)

Wrap any MCP server with governance. Works with Claude, ChatGPT, Cursor, and any MCP-compatible client.

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

Add governance to any OpenClaw skill. SidClaw evaluates every tool call against your policies before execution. [See the OpenClaw integration guide →](https://docs.sidclaw.com/docs/integrations/openclaw)

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
| **Atlas Financial** | Finance (FINRA) | AI support agent with email approval flow | [demo.sidclaw.com](https://demo.sidclaw.com) |
| **Nexus DevOps** | Platform Engineering | Infrastructure scaling with deployment approval | [demo-devops.sidclaw.com](https://demo-devops.sidclaw.com) |
| **MedAssist** | Healthcare (HIPAA) | Clinical AI with physician approval for lab orders | [demo-healthcare.sidclaw.com](https://demo-healthcare.sidclaw.com) |

Each demo uses **real SidClaw governance** — the policy evaluation, approval workflow, and audit traces are 100% authentic. Only the business data is simulated.

## Why This Exists

AI agents are being deployed in production, but the governance layer is missing:

- **73% of CISOs** fear AI agent risks, but only **30%** are ready ([NeuralTrust 2026](https://neuraltrust.ai/guides/the-state-of-ai-agent-security-2026))
- **79% of enterprises** have blind spots where agents act without oversight
- **FINRA 2026** explicitly requires "documented human checkpoints" for AI agent actions in financial services
- **EU AI Act** (August 2026) mandates human oversight, automatic logging, and risk management for high-risk AI systems
- **OpenClaw** has 329K+ stars and 5,700+ skills — but [1,184 malicious skills were found](https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html) in the ClawHavoc campaign. There's no policy layer governing what skills can do.

The big vendors (Okta, SailPoint, WorkOS) handle identity and authorization. But none of them ship the **approval step** — the part where a human sees rich context and makes an informed decision before an agent acts.

## Platform Features

### For Developers
- **5-minute integration** — wrap existing tools, no code changes
- **MCP-native** — governance proxy for any MCP server
- **Framework-agnostic** — LangChain, Vercel AI, OpenAI, CrewAI, or plain functions
- **Typed SDK** — TypeScript, dual CJS/ESM, <200KB

### For Security & Compliance Teams
- **Policy engine** — allow / approval_required / deny with priority ordering and classification hierarchy
- **Approval workflow** — context-rich cards with agent reasoning, risk classification, and separation of duties
- **Audit trails** — correlated traces with integrity hash chains (tamper-proof)
- **SIEM export** — JSON and CSV, continuous webhook delivery
- **Compliance mapping** — [FINRA 2026](https://docs.sidclaw.com/docs/compliance/finra-2026), [EU AI Act](https://docs.sidclaw.com/docs/compliance/eu-ai-act), [NIST AI RMF](https://docs.sidclaw.com/docs/compliance/nist-ai-rmf)

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

## Self-Hosting

SidClaw is designed to be self-hosted. The SDK is Apache 2.0 open source. The platform is source-available under the [Functional Source License](LICENSE-PLATFORM).

```bash
# Clone
git clone https://github.com/sidclawhq/platform.git
cd platform

# Start
docker compose up -d

# Migrate and seed
cd apps/api && npx prisma migrate deploy && npx prisma db seed

# Open
open http://localhost:3000  # Dashboard
open http://localhost:4000/health  # API
```

See [deployment documentation](https://docs.sidclaw.com/docs/enterprise/self-hosting) for production configuration.

## Pricing

| | Free | Team | Enterprise |
|--|------|------|-----------|
| Agents | 5 | 50 | Unlimited |
| Policies per agent | 10 | Unlimited | Unlimited |
| API keys | 2 | 10 | Unlimited |
| Trace retention | 7 days | 90 days | Custom |
| Support | Community | Email | Dedicated + SLA |
| SSO/OIDC | — | — | ✓ |
| | [Start Free](https://app.sidclaw.com/signup) | [Contact](mailto:hello@sidclaw.com) | [Contact](mailto:hello@sidclaw.com) |

## Documentation

- [Quick Start](https://docs.sidclaw.com/docs/quickstart) — 2 minutes to first governed action
- [SDK Reference](https://docs.sidclaw.com/docs/sdk/client) — every method documented
- [Integrations](https://docs.sidclaw.com/docs/integrations/mcp) — MCP, LangChain, Vercel AI, OpenAI, CrewAI
- [Policy Guide](https://docs.sidclaw.com/docs/platform/policies) — authoring, versioning, testing
- [Compliance](https://docs.sidclaw.com/docs/compliance/finra-2026) — FINRA, EU AI Act, NIST AI RMF
- [API Reference](https://docs.sidclaw.com/docs/api-reference) — every endpoint

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

The SDK (`packages/sdk/`) is Apache 2.0. The platform (`apps/`) is FSL 1.1.

## License

- **SDK** (`packages/sdk/`, `packages/shared/`): [Apache License 2.0](LICENSE)
- **Platform** (`apps/api/`, `apps/dashboard/`, `apps/docs/`, `apps/landing/`, `apps/demo*/`): [Functional Source License 1.1](LICENSE-PLATFORM) — converts to Apache 2.0 after 2 years. You can self-host for internal use. You cannot offer SidClaw as a hosted service to third parties.

## Links

- [Website](https://sidclaw.com)
- [Documentation](https://docs.sidclaw.com)
- [Dashboard](https://app.sidclaw.com)
- [npm](https://www.npmjs.com/package/@sidclaw/sdk)
- [GitHub](https://github.com/sidclawhq/platform)
- [Contact](mailto:hello@sidclaw.com)
```

### 2. Create FSL License File

Create `LICENSE-PLATFORM` at the project root with the Functional Source License 1.1 text.

The FSL 1.1 template is available at `https://fsl.software/`. Key parameters:
- **Licensor:** SidClaw (or your legal entity name)
- **Software:** SidClaw Platform
- **Use Limitation:** You may not use the Licensed Work to provide a commercial hosted service that competes with the Licensor's offerings.
- **Change License:** Apache License 2.0
- **Change Date:** Two years from each release date

Fetch the FSL 1.1 text from the official source and fill in these parameters. If you cannot fetch it, create a placeholder file with these terms clearly stated.

The existing `LICENSE` file (Apache 2.0) stays as-is — it covers the SDK.

### 3. Create GIF Placeholder Directory

```bash
mkdir -p docs/assets
```

Create placeholder files that the user will replace with actual GIF recordings:

```bash
touch docs/assets/demo-financial.gif
touch docs/assets/demo-devops.gif
touch docs/assets/demo-healthcare.gif
```

Also create a note file explaining what each GIF should show:

Create `docs/assets/GIF-RECORDING-GUIDE.md`:

```markdown
# GIF Recording Guide

Record these three GIFs from the live demos. Each should be 15-25 seconds, 1200px wide, dark theme.

## demo-financial.gif (Atlas Financial)
1. Open demo.sidclaw.com
2. Type "Send a follow-up email to Sarah Johnson"
3. Show the agent pausing
4. Show the approval card appearing on the right (amber "Why This Was Flagged")
5. Click Approve
6. Show the agent continuing
7. Show the completed trace

## demo-devops.gif (Nexus DevOps)
1. Open demo-devops.sidclaw.com
2. Click "Scale user-service to 6 replicas"
3. Show the approval card with infrastructure context
4. Approve it
5. Click "Delete idle namespace" — show it blocked
6. Show the governance panel with ALLOWED, APPROVED, and BLOCKED traces

## demo-healthcare.gif (MedAssist)
1. Open demo-healthcare.sidclaw.com
2. Click "Order labs" — show approval required
3. Show the clinical context in the approval card
4. Approve the lab order
5. Click "Prescribe medication" — show it blocked by policy
6. Show the complete trace timeline

## Tips
- Use a screen recorder like Kap, CleanShot X, or OBS
- Record at 1440x900 or similar (not full screen)
- Keep under 25 seconds per GIF
- Convert to GIF with: ffmpeg -i input.mov -vf "fps=12,scale=1200:-1" -gifflags +transdiff demo.gif
- Or use gifski for better quality: gifski --fps 12 --width 1200 -o demo.gif frames/*.png
- Target file size: under 5MB per GIF for fast README loading
```

### 4. Update .gitignore

Ensure GIF files are tracked (not ignored):

Check `.gitignore` — make sure it does NOT have `*.gif` or `docs/assets/` excluded.

### 5. Add Star History Badge

The README includes a star history chart link. After the repo is public and gets some stars, you can add this section. For now, leave it out — an empty star history chart looks worse than none.

### 6. Verify All Links

After creating the README, verify every link is correct:

```bash
# Extract all URLs from README
grep -oP 'https?://[^\s)]+' README.md | sort -u
```

Verify each URL:
- `https://sidclaw.com` — landing page
- `https://app.sidclaw.com` — dashboard
- `https://docs.sidclaw.com` — documentation
- `https://demo.sidclaw.com` — Atlas Financial demo
- `https://demo-devops.sidclaw.com` — DevOps demo (verify this is the actual URL)
- `https://demo-healthcare.sidclaw.com` — Healthcare demo (verify this is the actual URL)
- `https://www.npmjs.com/package/@sidclaw/sdk` — npm package
- `https://github.com/sidclawhq/platform` — this repo
- All docs.sidclaw.com links

For demo URLs: check what the actual Railway deployment URLs are. The demo apps may be at different subdomains or paths. Update the README to match the real URLs.

### 7. Update Package.json Repository Field

Verify root `package.json` has:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/sidclawhq/platform"
  }
}
```

### 8. Verify the Repo is Clean

```bash
# Check for any files that shouldn't be committed
git status

# Ensure no secrets in tracked files
grep -r "AGENT_IDENTITY_API_KEY\|api_key.*=.*ai_\|password.*=.*[^{]" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.env" . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=v0-prototype | \
  grep -v "\.env\.example" | grep -v "test" | grep -v "mock" | head -20

# Ensure .env files are gitignored
cat .gitignore | grep -i env
```

### 9. Final README Verification

After everything is in place:

1. Open the README in a markdown previewer (or push and check on GitHub)
2. Verify:
   - Badges render correctly
   - Code blocks have syntax highlighting
   - GIF placeholders show (they'll be empty until you add real GIFs)
   - All links are clickable
   - The architecture diagram renders in monospace
   - The pricing table renders correctly
   - No broken markdown formatting

## Acceptance Criteria

- [ ] Root `README.md` created with all sections: hero, GIFs, how it works, quick start, integrations (including OpenClaw), live demos, why this exists, features, architecture, self-hosting, pricing, docs, contributing, license
- [ ] `LICENSE-PLATFORM` (FSL 1.1) created with correct parameters
- [ ] Existing `LICENSE` (Apache 2.0) unchanged (covers SDK)
- [ ] `docs/assets/` directory created with GIF placeholders and recording guide
- [ ] All URLs verified and correct
- [ ] No secrets in tracked files
- [ ] Repository field updated in package.json
- [ ] README renders correctly in markdown preview
- [ ] OpenClaw is mentioned in integrations section and "Why This Exists" section
- [ ] FINRA 2026, EU AI Act cited with links to compliance docs
- [ ] NeuralTrust stats cited with source
- [ ] OpenClaw security crisis referenced with source link
- [ ] Three demo links present and correct
- [ ] Self-hosting instructions work (docker compose up)
- [ ] `turbo build` still succeeds

## Constraints

- Do NOT modify any application code (SDK, API, dashboard, demos)
- Do NOT create actual GIF files (the user will record those manually)
- Do NOT publish or push to GitHub (the user will do that after adding GIFs)
- The FSL license text must be the official FSL 1.1 — fetch from fsl.software or use the canonical text
- Follow the exact README structure above — this has been designed based on research into what gets stars and engagement
