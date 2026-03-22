# Agent Identity & Approval Layer

IAM governance platform for AI agents. Four primitives: **Identity → Policy → Approval → Trace**. The approval step — where a human sees rich context and approves/denies an agent action — is the core differentiator.

## Repo Structure

```
agent-identity/
├── packages/
│   ├── sdk/                   # @sidclaw/sdk (Apache 2.0, open-source)
│   │   └── src/client/        # AgentIdentityClient, withGovernance(), errors
│   └── shared/                # @sidclaw/shared — types, enums, Zod schemas, test factories
├── apps/
│   ├── api/                   # Fastify API (port 4000)
│   │   ├── src/services/      # PolicyEngine, ApprovalService, AgentService, PolicyService
│   │   ├── src/routes/        # evaluate, agents, policies, approvals, traces, dashboard
│   │   ├── src/jobs/          # Background jobs (approval expiry, trace cleanup)
│   │   ├── src/middleware/    # auth, tenant, request-id, error-handler
│   │   └── prisma/           # Schema, migrations, seed
│   └── dashboard/             # Next.js 15 dashboard (port 3000)
│       └── src/app/dashboard/ # Pages: overview, agents, policies, approvals, audit, architecture
├── v0-prototype/              # Original client-side prototype (read-only reference)
├── tests/e2e/                 # End-to-end test suite
├── scripts/demo.ts            # Demo script for design partners
├── research/                  # Market research, product plan, prompts, verification reports
│   ├── 2026-03-20-product-development-plan.md  # THE PLAN — read this for full context
│   └── prompts/               # Task prompts for Claude Code sessions
└── deployment/
    └── .env.development       # Dev API key (created by prisma db seed)
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
```

> **Running dashboard on a different port?** Set `ALLOWED_ORIGINS` when starting the API:
> `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3010 npm run dev`

## Testing

```bash
# All tests
turbo test

# API integration tests (needs test DB running)
docker compose -f docker-compose.test.yml up -d
cd apps/api && npm test

# E2E tests (needs API running on port 4000 against test DB)
npx vitest run --config tests/e2e/vitest.config.ts

# Shared package tests
cd packages/shared && npm test
```

## Code Conventions

- **TypeScript strict everywhere.** No `any` in public API surfaces.
- **Files:** `kebab-case.ts`. Classes/interfaces: `PascalCase`. Functions/variables: `camelCase`. Constants: `SCREAMING_SNAKE_CASE`.
- **Database columns:** `snake_case`. **API routes:** `kebab-case`. **Env vars:** `SCREAMING_SNAKE_CASE`.
- **One class per file.** Tests co-located as `*.test.ts`. Integration tests in `__tests__/integration/`.
- **API route handlers:** validate input (Zod) → call service → format response. No business logic in routes.
- **Enums stored as strings** in PostgreSQL, validated by Zod at application layer.
- **Migrations are forward-only.** No down migrations.
- **Seed script is idempotent.** Safe to run multiple times.
- **Test data:** always use factory functions from `@sidclaw/shared` test-utils. Never raw object literals.
- **Error responses:** always use the `ApiError` shape: `{ error, message, status, details?, trace_id?, request_id }`.
- **No `any` cross-tenant leakage.** Return 404 (not 403) for resources belonging to other tenants.
- **"Institutional Calm" design:** dark mode (#0A0A0B background), muted text (#E4E4E7), restrained color. No gradients, no AI sparkle. Amber (#F59E0B) for flagged items, green (#22C55E) for success, red (#EF4444) for deny, blue (#3B82F6) for info. Monospace (JetBrains Mono) for trace IDs, timestamps, technical data.
- **Auth during development:** When OIDC is not configured, the API provides a dev-login endpoint at `GET /api/v1/auth/dev-login` that auto-authenticates as the seeded admin user. Click "Sign in with SSO" on the dashboard login page to use it. Email/password login also works with the seeded credentials (`admin@example.com` / `admin`).

## Architecture

- **SDK** (`packages/sdk`) calls `POST /api/v1/evaluate` with agent ID + action details
- **Policy Engine** (`apps/api/src/services/policy-engine.ts`) matches action against policy rules, returns allow/approval_required/deny
- **Evaluate endpoint** creates AuditTrace + AuditEvents + ApprovalRequest (if needed)
- **Approval Service** handles approve/deny with separation-of-duties check, creates audit events, finalizes traces
- **Background jobs** expire overdue approvals, clean up old traces for free-plan tenants
- **Dashboard** displays everything: agent registry, policy management, approval queue, trace viewer, overview stats

## Current State

**Phase 2 complete.** The platform has:
- ✅ Agent registry with CRUD and lifecycle management (active/suspended/revoked)
- ✅ Policy management with CRUD, versioning, dry-run testing
- ✅ Approval queue with risk classification, context snapshots, stale indicators, sorting
- ✅ Audit trace viewer with export (JSON single trace, CSV bulk), event detail expansion, date filtering
- ✅ Overview dashboard with stats, pending approvals, recent traces, system health
- ✅ Global search across all entity types
- ✅ Architecture diagram page
- ✅ Background jobs (approval expiry, trace retention)
- ✅ 117+ integration tests, 6 E2E scenarios, demo script

**Next: Phase 3** — SDK integrations (MCP middleware, framework wrappers), webhook delivery, IdP authentication (Okta/Auth0), SDK packaging for npm.

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
