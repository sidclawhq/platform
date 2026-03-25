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
│   │   ├── src/middleware/    # Framework wrappers: LangChain, OpenAI Agents, CrewAI, Vercel AI, generic
│   │   ├── src/mcp/          # GovernanceMCPServer proxy + CLI binary (sidclaw-mcp-proxy)
│   │   └── src/webhooks/     # Webhook signature verification (HMAC-SHA256)
│   ├── create-sidclaw-app/    # npx create-sidclaw-app — interactive project scaffolding CLI
│   └── shared/                # @sidclaw/shared — types, enums, Zod schemas, test factories
├── apps/
│   ├── api/                   # Fastify API (port 4000)
│   │   ├── src/services/      # PolicyEngine, ApprovalService, AgentService, PolicyService, etc.
│   │   ├── src/routes/        # REST API endpoints
│   │   ├── src/jobs/          # Background jobs (approval expiry, trace cleanup, webhooks)
│   │   ├── src/middleware/    # auth, tenant, error-handler, plan-limits, rate-limit, require-role
│   │   ├── src/db/            # Prisma client, tenant-scoped client
│   │   └── prisma/           # Schema, migrations, seed
│   ├── dashboard/             # Next.js 15 dashboard (port 3000)
│   ├── docs/                  # Fumadocs documentation site (port 3001)
│   ├── landing/               # Landing page (port 3002)
│   ├── demo/                  # Atlas Financial demo (port 3003)
│   ├── demo-devops/           # Nexus DevOps demo (port 3004)
│   └── demo-healthcare/       # MedAssist Health demo (port 3005)
├── python-sdk/                # Python SDK (published to PyPI as `sidclaw`)
├── integrations/              # LangChain packages, GitHub Action/App
├── examples/                  # MCP PostgreSQL, LangChain, Vercel AI examples
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
5. **Notifications** dispatched post-commit (fire-and-forget): webhooks, email (Resend), Slack, Teams, Telegram
6. **Background jobs** expire overdue approvals (60s), clean up old traces (1h), deliver webhooks (10s)

### Key Technical Decisions

- **Integrity hash chains**: Each AuditEvent includes SHA-256 hash of content + previous event's hash. Trace rows locked with `FOR UPDATE`.
- **Tenant isolation**: Prisma `$extends` injects `tenant_id` into all queries at runtime.
- **Plan limits**: Enforced in middleware — free, starter, business, enterprise tiers.
- **Rate limiting**: Per-tenant, per-endpoint-category. In-memory (swap to Redis for multi-instance).
- **RBAC**: Three roles (admin, reviewer, viewer). Role middleware for session auth; scope-based for API key auth.
- **Auth**: Email/password, GitHub OAuth, Google OIDC, Okta/Auth0 OIDC. CSRF tokens on state-changing requests.

### Database Schema

Tenant, User, Session, Agent, PolicyRule, PolicyRuleVersion, ApprovalRequest, AuditTrace, AuditEvent, ApiKey, BackgroundJob, WebhookEndpoint, WebhookDelivery.

### SDK Framework Integrations

**TypeScript (`@sidclaw/sdk`):**

| Export | Framework |
|--------|-----------|
| `@sidclaw/sdk` | Core client, `withGovernance()` |
| `@sidclaw/sdk/mcp` | GovernanceMCPServer proxy |
| `@sidclaw/sdk/langchain` | `governTools()` |
| `@sidclaw/sdk/openai-agents` | `governOpenAITool()` |
| `@sidclaw/sdk/crewai` | `governCrewAITool()` |
| `@sidclaw/sdk/vercel-ai` | `governVercelTools()` |
| `@sidclaw/sdk/webhooks` | `verifyWebhookSignature()` |

**Python (`sidclaw`):**

| Import | Framework |
|--------|-----------|
| `sidclaw` | `SidClaw` / `AsyncSidClaw` clients |
| `sidclaw.mcp` | GovernanceMCPServer proxy |
| `sidclaw.middleware.langchain` | `govern_tools()` |
| `sidclaw.middleware.crewai` | `govern_crewai_tool()` |
| `sidclaw.middleware.openai_agents` | `govern_function_tool()` |
| `sidclaw.middleware.pydantic_ai` | `governance_dependency()` |

### Licensing

- **SDK** (`packages/sdk`): Apache 2.0
- **Platform** (`apps/*`): FSL-1.1 with Apache 2.0 conversion after 2 years
- **Examples**: Apache 2.0
