# SidClaw — AI Agent Governance Platform

IAM governance platform for AI agents. Four primitives: **Identity → Policy → Approval → Trace**. The approval step — where a human sees rich context and approves/denies an agent action — is the core differentiator.

**All 5 development phases are complete.** The platform is production-deployed and launch-ready.

## Repo Structure

```
platform/
├── packages/
│   ├── sdk/                   # @sidclaw/sdk v0.1.2 (Apache 2.0, open-source, published to npm)
│   │   ├── src/client/        # AgentIdentityClient, withGovernance(), errors
│   │   ├── src/middleware/    # Framework wrappers: LangChain, OpenAI Agents, CrewAI, Vercel AI, generic
│   │   ├── src/mcp/          # GovernanceMCPServer proxy + CLI binary (sidclaw-mcp-proxy)
│   │   └── src/webhooks/     # Webhook signature verification (HMAC-SHA256)
│   ├── create-sidclaw-app/     # npx create-sidclaw-app — interactive project scaffolding CLI
│   │   ├── src/               # CLI entry, scaffolder, API setup (creates agent + 3 demo policies)
│   │   └── templates/         # 7 framework templates (LangChain, Vercel AI, OpenAI Agents, MCP, plain)
│   └── shared/                # @sidclaw/shared — types, enums, Zod schemas, test factories
├── apps/
│   ├── api/                   # Fastify API (port 4000)
│   │   ├── src/services/      # PolicyEngine, ApprovalService, AgentService, PolicyService,
│   │   │                      # IntegrityService, WebhookService, EmailService, NotificationService,
│   │   │                      # ApiKeyService, BillingService, RiskClassification,
│   │   │                      # integrations/{SlackService, TelegramService}
│   │   ├── src/routes/        # evaluate, agents, policies, approvals, traces, dashboard, auth,
│   │   │                      # api-keys, webhooks, billing, tenant, users, admin, health,
│   │   │                      # integrations/{slack, telegram, settings}
│   │   ├── src/jobs/          # expire-approvals, trace-cleanup, webhook-delivery, session-cleanup, audit-batch
│   │   ├── src/middleware/    # auth, tenant, error-handler, plan-limits, rate-limit, require-role
│   │   ├── src/db/            # Prisma client, tenant-scoped client ($extends for isolation)
│   │   └── prisma/           # Schema (12 models), migrations (8), seed
│   ├── dashboard/             # Next.js 15 dashboard (port 3000) — 20 pages, 65 components
│   │   └── src/app/dashboard/ # overview, agents, policies, approvals, audit, architecture, settings/*
│   ├── docs/                  # Fumadocs documentation site (port 3001) — 40 MDX pages
│   │   └── content/docs/      # concepts, sdk, integrations, platform, enterprise, compliance, api-reference
│   ├── landing/               # Landing page (port 3002) — 12-section marketing site
│   ├── demo/                  # Atlas Financial demo — AI customer support (port 3003)
│   ├── demo-devops/           # Nexus DevOps demo — AI infrastructure ops (port 3004)
│   └── demo-healthcare/       # MedAssist Health demo — AI clinical assistant (port 3005)
├── python-sdk/                # Python SDK (separate git repo, published to PyPI as `sidclaw`)
│   ├── src/sidclaw/          # SidClaw, AsyncSidClaw, middleware, MCP proxy, webhooks
│   └── tests/                # 50 tests (pytest + respx)
├── integrations/
│   ├── langchain-python/     # `langchain-sidclaw` PyPI package (re-exports + GovernanceCallbackHandler)
│   ├── langchain-js/         # `@sidclaw/langchain-governance` npm package
│   ├── github-action/        # GitHub Action for CI governance checks
│   └── github-app/           # GitHub App integration scaffold
├── examples/
│   ├── mcp-postgres-governed/ # MCP governance proxy wrapping PostgreSQL server
│   ├── langchain-customer-support/ # LangChain tool governance example
│   └── vercel-ai-assistant/   # Vercel AI SDK chat app with governance
├── tests/
│   ├── e2e/                   # End-to-end test suite (Vitest)
│   └── browser/               # Playwright browser tests (disabled, needs update)
├── v0-prototype/              # Original client-side prototype (read-only reference)
├── scripts/demo.ts            # Demo script for design partners
├── research/                  # Market research, product plan, prompts, verification reports
│   ├── 2026-03-20-product-development-plan.md  # THE PLAN — read this for full context
│   └── prompts/               # Task prompts for Claude Code sessions
├── deployment/
│   └── .env.development       # Dev API key (created by prisma db seed)
├── .github/workflows/         # CI (lint, test, build, verify-sdk) + Release (npm publish)
├── docker-compose.yml         # Local dev (PostgreSQL)
├── docker-compose.production.yml  # Full stack (db, api, dashboard, docs, landing)
├── docker-compose.test.yml    # Test DB (port 5433, tmpfs for speed)
└── LICENSE-PLATFORM           # FSL-1.1 with Apache 2.0 conversion (2028-03-22)
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
# All TypeScript tests (~589 passing: 44 shared + 113 SDK + 432 API)
turbo test

# API integration tests (needs test DB running)
docker compose -f docker-compose.test.yml up -d
cd apps/api && npm test

# SDK tests (TypeScript)
cd packages/sdk && npm test

# Shared package tests
cd packages/shared && npm test

# Python SDK tests (50 tests)
cd python-sdk && source .venv/bin/activate && pytest tests/ -v

# LangChain integration tests (Python)
cd integrations/langchain-python && source .venv/bin/activate && pytest tests/ -v

# LangChain integration tests (JavaScript)
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
- **Auth during development:** When OIDC is not configured, the API provides a dev-login endpoint at `GET /api/v1/auth/dev-login` that auto-authenticates as the seeded admin user. Click "Sign in with SSO" on the dashboard login page to use it. Email/password login also works with the seeded credentials (`admin@example.com` / `admin`).

## Architecture

### Core Flow

1. **SDK** (`packages/sdk`) calls `POST /api/v1/evaluate` with agent ID + action details
2. **Policy Engine** (`apps/api/src/services/policy-engine.ts`) matches action against policy rules (priority-ordered, first-match-wins, secure-by-default deny)
3. **Evaluate endpoint** creates AuditTrace + AuditEvents (hash-chained for integrity) + ApprovalRequest (if needed)
4. **Approval Service** handles approve/deny with separation-of-duties check, creates audit events, finalizes traces
5. **Webhook + Email + Chat** dispatched post-commit (fire-and-forget, never blocks primary operations)
   - Slack: Block Kit message with interactive Approve/Deny buttons (callback via `chat.update`)
   - Telegram: HTML message with inline keyboard (callback via webhook)
6. **Background jobs** expire overdue approvals (60s), clean up old traces (1h), deliver webhooks (10s), clean sessions (1h)

### Key Technical Decisions

- **Integrity hash chains**: Each AuditEvent includes SHA-256 hash of its content + previous event's hash. Trace rows locked with `FOR UPDATE` during event creation. Verifiable via `GET /traces/:id/verify`.
- **Tenant isolation**: Prisma `$extends` injects `tenant_id` into all queries at runtime. Unscoped models (Tenant, BackgroundJob) excluded.
- **Plan limits**: Enforced in middleware — free (5 agents, 2 API keys, 7-day retention), starter, business, enterprise tiers.
- **Rate limiting**: Per-tenant, per-endpoint-category (evaluate/read/write), plan-tiered. In-memory (swap to Redis for multi-instance).
- **RBAC**: Three roles (admin, reviewer, viewer). Role check middleware for session auth; scope-based for API key auth.
- **Auth**: Email/password, GitHub OAuth, Google OIDC, Okta/Auth0 OIDC. CSRF tokens on state-changing requests.

### Database Schema (12 models)

Tenant, User, Session, Agent, PolicyRule, PolicyRuleVersion, ApprovalRequest, AuditTrace, AuditEvent, ApiKey, BackgroundJob, WebhookEndpoint, WebhookDelivery.

### SDK Framework Integrations

**TypeScript (`@sidclaw/sdk`):**

| Export | Framework | Pattern |
|--------|-----------|---------|
| `@sidclaw/sdk` | Any | `withGovernance()` wrapper, `AgentIdentityClient` |
| `@sidclaw/sdk/mcp` | MCP | `GovernanceMCPServer` proxy + `sidclaw-mcp-proxy` CLI |
| `@sidclaw/sdk/langchain` | LangChain | `governTools()` wraps tool arrays |
| `@sidclaw/sdk/openai-agents` | OpenAI Agents | `governOpenAITool()` wraps function tools |
| `@sidclaw/sdk/crewai` | CrewAI | `governCrewAITool()` wraps task tools |
| `@sidclaw/sdk/vercel-ai` | Vercel AI | `governVercelTools()` wraps tool objects |
| `@sidclaw/sdk/webhooks` | Any | `verifyWebhookSignature()` HMAC-SHA256 |

**Python (`sidclaw`):**

| Import | Framework | Pattern |
|--------|-----------|---------|
| `sidclaw` | Any | `SidClaw` / `AsyncSidClaw` clients, `with_governance()` decorator |
| `sidclaw.mcp` | MCP | `GovernanceMCPServer` proxy + `sidclaw-mcp-proxy` CLI |
| `sidclaw.middleware.langchain` | LangChain | `govern_tools()` wraps tool arrays |
| `sidclaw.middleware.crewai` | CrewAI | `govern_crewai_tool()` wraps task tools |
| `sidclaw.middleware.openai_agents` | OpenAI Agents | `govern_function_tool()` wraps function tools |
| `sidclaw.middleware.pydantic_ai` | Pydantic AI | `governance_dependency()` for tool functions |
| `sidclaw.webhooks` | Any | `verify_webhook_signature()` HMAC-SHA256 |

**Standalone LangChain integration packages** (for ecosystem discoverability):

| Package | Registry | What it adds |
|---------|----------|--------------|
| `langchain-sidclaw` | PyPI | Re-exports + `GovernanceCallbackHandler` (observe-only audit) |
| `@sidclaw/langchain-governance` | npm | Re-exports + `GovernanceCallbackHandler` (observe-only audit) |

### Dashboard Pages (20 routes)

Login, signup, overview, agents (list + detail), policies, approvals, audit (split-pane), architecture diagram, settings (general, billing, API keys, webhooks, integrations, audit export, users).

## Current State

**All 5 phases complete.** The platform has:

- ✅ Agent registry with CRUD, lifecycle management (active/suspended/revoked), metadata
- ✅ Policy engine with priority-based matching, versioning, dry-run testing, data classification hierarchy
- ✅ Approval queue with risk classification, context snapshots, separation-of-duties, expiry
- ✅ Audit traces with hash-chain integrity, event timeline, export (JSON/CSV), verification
- ✅ Overview dashboard with stats, pending approvals, recent traces, system health
- ✅ Global search across all entity types
- ✅ TypeScript SDK published to npm (`@sidclaw/sdk@0.1.2`) with 6 framework integrations
- ✅ Python SDK published to PyPI (`sidclaw@0.1.0`) with 6 framework integrations + sync/async clients
- ✅ LangChain integration packages: `langchain-sidclaw` (PyPI) + `@sidclaw/langchain-governance` (npm)
- ✅ MCP governance proxy with CLI binary and tool mappings (glob patterns)
- ✅ Webhook delivery with HMAC signatures, exponential retry (1m, 5m, 30m, 2h)
- ✅ Email notifications for approval requests (via Resend)
- ✅ Chat integrations: Slack (Block Kit + interactive buttons) and Telegram (inline keyboard + callback)
  - Approve/deny directly from chat — no need to open the dashboard
  - Messages update in-place after decision (Slack: `chat.update`, Telegram: remove buttons + reply)
  - Test notifications clearly labeled (no fake Approve/Deny buttons)
  - Dashboard settings page for configuration (Settings > Integrations)
- ✅ Auth: email/password, GitHub OAuth, Google OIDC, Okta/Auth0 OIDC
- ✅ RBAC (admin, reviewer, viewer) + API key scopes
- ✅ Plan-based limits and rate limiting (free/starter/business/enterprise)
- ✅ Billing integration (Stripe)
- ✅ Documentation site (43+ MDX pages: concepts, SDK, integrations, API reference, compliance, enterprise — Python examples on all SDK pages)
- ✅ Landing page (12 sections: hero, problem, primitives, demo, comparison, use cases, standards, pricing)
- ✅ Three vertical demos (financial services, DevOps, healthcare)
- ✅ Three example apps (MCP PostgreSQL, LangChain, Vercel AI)
- ✅ `npx create-sidclaw-app` — interactive CLI scaffolding 7 framework templates (LangChain Python/JS, Vercel AI, OpenAI Agents, MCP Proxy, Plain TS/Python)
- ✅ CI/CD: GitHub Actions (lint, typecheck, test, build, SDK verification, npm release with provenance)
- ✅ Docker: multi-stage builds for all apps, production compose, health checks
- ✅ 671 tests (44 shared + 113 TS SDK + 450 API + 50 Python SDK + 14 LangChain integrations), 6 E2E scenarios, demo script

### Licensing

- **TypeScript SDK** (`packages/sdk`): Apache 2.0 (open-source)
- **Python SDK** (`python-sdk/`): Apache 2.0 (open-source)
- **Integration packages** (`integrations/`): Apache 2.0
- **Platform** (`apps/*`): FSL-1.1 with Apache 2.0 conversion on 2028-03-22
- **Examples**: Apache 2.0
- **Documentation**: CC-BY-4.0

### Production Deployment

- API: https://api.sidclaw.com (Railway)
- Dashboard: https://app.sidclaw.com
- Docs: https://docs.sidclaw.com
- Landing: https://sidclaw.com

### Demos (live, production)

- Atlas Financial (finance/FINRA): https://demo.sidclaw.com
- Nexus DevOps (platform engineering): https://demo-devops.sidclaw.com
- MedAssist Healthcare (HIPAA): https://demo-health.sidclaw.com

### Distribution

- npm: https://www.npmjs.com/package/@sidclaw/sdk (v0.1.3)
- npm: https://www.npmjs.com/package/@sidclaw/langchain-governance (v0.1.1)
- npm: `create-sidclaw-app` (v0.1.0, not yet published — ready for `npm publish`)
- PyPI: https://pypi.org/project/sidclaw/ (v0.1.0)
- PyPI: https://pypi.org/project/langchain-sidclaw/ (v0.1.1)
- GitHub: https://github.com/sidclawhq/platform (public, FSL + Apache 2.0)
- GitHub: https://github.com/sidclawhq/python-sdk (public, Apache 2.0)
- ClawHub: sidclaw-governance skill (published, ID: k979nxbyd9pymhft4pg639drvd83dp9q)
- OpenClaw skill: `packages/openclaw-skill/` — SKILL.md + README for ClawHub
- LangChain docs PR: https://github.com/langchain-ai/docs/pull/3254 (pending review)

### Billing (Stripe)

- Currency: CHF (Swiss Francs) — targeting Swiss enterprise market
- Plans: free (CHF 0), starter (CHF 199/mo), business (CHF 999/mo), enterprise (from CHF 3,000/mo)
- Stripe products created in both test and live modes
- Webhook: `https://api.sidclaw.com/api/v1/billing/webhook`
- Founding Customer Offer: 50% off first year for first 10 customers

### Known Gaps

- In-memory rate limiter (needs Redis for horizontal scaling)
- No dashboard component tests (10K lines untested frontend; 99 Playwright E2E browser tests exist but are disabled pending update)
- MCP: only stdio transport implemented (sse/streamable-http stubbed)
- Some audit events use hardcoded "Dashboard User" instead of authenticated user identity
- Docs site search returns 500 (Fumadocs index not configured)
- No FINMA compliance mapping page yet (FINRA, EU AI Act, NIST done)
- Onboarding UI (API key dialog + checklist) may need polish
- Browser tests (99 Playwright specs) disabled in CI — need updating after recent changes
- Chat integrations: no cross-channel sync (approve on Telegram doesn't update Slack message, and vice versa)
- Chat integrations: Slack `chat.update` requires storing message `ts` for cross-channel updates

## Task Prompts

New Claude Code sessions are given task prompts from `research/prompts/`. The full product plan is in `research/2026-03-20-product-development-plan.md` (~2500 lines). **Sessions should read the full plan document** — not just their specific task section. The plan contains architecture decisions, cross-cutting concerns (error handling, testing, security, code style, observability, configuration), and dependency information that affects every task.

**What every session should read before starting work:**
1. This `CLAUDE.md` file (automatic)
2. The full `research/2026-03-20-product-development-plan.md` — at minimum: Overview, the current Phase section, and all Cross-Cutting Concerns (CC.1 through CC.7)
3. The specific task prompt from `research/prompts/`
4. Source files listed in the prompt's "read these files first" section

Standard session start prompt:
```
Read `research/prompts/P{X.Y}-{task-name}.md` and execute the task described in it.
Before starting, read the full product development plan at `research/2026-03-20-product-development-plan.md`
to understand the architecture, conventions, and cross-cutting concerns.
Do not ask clarifying questions — everything you need is in the prompt and the plan.
```
