# SidClaw Developer Guide

This guide is for developers working on the SidClaw codebase — whether contributing, building integrations, or understanding the architecture.

## What Is SidClaw

IAM governance platform for AI agents. Four primitives: **Identity → Policy → Approval → Trace**. The approval step — where a human sees rich context and approves/denies an agent action — is the core differentiator.

## Repo Structure

```
platform/
├── packages/
│   ├── sdk/                   # @sidclaw/sdk (Apache 2.0, published to npm)
│   │   ├── src/client/        # AgentIdentityClient, withGovernance(), errors
│   │   ├── src/middleware/    # Framework wrappers: LangChain, OpenAI Agents, CrewAI, Vercel AI,
│   │   │                      # Composio, Claude Agent SDK, Google ADK, LlamaIndex, NemoClaw, generic
│   │   ├── src/mcp/          # GovernanceMCPServer proxy + CLI binary (sidclaw-mcp-proxy)
│   │   ├── src/integrations/  # GitHub Check Runs for CI governance
│   │   └── src/webhooks/     # Webhook signature verification (HMAC-SHA256)
│   ├── create-sidclaw-app/    # npx create-sidclaw-app — interactive project scaffolding CLI
│   └── shared/                # @sidclaw/shared — types, enums, Zod schemas, test factories
├── apps/
│   ├── api/                   # Fastify API (port 4000)
│   │   ├── src/services/      # PolicyEngine, ApprovalService, AgentService, PolicyService,
│   │   │                      # IntegrityService, WebhookService, EmailService, NotificationService,
│   │   │                      # ApiKeyService, BillingService, RiskClassification,
│   │   │                      # integrations/{SlackService, TeamsService, TelegramService}
│   │   ├── src/routes/        # REST API endpoints + integrations/{slack, teams, telegram, settings}
│   │   ├── src/jobs/          # Background jobs (approval expiry, trace cleanup, webhooks, session cleanup)
│   │   ├── src/middleware/    # auth, tenant, error-handler, plan-limits, rate-limit, require-role
│   │   ├── src/db/            # Prisma client, tenant-scoped client
│   │   └── prisma/           # Schema (12 models), migrations, seed
│   ├── dashboard/             # Next.js 15 dashboard (port 3000) — 20 pages, 65 components
│   ├── docs/                  # Fumadocs documentation site (port 3001) — 54 MDX pages
│   ├── landing/               # Landing page (port 3002)
│   ├── demo/                  # Atlas Financial demo (port 3003)
│   ├── demo-devops/           # Nexus DevOps demo (port 3004)
│   └── demo-healthcare/       # MedAssist Health demo (port 3005)
├── python-sdk/                # Python SDK (published to PyPI as `sidclaw`)
├── integrations/
│   ├── langchain-python/     # `langchain-sidclaw` PyPI package
│   ├── langchain-js/         # `@sidclaw/langchain-governance` npm package
│   ├── github-action/        # `sidclawhq/governance-action@v1`
│   └── github-app/           # GitHub App manifest (github.com/apps/sidclaw-governance)
├── examples/                  # MCP PostgreSQL, LangChain, Vercel AI, NemoClaw examples
├── tests/
│   ├── e2e/                   # End-to-end tests (Vitest)
│   └── browser/               # Playwright browser tests
├── deploy/                    # Railway template, self-host script
└── docker-compose.yml         # Local dev (PostgreSQL)
```

## Running Locally

```bash
# 1. Start PostgreSQL
docker compose up db -d

# 2. Generate Prisma client, run migrations, and seed
cd apps/api && npx prisma generate && npx prisma migrate deploy && npx prisma db seed

# 3. Start API (terminal 1)
cd apps/api && npm run dev

# 4. Start dashboard (terminal 2)
cd apps/dashboard && npm run dev

# 5. Log into the dashboard
# Development credentials: admin@example.com / admin
# Or click "Sign in with SSO" to auto-login via the dev-login endpoint (no password needed)

# 6. Run demo
AGENT_IDENTITY_API_KEY=$(grep AGENT_IDENTITY_API_KEY deployment/.env.development | cut -d= -f2) npx tsx scripts/demo.ts

# Optional: start docs, landing, or demo apps
cd apps/docs && npm run dev       # port 3001
cd apps/landing && npm run dev    # port 3002
cd apps/demo && npm run dev       # port 3003
```

> **Running dashboard on a different port?** Set `ALLOWED_ORIGINS` when starting the API:
> `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3010 npm run dev`

## Testing

```bash
# All TypeScript tests
turbo test

# API integration tests (needs test DB running)
docker compose -f docker-compose.test.yml up -d
cd apps/api && npm test

# SDK tests (TypeScript)
cd packages/sdk && npm test

# Shared package tests
cd packages/shared && npm test

# Python SDK tests
cd python-sdk && source .venv/bin/activate && pytest tests/ -v

# LangChain integration tests
cd integrations/langchain-python && source .venv/bin/activate && pytest tests/ -v
cd integrations/langchain-js && npm test

# E2E tests (needs API running on port 4000 against test DB)
npx vitest run --config tests/e2e/vitest.config.ts
```

## Code Conventions

- **TypeScript strict everywhere.** No `any` in public API surfaces.
- **Files:** `kebab-case.ts`. Classes/interfaces: `PascalCase`. Functions/variables: `camelCase`. Constants: `SCREAMING_SNAKE_CASE`.
- **Database columns:** `snake_case`. **API routes:** `kebab-case`. **Env vars:** `SCREAMING_SNAKE_CASE`.
- **One class per file.** Tests co-located as `*.test.ts`. Integration tests in `__tests__/`.
- **API route handlers:** validate input (Zod) → call service → format response. No business logic in routes.
- **Enums stored as strings** in PostgreSQL, validated by Zod at application layer.
- **Migrations are forward-only.** No down migrations.
- **Seed script is idempotent.** Safe to run multiple times.
- **Test data:** always use factory functions from `@sidclaw/shared` test-utils. Never raw object literals.
- **Error responses:** always use the `ApiError` shape: `{ error, message, status, details?, trace_id?, request_id }`.
- **No cross-tenant leakage.** Tenant isolation enforced at runtime via Prisma `$extends`. Return 404 (not 403) for resources belonging to other tenants.
- **"Institutional Calm" design:** dark mode (#0A0A0B background), muted text (#E4E4E7), restrained color. No gradients, no AI sparkle. Amber (#F59E0B) for flagged items, green (#22C55E) for success, red (#EF4444) for deny, blue (#3B82F6) for info. Monospace (JetBrains Mono) for trace IDs, timestamps, technical data.
- **Auth during development:** When OIDC is not configured, the API provides a dev-login endpoint at `GET /api/v1/auth/dev-login` that auto-authenticates as the seeded admin user.

## Architecture

### Core Flow

1. **SDK** (`packages/sdk`) calls `POST /api/v1/evaluate` with agent ID + action details
2. **Policy Engine** matches action against policy rules (priority-ordered, first-match-wins, secure-by-default deny)
3. **Evaluate endpoint** creates AuditTrace + AuditEvents (hash-chained for integrity) + ApprovalRequest (if needed)
4. **Approval Service** handles approve/deny with separation-of-duties check, creates audit events, finalizes traces
5. **Notifications** dispatched post-commit (fire-and-forget): webhooks, email (Resend), Slack (Block Kit + interactive buttons), Teams (Adaptive Cards), Telegram (inline keyboard)
6. **Background jobs** expire overdue approvals (60s), clean up old traces (1h), deliver webhooks (10s), clean sessions (1h)

### Key Technical Decisions

- **Integrity hash chains**: Each AuditEvent includes SHA-256 hash of content + previous event's hash. Trace rows locked with `FOR UPDATE`.
- **Tenant isolation**: Prisma `$extends` injects `tenant_id` into all queries at runtime.
- **Plan limits**: Enforced in middleware.
- **Rate limiting**: Per-tenant, per-endpoint-category. In-memory (swap to Redis for multi-instance).
- **RBAC**: Three roles (admin, reviewer, viewer). Role middleware for session auth; scope-based for API key auth.
- **Auth**: Email/password, GitHub OAuth, Google OIDC, Okta/Auth0 OIDC. CSRF tokens on state-changing requests.

### Database Schema (12 models)

Tenant, User, Session, Agent, PolicyRule, PolicyRuleVersion, ApprovalRequest, AuditTrace, AuditEvent, ApiKey, BackgroundJob, WebhookEndpoint, WebhookDelivery.

### SDK Framework Integrations

**TypeScript (`@sidclaw/sdk`):**

| Export | Framework | Pattern |
|--------|-----------|---------|
| `@sidclaw/sdk` | Core | `AgentIdentityClient`, `withGovernance()` |
| `@sidclaw/sdk/mcp` | MCP | `GovernanceMCPServer` proxy + `sidclaw-mcp-proxy` CLI |
| `@sidclaw/sdk/langchain` | LangChain | `governTools()` wraps tool arrays |
| `@sidclaw/sdk/openai-agents` | OpenAI Agents | `governOpenAITool()` wraps function tools |
| `@sidclaw/sdk/crewai` | CrewAI | `governCrewAITool()` wraps task tools |
| `@sidclaw/sdk/vercel-ai` | Vercel AI | `governVercelTools()` wraps tool objects |
| `@sidclaw/sdk/composio` | Composio | `governComposioExecution()` wraps 500+ managed tools |
| `@sidclaw/sdk/claude-agent-sdk` | Claude Agent SDK | `governClaudeAgentTool()` wraps Anthropic agent tools |
| `@sidclaw/sdk/google-adk` | Google ADK | `governGoogleADKTool()` wraps Google agent tools |
| `@sidclaw/sdk/llamaindex` | LlamaIndex | `governLlamaIndexTool()` wraps LlamaIndex tools |
| `@sidclaw/sdk/nemoclaw` | NemoClaw | `governNemoClawTools()` wraps sandbox tools |
| `@sidclaw/sdk/webhooks` | Webhooks | `verifyWebhookSignature()` HMAC-SHA256 |
| `@sidclaw/sdk/github` | GitHub Actions | `createApprovalCheckRun()` for CI governance |

**Python (`sidclaw`):**

| Import | Framework | Pattern |
|--------|-----------|---------|
| `sidclaw` | Core | `SidClaw` / `AsyncSidClaw` clients, `with_governance()` decorator |
| `sidclaw.mcp` | MCP | `GovernanceMCPServer` proxy + `sidclaw-mcp-proxy` CLI |
| `sidclaw.middleware.langchain` | LangChain | `govern_tools()` wraps tool arrays |
| `sidclaw.middleware.openai_agents` | OpenAI Agents | `govern_function_tool()` wraps function tools |
| `sidclaw.middleware.crewai` | CrewAI | `govern_crewai_tool()` wraps task tools |
| `sidclaw.middleware.pydantic_ai` | Pydantic AI | `governance_dependency()` for tool functions |
| `sidclaw.middleware.composio` | Composio | `govern_composio_execution()` wraps 500+ managed tools |
| `sidclaw.middleware.claude_agent_sdk` | Claude Agent SDK | `govern_claude_agent_tool()` wraps Anthropic agent tools |
| `sidclaw.middleware.google_adk` | Google ADK | `govern_google_adk_tool()` wraps Google agent tools |
| `sidclaw.middleware.llamaindex` | LlamaIndex | `govern_llamaindex_tool()` wraps LlamaIndex tools |
| `sidclaw.middleware.nemoclaw` | NemoClaw | `govern_nemoclaw_tools()` wraps sandbox tools |
| `sidclaw.webhooks` | Webhooks | `verify_webhook_signature()` HMAC-SHA256 |

### Notification Channels

Approval requests are delivered to reviewers via chat integrations. Approve/deny directly from the message — no dashboard needed.

| Channel | Implementation | Features |
|---------|---------------|----------|
| **Slack** | `SlackService` | Block Kit messages, interactive Approve/Deny buttons, `chat.update` after decision |
| **Microsoft Teams** | `TeamsService` | Adaptive Cards, Bot Framework interactive buttons or webhook mode |
| **Telegram** | `TelegramService` | HTML messages, inline keyboard, callback removes buttons + adds reply |
| **Email** | `EmailService` (Resend) | Transactional email notifications for approval requests |

### Platform Integrations

Beyond SDK middleware, SidClaw integrates at the platform level with:

| Integration | Type | Description |
|---|---|---|
| **OpenClaw** | Governance proxy | Published as `sidclaw-governance` on ClawHub. Governs any OpenClaw skill. |
| **Copilot Studio** | OpenAPI action | Governance for Microsoft Copilot Studio skills. |
| **GitHub Copilot** | HTTP transport | Governance for GitHub Copilot agents. |
| **GitHub Action** | CI/CD | `sidclawhq/governance-action@v1` — reusable governance step for GitHub Actions. |
| **GitHub App** | CI/CD | `sidclaw-governance` — Check Run approve/deny buttons for deployment governance. |

### Licensing

- **SDK** (`packages/sdk`): Apache 2.0
- **Python SDK** (`python-sdk/`): Apache 2.0
- **Integration packages** (`integrations/`): Apache 2.0
- **Platform** (`apps/*`): FSL-1.1 with Apache 2.0 conversion on 2028-03-22
- **Examples**: Apache 2.0
