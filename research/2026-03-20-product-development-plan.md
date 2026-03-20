# Product Development Plan: Agent Identity & Approval Layer

**Date:** March 20, 2026 (revised with review fixes)
**Status:** Approved design — ready for PRD generation
**Audience:** Technical founding team using agentic AI (Claude Code) for implementation
**Basis:** Market viability assessment (2026-03-20-market-viability-assessment.md)

---

## Overview

This plan takes the product from a v0 client-side prototype to a production-ready, commercially viable platform. It is structured so that individual sections can be handed to Claude Code (or other agentic coding AI) as self-contained implementation tasks with explicit inputs, outputs, file paths, and acceptance criteria.

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Turborepo | Claude Code works best with full codebase visibility |
| Language | TypeScript everywhere | Shared types across SDK, API, dashboard. One language for AI agents to reason about |
| Backend | Fastify | Schema-first validation, built-in OpenAPI, better TypeScript support than Express |
| Database | PostgreSQL + Prisma | Relational data fits the domain. Prisma gives type-safe queries and migrations |
| Frontend | Next.js 15 + Tailwind + shadcn/ui | Matches v0 prototype stack |
| Local dev | Docker Compose | One command to start everything |
| Open-source boundary | `/packages/sdk` (Apache 2.0) vs `/apps/*` (commercial) | Physical separation prevents accidental leakage |
| v0 prototype | Relocated to `/v0-prototype/` | Reference material, not evolved |

### Repository Structure

```
agent-identity/
├── v0-prototype/              # Relocated current codebase (read-only reference)
├── packages/
│   ├── sdk/                   # Open-source (Apache 2.0) — TypeScript SDK
│   │   ├── src/
│   │   │   ├── client/        # API client for the platform
│   │   │   ├── middleware/    # Framework wrappers (LangChain.js, CrewAI, OpenAI Agents, Vercel AI)
│   │   │   ├── mcp/          # MCP governance server
│   │   │   ├── webhooks/     # Webhook signature verification
│   │   │   └── types/        # Shared type definitions
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/                # Shared types & utilities (used by SDK + platform)
│       ├── src/
│       │   ├── types/         # Agent, Policy, Approval, Trace interfaces
│       │   ├── enums/         # All enumerations
│       │   └── schemas/       # Zod schemas for validation
│       └── package.json
├── apps/
│   ├── api/                   # Backend API service (Fastify)
│   │   ├── src/
│   │   │   ├── routes/        # REST endpoints
│   │   │   ├── services/      # Business logic (policy engine, approval, trace)
│   │   │   ├── db/            # Prisma schema, migrations, seed
│   │   │   ├── auth/          # Session management, OIDC, OAuth, email providers
│   │   │   ├── jobs/          # Background job runner and jobs
│   │   │   └── middleware/    # Auth, tenant, rate limiting, CSRF
│   │   └── package.json
│   ├── dashboard/             # Commercial — Next.js governance dashboard
│   │   ├── src/
│   │   │   ├── app/           # Next.js App Router pages
│   │   │   ├── components/    # UI components
│   │   │   └── lib/           # Dashboard-specific utilities
│   │   └── package.json
│   ├── docs/                  # Documentation site
│   │   └── package.json
│   └── landing/               # Public landing page
│       └── package.json
├── examples/                  # Example applications
│   ├── mcp-postgres-governed/
│   ├── langchain-customer-support/
│   └── vercel-ai-assistant/
├── tests/
│   └── e2e/                   # End-to-end test suite
├── deployment/
│   └── env.example            # Environment variable documentation
├── docker-compose.yml         # PostgreSQL, API, Dashboard
├── turbo.json                 # Turborepo config
├── package.json               # Root workspace config
├── tsconfig.base.json         # Shared TypeScript config
└── research/                  # Research documents
```

### Phase Overview

| Phase | Name | Duration | What Ships | Key Outcome |
|-------|------|----------|-----------|-------------|
| **0** | Foundation | 2-3 weeks | Monorepo scaffold, DB schema, shared types, CI | Everything builds, tests run, Docker Compose works |
| **1** | Vertical Slice | 4-6 weeks | SDK → API → Policy Engine → Approval → Trace → Dashboard (one use case end-to-end) | Demoable product for design partners |
| **2** | Core Platform | 4-6 weeks | Agent registry, policy CRUD, multi-agent support, full approval UX, trace explorer | Feature-complete for early customers |
| **3** | SDK & Integrations | 3-4 weeks | MCP middleware, framework wrappers, IdP integration, webhook delivery | Developers can integrate in <5 minutes |
| **4** | Enterprise Readiness | 3-4 weeks | SSO/OIDC, RBAC, audit log export, integrity hashes, tenant isolation, API keys, rate limiting | Sellable to enterprise design partners |
| **5** | Open-Source & Launch | 2-3 weeks | SDK on npm, docs site, example apps, landing page, self-serve signup | Public launch, developer adoption funnel live |

**Total estimated timeline: 18-26 weeks** (phases can overlap and AI agents can parallelize within phases).

---

## Phase 0 — Foundation

**Goal:** Everything builds, tests run, Docker Compose works. Zero features, but the entire development infrastructure is ready for AI agents to start building Phase 1 without friction.

**Why this phase exists:** Claude Code is dramatically more productive when it can run tests, see type errors, and validate its work immediately. Spending 2-3 weeks on foundation saves 2x that time in every subsequent phase.

---

### P0.1 — Monorepo Scaffold

**Input:** Current repository with v0 prototype in root.

**Work:**
- Move all current files (app/, components/, lib/, public/, config files) into `/v0-prototype/`
- Initialize Turborepo workspace at root with `packages/*` and `apps/*`
- Create `packages/shared` with empty `src/` directory and package.json
- Create `packages/sdk` with empty `src/` directory and package.json
- Create `apps/api` with empty `src/` directory and package.json
- Create `apps/dashboard` as a fresh Next.js 15 + TypeScript + Tailwind project
- Create `tsconfig.base.json` with strict TypeScript settings, path aliases
- Each package/app extends base tsconfig
- Root `package.json` with workspace config and shared dev dependencies (TypeScript, ESLint, Prettier)
- `turbo.json` with build/test/lint pipeline definitions
- `.gitignore` updated for monorepo structure

**Acceptance criteria:**
- `turbo build` succeeds across all packages/apps (even though they're empty)
- `turbo test` runs (no tests yet, but the runner works)
- `turbo lint` passes
- Each package can import from `@agent-identity/shared` using TypeScript path aliases
- `apps/dashboard` renders a blank page at `localhost:3000`
- `v0-prototype/` is intact and runnable independently via `cd v0-prototype && npm run dev`

---

### P0.2 — Shared Types & Schemas

**Input:** Type definitions from `v0-prototype/lib/types/` and the market research (which identified additional fields needed for production: tenant_id, delegation chains).

**IMPORTANT — v0 type changes:** The following v0 field names are intentionally renamed for production consistency:
- `PolicyRule.authorized_integration` → `PolicyRule.target_integration` (matches the evaluate request shape and all API/SDK code)
- `PolicyRule.policy_version: string` → `PolicyRule.policy_version: number` (auto-incremented integer, not a string)
- `AuditEvent.policy_version` also changes from `string | null` to `number | null` to match the PolicyRule.policy_version type change.
- `ApprovalRequest.separation_of_duties_check` → kept, but now computed server-side (see P1.4)
- `PolicyRule.max_session_ttl: string | null` → `PolicyRule.max_session_ttl: number | null` (seconds as integer, not a display string; e.g., 86400 for 24 hours)
- `TraceOutcome` enum: add `'in_progress'` value (used when trace is created but evaluation/execution is ongoing). Remove `'pending'` from `TraceOutcome`. v0 had `'pending'` — removed; use `'in_progress'` instead.

**Work:**
- In `packages/shared/src/types/`, define production interfaces:
  - `Agent` — extends v0 with: `tenant_id`, `created_at`, `updated_at`, `created_by`, `metadata` (JSON). Field `authorized_integrations` stored as JSON array (validated by Zod schema at application layer, not a separate DB table). **Note:** JIT credential fields (`credential_config` on Agent) deferred — no phase implements credential issuance.
  - `PolicyRule` — extends v0 with: `tenant_id`, `is_active`, `priority` (for conflict resolution), `created_at`, `updated_at`. **Rename:** `authorized_integration` → `target_integration`. **Change:** `policy_version` from `string` to `number`. **Note:** Context-aware conditions (JSONPath expressions against SDK context) deferred — no phase implements condition evaluation. Add when a real use case demands it.
  - `ApprovalRequest` — extends v0 with: `tenant_id`, `policy_rule_id: string`. **Deferred fields (added in later phases):** `expires_at` (added in P2.3a), `risk_classification` (added in P2.3b), `context_snapshot` (added in P2.3b). These fields are NOT in the P0.2 type or P0.3 schema — they are added via migrations when their implementing tasks are built. **Remove from v0:** `escalation_policy` (future feature, not built in any phase). **Remove from v0:** `alternatives` (no generation mechanism exists yet).
  - `AuditTrace` — extends v0 with: `tenant_id`, `parent_trace_id` (for delegation chains). **Note:** `integrity_hash` is added in Phase 4 (P4.5), not here. **Note:** JIT credential fields (`credential_id` on AuditTrace) deferred — no phase implements credential issuance.
  - `AuditEvent` — extends v0 with: `tenant_id`, `metadata` (JSON). **Note:** `integrity_hash` is added in Phase 4 (P4.5), not here.
  - `Tenant` — new: `id`, `name`, `slug`, `plan` (free/team/enterprise), `settings`, `created_at`
  - `User` — new: `id`, `tenant_id`, `email`, `name`, `role` (admin/reviewer/viewer), `auth_provider_id`
  - `ApiKey` — new: `id`, `tenant_id`, `name`, `key_hash`, `scopes: string[]` — stored but NOT enforced until Phase 4 (P4.3). Default value: `['*']` (all access). Scope enforcement is implemented in P4.3. Also: `expires_at`, `last_used_at`
- In `packages/shared/src/enums/`, define all enumerations explicitly:
  - `ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired'`
  - `TraceOutcome = 'in_progress' | 'executed' | 'blocked' | 'denied' | 'completed_with_approval' | 'expired'`
  - New enum: `RiskClassification = 'low' | 'medium' | 'high' | 'critical'`
  - All existing v0 enums carried forward (except `'pending'` removed from `TraceOutcome` as noted above)
  - Complete `EventType` enum:

```typescript
export type EventType =
  | 'trace_initiated'
  | 'identity_resolved'
  | 'delegation_resolved'
  | 'policy_evaluated'
  | 'sensitive_operation_detected'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'approval_expired'
  | 'operation_allowed'
  | 'operation_executed'
  | 'operation_failed'
  | 'operation_denied'
  | 'operation_blocked'
  | 'lifecycle_changed'
  | 'trace_closed';
```

**Note:** The v0 event type `approval_required` is renamed to `approval_requested` for clarity (describes the event of creating a request, not the policy effect).

**v0 field disposition (explicit):**

Fields carried forward unchanged: `id`, `name`, `description`, `owner_name`, `owner_role`, `team`, `environment`, `authority_model`, `identity_mode`, `delegation_model`, `autonomy_tier`, `lifecycle_state`, `authorized_integrations`, `next_review_date`

Fields removed:
- `recent_activity_state` — replaced by computed `stats.last_activity_at` in P2.1a's agent detail response (not stored, computed at query time)

Note: All v0 fields not listed here are carried forward unchanged.

- In `packages/shared/src/schemas/`, create Zod schemas for every type (used for API validation and SDK type safety)
- Export everything from `packages/shared/src/index.ts`

**Acceptance criteria:**
- All types compile with strict TypeScript
- Zod schemas match TypeScript interfaces (test: `z.infer<typeof AgentSchema>` satisfies `Agent`)
- `packages/sdk` and `apps/api` and `apps/dashboard` can all `import { Agent, PolicyRule } from '@agent-identity/shared'`
- Unit tests validate Zod schemas accept valid data and reject invalid data
- `PolicyRule` has `target_integration` (not `authorized_integration`)
- `PolicyRule.policy_version` is `number`
- `AuditEvent.policy_version` is `number | null`
- `TraceOutcome` includes `'in_progress'` and `'expired'`, does NOT include `'pending'`
- `ApprovalStatus` includes `'expired'`
- `EventType` enum includes all 16 values listed above
- `RiskClassification` enum exists
- ApprovalRequest type does NOT include expires_at, risk_classification, or context_snapshot (these are added in P2.3a/b)

---

### P0.3 — Database Schema & Migrations

**Input:** Shared types from P0.2.

**Work:**
- In `apps/api/`, install Prisma
- Create `prisma/schema.prisma` with models matching all shared types
- Models: `Tenant`, `User`, `Agent`, `PolicyRule`, `ApprovalRequest`, `AuditTrace`, `AuditEvent`, `ApiKey`
- **`authorized_integrations` storage:** Store as `Json` column on the `Agent` model. Validated at the application layer via Zod schema (not a separate relational table). This keeps the schema simple and avoids complex joins for a field that is read-heavy and rarely queried independently.
- Relationships:
  - Tenant → has many Agents, PolicyRules, Users, ApiKeys
  - Agent → has many PolicyRules, ApprovalRequests, AuditTraces
  - AuditTrace → has many AuditEvents, has many ApprovalRequests
  - AuditTrace → optional parent_trace_id (self-referential for delegation chains)
  - ApprovalRequest → belongs to AuditTrace, belongs to Agent, belongs to PolicyRule (via policy_rule_id)
- Indexes on: `tenant_id` (every table), `agent_id`, `trace_id`, `status` fields, `created_at` (for time-range queries)
- Create seed script that inserts: 1 default tenant, 1 admin user, the 3 agents from v0 fixtures (Customer Communications Agent: `autonomy_tier = 'high'`; Knowledge Retrieval: `autonomy_tier = 'low'`; Case Operations: `autonomy_tier = 'medium'`), their policies, and the 4 scenario traces. New agents are always created with `lifecycle_state = 'active'`.

Seed admin user: name 'Admin User', email 'admin@example.com', role 'admin'.
Agent owner names (must differ from admin user for separation-of-duties testing):
- agent-001 (Customer Communications): owner_name 'Sarah Chen', owner_role 'Communications Lead'
- agent-002 (Knowledge Retrieval): owner_name 'David Kim', owner_role 'Knowledge Systems Manager'
- agent-003 (Case Operations): owner_name 'Rachel Torres', owner_role 'Operations Director'
- Create 1 API key for the default tenant with scopes `['evaluate', 'traces:read', 'traces:write', 'approvals:read']`. Store the SHA-256 hash in the database. Print the raw key to console during seeding. Also write the raw key to `deployment/.env.development` as `AGENT_IDENTITY_API_KEY=ai_dev_...` for local development.
- Add `prisma/` to docker-compose PostgreSQL service

**Seed scenario data (explicit):**

| Scenario | Agent | Operation | Integration | Scope | Classification | Policy Effect | Outcome |
|----------|-------|-----------|-------------|-------|---------------|--------------|---------|
| 1 | Customer Communications (agent-001) | send_notification | communications_service | customer_emails | confidential | approval_required | pending (awaiting approval) |
| 2 | Case Operations (agent-003) | close_case | case_management_system | high_impact_cases | confidential | approval_required | pending (awaiting approval) |
| 3 | Knowledge Retrieval (agent-002) | read | document_store | internal_docs | internal | allow | executed |
| 4 | Customer Communications (agent-001) | export_pii | communications_service | customer_data | restricted | deny | blocked |

Each scenario creates: 1 AuditTrace, 1 ApprovalRequest (for scenarios 1-2), and 4-6 AuditEvents showing the full causality sequence (trace_initiated → identity_resolved → policy_evaluated → [sensitive_operation_detected] → outcome).

**Note on later-phase migrations:** Phases 2-5 add new models and columns. Each task that modifies the database schema MUST explicitly create a new Prisma migration via `npx prisma migrate dev --name <descriptive_name>`. Models added in later phases: `PolicyRuleVersion` (P2.2a), `BackgroundJob` (P2.3a), `WebhookEndpoint` + `WebhookDelivery` (P3.3), `Session` (P3.4).

**Acceptance criteria:**
- `docker compose up db` starts PostgreSQL
- `npx prisma migrate dev` creates all tables
- `npx prisma db seed` populates the 3-agent, 4-scenario dataset
- `npx prisma studio` shows all data correctly
- Foreign key constraints enforce referential integrity
- All indexes are created
- `authorized_integrations` is stored as JSON and seed data validates against Zod schema
- Seed creates an API key usable for SDK authentication in development

---

### P0.4 — API Service Scaffold

**Input:** Database from P0.3, shared types from P0.2.

**Work:**
- In `apps/api/`, set up Fastify
- Directory structure:
  - `src/server.ts` — Fastify instance, plugin registration, startup
  - `src/routes/` — route modules (empty handlers for now)
  - `src/services/` — business logic layer (empty for now)
  - `src/db/client.ts` — Prisma client singleton
  - `src/middleware/auth.ts` — API key authentication middleware (stub)
  - `src/middleware/tenant.ts` — tenant context extraction middleware (stub)
  - `src/errors.ts` — typed error classes
- Register route prefixes: `/api/v1/agents`, `/api/v1/policies`, `/api/v1/approvals`, `/api/v1/traces`
- Health check endpoint: `GET /health` returns `{ status: "ok", version: "0.1.0" }`
- OpenAPI spec auto-generated from Fastify schemas
- Add API service to `docker-compose.yml` (depends on db)

**API response types:** Composed response types that extend core domain types (e.g., `AgentDetailResponse = Agent & { stats: {...}, recent_traces: [...] }`) are defined in `apps/api/src/routes/types.ts`. Each route module imports from this file. The dashboard API client imports these types via TypeScript project references (`apps/dashboard` references `apps/api` in tsconfig). This ensures the dashboard always uses the same types the API returns.

**Development-mode authentication bypass:** During Phases 1-2, the dashboard has no session-based auth (that comes in P3.4). To allow the dashboard to call the API during local development:
- Auth middleware accepts an `X-Dev-Bypass: true` header when `NODE_ENV=development`
- When bypassed, auth middleware loads the first tenant and admin user from the seed data as the request context
- The dashboard API client (`apps/dashboard/src/lib/api-client.ts`) includes this header when `NEXT_PUBLIC_API_URL` points to localhost
- **This bypass MUST be removed or disabled when P3.4 implements real session auth.** Add a comment in the auth middleware: `// TODO(P3.4): Remove dev bypass when session auth is implemented`

**Acceptance criteria:**
- `docker compose up` starts both PostgreSQL and API service
- `GET http://localhost:4000/health` returns 200
- `GET http://localhost:4000/docs` shows Swagger/OpenAPI UI
- API connects to PostgreSQL successfully (logged on startup)
- TypeScript compiles with zero errors
- Hot reload works (`tsx watch` or equivalent)
- Dashboard can call API endpoints with dev bypass header

---

### P0.5 — Dashboard Scaffold

**Input:** Fresh Next.js app from P0.1, design tokens from v0-prototype.

**Work:**
- In `apps/dashboard/`, configure:
  - Tailwind with "Institutional Calm" design tokens (explicit values below)
  - shadcn/ui initialized with dark theme
  - Inter + JetBrains Mono fonts via next/font
  - App Router layout with dark mode (`<html class="dark">`)
- Create layout shell (reference `v0-prototype/components/layout/`):
  - Top navigation with placeholder links
  - Page content area
  - Toast container (sonner)
- Create one page: `/dashboard` that renders "Dashboard shell works" with correct dark-mode styling
- Create `src/lib/api-client.ts` — typed HTTP client that calls the API service (uses shared types from `@agent-identity/shared`, includes `X-Dev-Bypass: true` header when API URL is localhost)
- Environment variable: `NEXT_PUBLIC_API_URL=http://localhost:4000`

**Design Token Reference (use these exact values):**

```
Background primary:    #0A0A0B
Background secondary:  #111113
Background tertiary:   #1A1A1D
Border default:        #2A2A2E
Border subtle:         rgba(255, 255, 255, 0.05)
Border emphasis:       rgba(255, 255, 255, 0.10)
Text primary:          #E4E4E7
Text secondary:        #A1A1AA
Text muted:            #71717A
Accent amber:          #F59E0B     (for "flagged" / "why this was flagged" indicators)
Accent green (muted):  #22C55E at 80% opacity  (approve buttons)
Accent red (muted):    #EF4444 at 80% opacity  (deny buttons)
Accent blue:           #3B82F6     (policy evaluation events, info badges)
Font body:             Inter
Font mono/trace:       JetBrains Mono
```

These tokens define the "Institutional Calm" aesthetic. All dashboard components reference these values via Tailwind config or CSS variables. No gradients, no decorative elements, no AI sparkle icons. Borders are subtle. Typography is restrained.

**Acceptance criteria:**
- `http://localhost:3000/dashboard` renders with correct dark-mode styling
- Inter font loads as default body font
- JetBrains Mono available via utility class
- Background uses `#0A0A0B`, text uses `#E4E4E7`
- API client can call health endpoint and log result to console
- No hydration errors, no white flashes
- Design tokens are configured in Tailwind config as named variables

---

### P0.6 — CI & Testing Infrastructure

**Input:** All scaffolds from P0.1-P0.5.

**Work:**
- Set up Vitest as test runner across all packages/apps
- Configure Turborepo to run tests in dependency order
- Create test utilities:
  - `packages/shared/src/test-utils/factories.ts` — factory functions for creating test data (e.g., `createAgent()`, `createApprovalRequest()` with sensible defaults and overrides)
  - `apps/api/src/test-utils/test-server.ts` — creates a Fastify instance with test database for integration tests
- GitHub Actions CI workflow:
  - On push/PR: lint → typecheck → test → build
  - PostgreSQL service container for API integration tests
- Add `docker-compose.test.yml` for running tests locally with a test database
- Pre-commit hook: lint + typecheck (via lefthook or husky)

**Acceptance criteria:**
- `turbo test` runs tests across all packages (currently just schema validation tests from P0.2)
- `turbo lint` and `turbo typecheck` pass
- GitHub Actions workflow runs successfully on push
- Test factories produce valid data (passes Zod schema validation)
- API integration test scaffold works (can start server, hit health endpoint, tear down)

---

## Phase 1 — Vertical Slice

**Goal:** One complete path works end-to-end: SDK call → API receives request → Policy engine evaluates → Approval request created → Dashboard shows approval card → Human approves/denies → Trace recorded and visible.

**Use case for the slice:** "Customer Communications Agent wants to send a notification to a customer. Policy says this requires approval. A human reviewer sees the request with full context, approves it, and the trace is recorded."

---

### P1.1 — SDK Core: Wrap & Intercept

**Input:** Shared types from P0.2, API scaffold from P0.4.

**Work:**
- In `packages/sdk/src/client/`, implement `AgentIdentityClient`:
  - Constructor: `new AgentIdentityClient({ apiKey, apiUrl, agentId })`
  - Method: `client.evaluate(action)` — sends an action request to the API, receives a policy decision
  - Action request shape: `{ operation: string, target_integration: string, resource_scope: string, data_classification: DataClassification, context?: Record<string, unknown> }`
  - Response shape: `{ decision: 'allow' | 'approval_required' | 'deny', trace_id: string, approval_request_id?: string, reason: string, policy_rule_id: string }`
  - If decision is `allow`: caller proceeds
  - If decision is `approval_required`: caller waits (or polls) for approval
  - If decision is `deny`: caller stops, receives reason
  - Method: `client.waitForApproval(approvalRequestId, { timeout?, pollInterval? })` — polls API until approval is decided or timeout
  - Method: `client.recordOutcome(traceId, { status, metadata? })` — reports what happened after the action was taken (for the trace)
- In `packages/sdk/src/middleware/`, implement `withGovernance()` wrapper:
  - A higher-order function that wraps any async function
  - Before execution: calls `client.evaluate()`
  - If allowed: executes the wrapped function, records outcome
  - If approval_required: waits for approval, then executes or aborts
  - If denied: throws `ActionDeniedError` with reason and trace_id
  - Example usage:
    ```typescript
    const sendEmail = withGovernance(client, {
      operation: 'send_notification',
      target_integration: 'communications_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential'
    }, async (params) => {
      // actual send logic
    });
    ```
- Error handling: network errors, timeouts, API errors — all typed
- Retry logic for transient failures (with exponential backoff)

**Acceptance criteria:**
- `client.evaluate()` sends POST to API and returns typed decision
- `withGovernance()` wrapper correctly gates execution based on policy decision
- `client.waitForApproval()` resolves when approval is decided
- `client.recordOutcome()` posts outcome to API
- All methods are fully typed (no `any`)
- Unit tests mock the API and verify all three decision paths (allow, approval_required, deny)
- Error scenarios tested: network timeout, 401, 500, invalid response

---

### P1.2 — Policy Evaluation Engine

**Input:** Database with seeded policies from P0.3, shared types.

**Work:**
- In `apps/api/src/services/policy-engine.ts`, implement `PolicyEngine`:
  - Method: `evaluate(agentId, action) → PolicyDecision`
  - Evaluation logic:
    1. **Lifecycle check first:** If agent `lifecycle_state !== 'active'`, immediately return `{ effect: 'deny', reason: 'Agent is [suspended|revoked]', rule_id: null }`. No policy rules are checked.
    2. Load all active policy rules for the agent, ordered by priority
    3. Match rules against the action: compare `operation`, `target_integration`, `resource_scope`, `data_classification`
    4. First matching rule wins (priority ordering)
    5. If no rule matches: default to `deny` (secure by default)
    6. Return: `{ effect, rule_id, rationale }` from the matched rule
  - Matching supports:
    - Exact match on each field
    - Wildcard (`*`) on `resource_scope`
    - Data classification hierarchy: `restricted > confidential > internal > public` (a rule for `confidential` also covers `internal` and `public`)
  - The engine is deterministic — same input always produces same output
  - No LLM calls, no external dependencies — pure function over database state

**Note:** `autonomy_tier` is informational only — displayed in dashboards and available for filtering, but not referenced by the policy engine. Future enhancement: autonomy_tier could influence default deny behavior or approval TTL.

**Note:** `authorized_integrations` is informational only — the policy engine does not validate that `target_integration` is in the agent's authorized list. Policies are the sole authorization mechanism. Future enhancement: add a pre-check that rejects evaluations for unauthorized integrations.

**Acceptance criteria:**
- Given the seeded policies: "send_notification" on "communications_service" evaluates to `approval_required`
- Given the seeded policies: "read" on "document_store" evaluates to `allow`
- Given the seeded policies: "export_pii" on "communications_service" evaluates to `deny`
- An action with no matching policy defaults to `deny`
- Priority ordering is respected (higher priority rule wins over lower)
- Data classification hierarchy works (rule for `confidential` matches `internal` action)
- Suspended/revoked agent returns `deny` without checking policy rules
- Integration tests run against real PostgreSQL
- Policy evaluation completes in <10ms for typical rule sets

---

### P1.3 — Evaluate Endpoint & Trace Creation

**Input:** Policy engine from P1.2, SDK client from P1.1.

**Work:**
- In `apps/api/src/routes/evaluate.ts`, implement `POST /api/v1/evaluate`:
  - Authenticates via API key (from `Authorization: Bearer <key>` header) or dev bypass (see P0.4)
  - Extracts tenant context from API key
  - Validates request body against Zod schema
  - Creates an `AuditTrace` record in the database (status: `in_progress`)
  - Creates `AuditEvent`: `trace_initiated` with agent and action details
  - Creates `AuditEvent`: `identity_resolved` with agent identity metadata (owner, authority model, delegation model)
  - Calls `PolicyEngine.evaluate()`
  - Creates `AuditEvent`: `policy_evaluated` with the decision and matched rule
  - If policy effect is `approval_required` or `deny`, creates `AuditEvent`: `sensitive_operation_detected`
  - If `approval_required`:
    - Creates an `ApprovalRequest` record (status: `pending`, linked to trace). Set `policy_rule_id` on the ApprovalRequest to the ID of the matched policy rule from the evaluation.
    - Creates `AuditEvent`: `approval_requested`
    - Returns `{ decision: 'approval_required', trace_id, approval_request_id, reason }`
  - If `allow`:
    - Creates `AuditEvent`: `operation_allowed`
    - Returns `{ decision: 'allow', trace_id, reason }`
  - If `deny`:
    - Updates trace: `final_outcome = 'blocked'`
    - Creates `AuditEvent`: `operation_denied`
    - Creates `AuditEvent`: `trace_closed`
    - Returns `{ decision: 'deny', trace_id, reason }`
  - All database operations in a transaction
- Implement `POST /api/v1/traces/:traceId/outcome`:
  - Records the outcome after the action was taken
  - Creates `AuditEvent`: `operation_executed` or `operation_failed`
  - Creates `AuditEvent`: `trace_closed` (final event in every completed trace)
  - Updates trace `final_outcome` and `completed_at`
- Implement `GET /api/v1/approvals/:id/status`:
  - Returns current status of an approval request (for polling)

**Acceptance criteria:**
- SDK `client.evaluate()` → API → policy engine → response round-trip works
- Trace, events, and approval request are all created in the database
- Each evaluation creates the correct rich sequence of audit events (trace_initiated → identity_resolved → policy_evaluated → [sensitive_operation_detected] → approval_requested/operation_allowed/operation_denied → [trace_closed])
- Transaction ensures no partial state on failure
- API returns correct HTTP status codes (200, 400, 401, 404, 500)
- Response times <100ms for the full evaluate round-trip
- Integration test: full evaluate flow for all three decision types

---

### P1.4 — Approval Service

**Input:** Approval request records from P1.3, shared types.

**Work:**
- In `apps/api/src/services/approval-service.ts`, implement `ApprovalService`:
  - Method: `approve(approvalRequestId, { approver_name, decision_note? })`:
    1. Load the approval request (validate it's still `pending`)
    2. **Separation of duties check:** Load the agent's `owner_name`. If `approver_name === agent.owner_name`, set `separation_of_duties_check = 'fail'` and return 403 with error `'separation_of_duties_violation'` and message "Agent owner cannot self-approve". Otherwise set `separation_of_duties_check = 'pass'`.
    3. Update status to `approved`, set `decided_at`, `approver_name`, `decision_note`, `separation_of_duties_check`
    4. Create `AuditEvent`: `approval_granted` with approver details
    5. Update linked trace: keep `in_progress` (agent still needs to execute)
    6. Return the updated approval request
  - Method: `deny(approvalRequestId, { approver_name, decision_note? })`:
    1. Load the approval request (validate it's still `pending`)
    2. Update status to `denied`, set `decided_at`, `approver_name`, `decision_note`
    3. Create `AuditEvent`: `approval_denied` with approver details
    4. Create `AuditEvent`: `trace_closed`
    5. Update linked trace: `final_outcome = 'denied'`, `completed_at`
    6. Return the updated approval request
  - Method: `getApprovalWithContext(approvalRequestId)`:
    - Returns the approval request enriched with: agent details, policy rule (loaded via policy_rule_id foreign key), trace events so far, the `context_snapshot` from the evaluation
    - This is the data that powers the approval card in the dashboard
  - All operations in transactions
  - Optimistic locking: if approval was already decided, return 409 Conflict

**Routes:**
- `POST /api/v1/approvals/:id/approve` — calls `approve()`
- `POST /api/v1/approvals/:id/deny` — calls `deny()`
- `GET /api/v1/approvals/:id` — calls `getApprovalWithContext()`
- `GET /api/v1/approvals?status=pending&limit=20&offset=0` — list approvals with filters and pagination

Response shape:
```json
{
  "data": "ApprovalRequest[]",
  "pagination": { "total": "number", "limit": "number", "offset": "number" }
}
```

**Acceptance criteria:**
- Approving a pending request: status changes, trace updated, events created, separation_of_duties_check = 'pass'
- Denying a pending request: status changes, trace finalized with `trace_closed` event, events created
- Attempting to approve/deny an already-decided request returns 409
- Agent owner attempting to approve their own agent's request returns 403 with `separation_of_duties_violation`
- `getApprovalWithContext()` returns rich context (agent name, policy rationale, trace events)
- SDK `client.waitForApproval()` resolves after API approval
- Integration test: full flow from evaluate → approval pending → approve → SDK unblocked
- Integration test: separation of duties violation returns 403

---

### P1.5 — Dashboard: Approval Queue & Detail

**Input:** API endpoints from P1.3 and P1.4, design reference from v0-prototype.

**Work:**
- In `apps/dashboard/`, build the approval workflow UI:
- **Approval Queue page** (`/dashboard/approvals`):
  - Fetches `GET /api/v1/approvals?status=pending` on load
  - Displays pending approvals as briefing cards (reference v0 `QueueItemCard`)
  - Each card shows: agent name, operation, target, data classification, time pending, "why flagged" snippet
  - Clicking a card opens the approval detail panel
  - Auto-refreshes every 5 seconds via polling
  - Queue page uses offset/limit pagination (default: 20 items per page, configurable). Pagination controls at bottom of queue.
- **Approval Detail panel** (slide-over or dedicated view):
  - Fetches `GET /api/v1/approvals/:id` for rich context
  - Sections (reference v0 approval detail):
    1. **Request Summary** — what the agent wants to do
    2. **Authority Context** — who owns the agent, delegation model
    3. **Why This Was Flagged** — the matching policy rule and its rationale (visual anchor: amber left border `#F59E0B`, slightly larger text)
    4. **Context Snapshot** — what the agent was doing when it made the request (from `context_snapshot`)
    5. **Trace So Far** — events leading up to this approval request
    6. **Reviewer Action** — Approve / Deny buttons with optional note field
    7. **Governance Metadata** — trace ID, policy version, timestamps
  - Approve/Deny buttons call API, show toast on success, navigate back to queue
- **Design requirements:**
  - "Institutional Calm" aesthetic using design tokens from P0.5
  - "Why This Was Flagged" uses accent amber `#F59E0B` left border, text at 1.125rem
  - Approve button: background `#22C55E` at 80% opacity. Deny button: background `#EF4444` at 80% opacity.
  - Monospace font (JetBrains Mono) for trace IDs and timestamps
  - Cards use `#111113` background, `#2A2A2E` borders, data-dense layout, no decorative elements, status badges with semantic colors

**Acceptance criteria:**
- Queue page loads and displays pending approvals from the database
- Clicking an approval shows the full detail panel with all 7 sections
- Approving from dashboard: approval status updates, toast shown, queue refreshes
- Denying from dashboard: same flow
- If another user approves while you're viewing: next action returns 409, UI handles gracefully
- Queue cards are sortable by: agent name, risk classification, time pending. Filter bar supports: status, agent, data classification. Status badges: pending = amber (#F59E0B), approved = green (#22C55E at 80%), denied = red (#EF4444 at 80%). Trace IDs use JetBrains Mono font.
- Pagination works correctly with 20+ pending approvals
- Mobile/responsive is NOT required at this phase

---

### P1.6 — Dashboard: Trace Viewer

**Input:** Audit traces and events from P1.3/P1.4, design reference from v0-prototype.

**Work:**
- **API endpoints:**
  - `GET /api/v1/traces?agent_id=&outcome=&limit=&offset=` — list traces with filters
  - `GET /api/v1/traces/:traceId` — single trace with all events
- **Trace Timeline page** (`/dashboard/audit`):
  - Left panel: list of traces with summary info (agent, operation, outcome, timestamp)
  - Right panel: selected trace's event timeline (vertical, reference v0 `TraceTimeline`)
  - Trace summary card at top: trace ID, agent, operation, outcome, duration
  - Events displayed chronologically with: timestamp, event type, actor, description, status badge
  - Events that reference an approval request link to the approval detail
  - Filtering: by agent, by outcome, by date range, search by trace ID
- **Design:**
  - Timeline uses vertical line with dots for each event
  - Monospace for trace IDs, timestamps, technical data
  - Color-coded event types: policy evaluation = `#3B82F6`, approval = `#F59E0B`, execution = `#22C55E`, denial = `#EF4444`

**Acceptance criteria:**
- Trace list loads from API and displays correctly
- Selecting a trace shows its full event timeline
- Events are in chronological order
- The full vertical slice is visible: trace_initiated → identity_resolved → policy_evaluated → [sensitive_operation_detected] → approval_requested → approval_granted → operation_executed → trace_closed
- Approval events link to the approval detail
- Filtering works correctly
- Empty state when no traces match filters

---

### P1.7 — End-to-End Integration Test

**Input:** Everything from P1.1-P1.6.

**Work:**
- Create an integration test that runs the full vertical slice programmatically:
  1. SDK creates `AgentIdentityClient` with test API key
  2. SDK calls `client.evaluate()` for an action that requires approval
  3. Test verifies: trace created, events created (including identity_resolved), approval request created
  4. Test calls the approval API directly to approve the request
  5. SDK `client.waitForApproval()` resolves
  6. SDK calls `client.recordOutcome()` with success
  7. Test verifies: trace finalized with trace_closed event, all events present, correct sequence
- Create a second test for the `deny` path (approval denied)
- Create a third test for the `allow` path (no approval needed)
- Create a fourth test for the `deny` policy path (auto-blocked)
- Create a fifth test for the separation of duties violation
- Create a demo script (`scripts/demo.ts`) that:
  - Starts the full stack
  - Runs the 4 scenarios against the API
  - Prints the trace timeline for each
  - Can be used to demonstrate the product to design partners

**Acceptance criteria:**
- All 5 scenario tests pass against a real database
- Demo script runs end-to-end and produces human-readable output
- The dashboard shows all scenario traces correctly
- Total test execution time <30 seconds
- Tests are stable (no flaky timing issues)

---

## Phase 2 — Core Platform

**Goal:** Expand from the single vertical slice to a feature-complete governance platform. After this phase, you have a product that early customers can actually use — multiple agents, full policy management, complete approval workflows, and comprehensive audit.

**IMPORTANT — Task sizing for Claude Code:** Phase 2 tasks are split into subtasks (a/b/c) sized for individual Claude Code sessions (~5-10 files, 500-1000 lines each). Do NOT combine subtasks into a single session.

---

### P2.1a — Agent CRUD API & Lifecycle

**Input:** Database schema from P0.3, API scaffold from P0.4.

**Work:**
- **API endpoints:**
  - `POST /api/v1/agents` — register a new agent. New agents always created with `lifecycle_state = 'active'` (not settable via API).
  - `GET /api/v1/agents` — list agents with filters (environment, lifecycle_state, authority_model, autonomy_tier) and pagination
  - `GET /api/v1/agents/:id` — full agent detail with summary stats
  - `PATCH /api/v1/agents/:id` — update agent metadata
  - `POST /api/v1/agents/:id/suspend` — set lifecycle_state to suspended, creates audit event
  - `POST /api/v1/agents/:id/revoke` — set lifecycle_state to revoked, creates audit event
  - `POST /api/v1/agents/:id/reactivate` — restore from suspended state, creates audit event
- Lifecycle state machine: `active ↔ suspended`, `active → revoked` (terminal), `suspended → revoked` (terminal). Invalid transitions return 400.
- Revoked agents: all subsequent SDK evaluate calls return `deny` (already handled by P1.2 lifecycle check)

**API response shapes:**

```typescript
// GET /api/v1/agents
{
  data: Agent[],
  pagination: { total: number, limit: number, offset: number }
}

// GET /api/v1/agents/:id
{
  data: Agent & {
    stats: {
      policy_count: { allow: number, approval_required: number, deny: number },
      pending_approvals: number,
      traces_last_7_days: number,
      last_activity_at: string | null
    },
    recent_traces: Array<{
      trace_id: string,
      operation: string,
      final_outcome: string,
      started_at: string
    }>,  // last 10
    recent_approvals: Array<{
      id: string,
      operation: string,
      status: string,
      requested_at: string
    }>   // last 5
  }
}

// POST /api/v1/agents/:id/suspend, /revoke, /reactivate
{
  data: Agent,
  event: AuditEvent
}
```

**Acceptance criteria:**
- Full CRUD for agents via API
- Lifecycle state machine enforced (400 on invalid transitions with `error: "invalid_lifecycle_transition"`)
- Lifecycle changes create audit events
- `POST /api/v1/agents` always creates with `lifecycle_state = 'active'`
- Integration tests for all lifecycle transitions (valid and invalid)

---

### P2.1b — Dashboard: Agent Registry Page

**Input:** Agent API from P2.1a, design tokens from P0.5.

**Dashboard components:**

```
apps/dashboard/src/
  app/dashboard/agents/
    page.tsx                    # Agent registry list page
  components/agents/
    AgentTable.tsx             # Table with sortable columns, row click → detail
    AgentFilters.tsx           # Filter bar: environment, lifecycle, authority, autonomy
```

**Work:**
- Agent registry page at `/dashboard/agents`
- Table view of all agents with sortable columns
- Filters: environment, lifecycle state, authority model, autonomy tier
- Search by agent name or owner
- Each row shows: name, owner, environment, authority model, lifecycle state badge, policy count, last activity
- Click navigates to agent detail page

**Acceptance criteria:**
- Registry page loads agents from API with working filters and search
- Table columns are sortable
- Lifecycle state badges: active = green (#22C55E at 80%), suspended = amber (#F59E0B), revoked = red (#EF4444 at 80%)
- Empty state when filters produce zero results

---

### P2.1c — Dashboard: Agent Detail Page

**Input:** Agent API from P2.1a, design tokens from P0.5.

**Dashboard components:**

```
apps/dashboard/src/
  app/dashboard/agents/
    [id]/page.tsx              # Agent detail page
  components/agents/
    AgentDetailHeader.tsx      # Name, description, lifecycle badge, action buttons
    AgentOverviewSection.tsx   # Owner, team, environment, dates
    AgentAuthoritySection.tsx  # Authority model, identity mode, delegation, autonomy
    AgentIntegrationsTable.tsx # Authorized integrations as table rows
    AgentPolicySummary.tsx     # Policy count by effect, link to policies page
    AgentRecentActivity.tsx    # Recent traces + approvals with links
    AgentLifecycleControls.tsx # Suspend/Revoke/Reactivate buttons
    LifecycleConfirmDialog.tsx # Confirmation modal
```

**Work:**
- Agent detail page with 6 sections: Overview, Authority & Identity, Authorized Integrations, Policy Summary, Recent Activity, Lifecycle Controls
- Lifecycle actions call API, show confirmation dialog, toast on success
- Policy summary links to policies page filtered by this agent
- Recent traces/approvals link to their respective detail views

**Acceptance criteria:**
- All 6 sections render with real data from API
- Suspend/Revoke/Reactivate work and are reflected immediately
- Confirmation dialog prevents accidental lifecycle changes
- Links navigate correctly to policies/traces/approvals

---

### P2.2a — Policy CRUD API & Versioning

**Input:** PolicyRule model from P0.3, policy engine from P1.2.

**Database migration:** Create `PolicyRuleVersion` model via `npx prisma migrate dev --name add-policy-rule-versions`:

```prisma
model PolicyRuleVersion {
  id              String   @id @default(uuid())
  policy_rule_id  String
  version         Int
  policy_name     String
  operation       String
  target_integration String
  resource_scope  String
  data_classification DataClassification
  effect          PolicyEffect
  rationale       String
  priority        Int
  max_session_ttl Int?
  modified_by     String
  modified_at     DateTime @default(now())
  change_summary  String?

  policy_rule     PolicyRule @relation(fields: [policy_rule_id], references: [id])
  @@index([policy_rule_id, version])
}
```

**Work:**
- **API endpoints:**
  - `POST /api/v1/policies` — create a new policy rule
  - `GET /api/v1/policies` — list policies with filters (agent_id, effect, data_classification, is_active)
  - `GET /api/v1/policies/:id` — single policy detail
  - `PATCH /api/v1/policies/:id` — update (increments `policy_version`, snapshots to `PolicyRuleVersion`, auto-generates `change_summary`, creates audit event)
  - `DELETE /api/v1/policies/:id` — soft delete (sets `is_active = false`)
  - `GET /api/v1/policies/:id/versions` — version history

**Policy matching rules (explicit):**

```typescript
function matchesRule(rule: PolicyRule, action: EvaluateRequest): boolean {
  if (rule.operation !== action.operation) return false;
  if (rule.target_integration !== action.target_integration) return false;
  if (rule.resource_scope !== '*' && rule.resource_scope !== action.resource_scope) return false;
  if (classificationLevel(action.data_classification) > classificationLevel(rule.data_classification)) return false;
  return true;
}
```

**Acceptance criteria:**
- Full CRUD for policies via API
- Policy versioning: updates increment version, snapshot created, old versions queryable
- Rationale field is mandatory (API rejects without it)
- New/modified policies immediately affect subsequent SDK evaluations
- Integration tests for CRUD and versioning

---

### P2.2b — Dashboard: Policy List & Editor

**Input:** Policy API from P2.2a, design tokens from P0.5.

**Dashboard components:**

```
apps/dashboard/src/
  app/dashboard/policies/
    page.tsx
  components/policies/
    PolicyList.tsx
    PolicyCard.tsx
    PolicyFilters.tsx
    PolicyEditorModal.tsx
    PolicyEditorForm.tsx
```

**PolicyEditorForm field specifications:**

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| agent_id | Select dropdown | Yes | Must be valid active agent | From `GET /api/v1/agents` |
| policy_name | Text input | Yes | 3-100 chars | Human-readable |
| operation | Text input | Yes | 1-100 chars | e.g., "send_notification" |
| target_integration | Text input | Yes | 1-100 chars | e.g., "communications_service" |
| resource_scope | Text input | Yes | 1-200 chars, or `*` | e.g., "customer_emails" |
| data_classification | Select | Yes | Enum value | public/internal/confidential/restricted |
| effect | Select | Yes | Enum value | allow/approval_required/deny |
| priority | Number | Yes | 1-1000, default 100 | Higher = higher priority |
| rationale | Textarea | Yes | 10-1000 chars | **Must explain WHY** |
| max_session_ttl | Number | No | 60-86400 seconds | Only for approval_required |

**Acceptance criteria:**
- Policies displayed grouped by agent with effect badges and rationale
- Editor modal creates/updates with validation
- Filters work correctly

---

### P2.2c — Policy Test & Version History

**Input:** Policy API from P2.2a.

**Dashboard components:**

```
apps/dashboard/src/
  components/policies/
    PolicyTestModal.tsx
    PolicyTestResult.tsx
    PolicyVersionHistory.tsx
    PolicyVersionDiff.tsx
```

**Work:**
- **API endpoint:** `POST /api/v1/policies/test` — dry-run evaluation. Returns `{ decision, matched_rule, rationale }` only. **Note:** Impact analysis (how many past traces would be affected) is deferred to a future phase.
- Dashboard: "Test Policy" modal, version history slide-over showing diffs

**Acceptance criteria:**
- Policy test returns correct decision without creating traces
- Version history shows changes over time with diffs
- Change summaries are human-readable

---

### P2.3a — Background Job Runner & Approval Expiration

**Input:** Approval service from P1.4.

**Database migration:** `npx prisma migrate dev --name add-background-jobs-and-approval-expiry`
- Add `expires_at DateTime?` to ApprovalRequest model in Prisma schema
- Update the ApprovalRequest TypeScript type in `@agent-identity/shared` to include `expires_at: Date | null`
- Create `BackgroundJob` model

**Work:**
- In `apps/api/src/jobs/runner.ts`: in-process interval-based job runner that starts on API boot
- In `apps/api/src/jobs/expire-approvals.ts`: runs every 60 seconds
  - Queries pending approvals where `expires_at < now()`
  - **Job locking:** Uses `SELECT ... FOR UPDATE SKIP LOCKED` to prevent duplicate processing across multiple API instances
  - Sets `status = 'expired'`, creates `AuditEvent`, updates trace `final_outcome = 'expired'`, creates `trace_closed` event
  - Processes in batches of 100
- SDK: `client.waitForApproval()` returns `expired` status when TTL hit, throws `ApprovalExpiredError`
- Default TTL: 24 hours (configurable per policy via `max_session_ttl`)

**Trace retention job** (`apps/api/src/jobs/trace-cleanup.ts`):
- Runs every hour
- For free-plan tenants: soft-delete traces + events older than `trace_retention_days` (7 days for free plan)
- For paid tenants: no automatic deletion (configurable retention period stored in tenant settings)
- Soft-delete means: set a `deleted_at` timestamp (add `deleted_at DateTime?` to AuditTrace and AuditEvent models in this migration). Prisma middleware filters out soft-deleted records from all queries.
- Batch size: 1000 traces per run
- Does NOT delete traces with pending approval requests (wait until resolved)

**Acceptance criteria:**
- Expired approvals automatically handled
- Job locking prevents duplicate processing (test with simulated concurrent execution)
- SDK receives typed `ApprovalExpiredError`
- Expired approvals return 409 on approve/deny attempt
- Trace retention job soft-deletes expired traces for free-plan tenants

---

### P2.3b — Risk Classification & Context Enrichment

**Input:** Approval service from P1.4, shared types from P0.2.

**Work:**
- Update `@agent-identity/shared` ApprovalRequest type: add `risk_classification: RiskClassification` and `context_snapshot: Record<string, unknown> | null`. Create Prisma migration to add both columns.
- In the evaluate endpoint (P1.3), when creating an `ApprovalRequest`, compute and store:
  - `risk_classification`: derived from data_classification + operation type
  - `context_snapshot`: the `context` field from the SDK evaluate call

**Risk classification derivation:**

```typescript
const DESTRUCTIVE_PREFIXES = ['delete', 'remove', 'send', 'export', 'drop', 'revoke'];
const MODIFYING_PREFIXES = ['create', 'update', 'modify', 'close', 'write', 'patch'];

function operationIsDestructive(operation: string): boolean {
  const normalized = operation.toLowerCase();
  return DESTRUCTIVE_PREFIXES.some(p => normalized.startsWith(p) || normalized.includes(`_${p}`));
}

function deriveRiskClassification(
  dataClassification: DataClassification,
  operation: string
): RiskClassification {
  const classLevel = { public: 1, internal: 2, confidential: 3, restricted: 4 };
  const opRisk = operationIsDestructive(operation) ? 2 : 1;
  const score = classLevel[dataClassification] * opRisk;
  if (score >= 7) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}
```

**Dashboard component:** `ApprovalRiskBadge.tsx` — color-coded: low (gray `#71717A`), medium (blue `#3B82F6`), high (amber `#F59E0B`), critical (red `#EF4444`)

**Acceptance criteria:**
- Risk classification computed and stored on every approval request
- Context snapshot captured from SDK evaluate call
- Risk badge renders correctly in approval queue cards
- Unit tests for risk derivation covering all combinations

---

### P2.3c — Approval Queue UX Improvements

**Input:** Approval queue from P1.5, risk classification from P2.3b.

**Dashboard components:**

```
apps/dashboard/src/
  components/approvals/
    ApprovalQueueFilters.tsx
    ApprovalQueueToolbar.tsx    # Sort dropdown
    ApprovalContextSnapshot.tsx
    ApprovalStaleBadge.tsx
```

**Work:**
- Sort by: time pending (oldest first, default), risk classification (highest first), agent
- Stale indicators on cards
- Pending count badge in navigation (polls every 30 seconds)
- Approval queue API enhanced with `meta.count_by_risk` and `meta.oldest_pending_seconds`

**Stale indicator logic:**

```typescript
function getStaleLevel(requestedAt: Date): 'fresh' | 'aging' | 'stale' | 'critical' {
  const minutesPending = (Date.now() - requestedAt.getTime()) / 60000;
  if (minutesPending < 15) return 'fresh';
  if (minutesPending < 60) return 'aging';
  if (minutesPending < 240) return 'stale';
  return 'critical';
}
```

**Acceptance criteria:**
- Queue sorting works by time and risk
- Stale warnings appear at correct thresholds (amber >1hr, red >4hr)
- Pending count badge in nav updates on poll
- Context snapshot renders in approval detail

---

### P2.4 — Trace & Audit Enhancements

**Input:** Trace viewer from P1.6, audit events from P1.3.

**Work:**
- **Trace linking (delegation chains):**
  - `parent_trace_id` on AuditTrace: when Agent A triggers Agent B, B's trace links to A's
  - **Note:** Delegation chain visualization deferred until the SDK supports creating delegation traces (no creation mechanism exists yet). The `parent_trace_id` field is stored for future use.
- **Trace export:**
  - `GET /api/v1/traces/:traceId/export?format=json` — full trace as JSON
  - `GET /api/v1/traces/export?agent_id=&from=&to=&format=csv` — bulk export
- **Dashboard improvements:**
  - Date range picker for filtering
  - Event detail expansion (click event to see metadata)
  - Trace export button

**Note:** Integrity hash chain (tamper detection) is deferred to Phase 4 (P4.5) where it belongs alongside enterprise compliance features.

**Trace export CSV columns:**

```
trace_id, agent_id, agent_name, operation, target_integration, resource_scope, data_classification, final_outcome, started_at, completed_at, duration_ms, approval_required, approver_name, approval_decision, approval_decided_at, policy_rule_id, policy_version
```

**CSV export join logic (explicit for implementer):**
- Query: `AuditTrace LEFT JOIN ApprovalRequest ON ApprovalRequest.trace_id = AuditTrace.trace_id LEFT JOIN PolicyRule ON ApprovalRequest.policy_rule_id = PolicyRule.id`
- `approval_required`: boolean — `true` if an ApprovalRequest record exists for this trace
- `approver_name`: from `ApprovalRequest.approver_name` (null if no approval)
- `approval_decision`: from `ApprovalRequest.status` (null if no approval)
- `approval_decided_at`: from `ApprovalRequest.decided_at` (null if no approval)
- `policy_rule_id`: from `ApprovalRequest.policy_rule_id`
- `policy_version`: from `PolicyRule.policy_version` via the join

**Dashboard components:**

```
apps/dashboard/src/
  components/audit/
    TraceList.tsx
    TraceListItem.tsx
    TraceListFilters.tsx
    TraceDetail.tsx
    TraceDetailHeader.tsx
    TraceEventTimeline.tsx
    TraceEventRow.tsx
    TraceEventDetail.tsx
    TraceExportButton.tsx
    TraceBulkExportButton.tsx
    DateRangePicker.tsx
```

**Acceptance criteria:**
- JSON export contains complete trace data
- CSV export works for date ranges
- Date range filter works
- Event detail expansion shows metadata

---

### P2.5 — Dashboard: Overview, Navigation & Architecture

**Input:** All API data from P2.1-P2.4.

**Overview page API:**

```typescript
// GET /api/v1/dashboard/overview
{
  stats: {
    total_agents: number,
    active_agents: number,
    total_policies: number,
    pending_approvals: number,
    traces_today: number,
    traces_this_week: number,
    avg_approval_time_minutes: number | null
  },
  pending_approvals: Array<{...}>,  // top 5 by urgency
  recent_traces: Array<{...}>,      // last 10
  system_health: {
    api: 'healthy' | 'degraded',
    database: 'healthy' | 'degraded' | 'unreachable',
    background_jobs: 'healthy' | 'stale'
  }
}
```

**Global search API:**

```typescript
// GET /api/v1/search?q=customer
{
  results: {
    agents: Array<{ id: string, name: string, highlight: string }>,
    traces: Array<{ trace_id: string, operation: string, agent_name: string, highlight: string }>,
    policies: Array<{ id: string, policy_name: string, agent_name: string, highlight: string }>,
    approvals: Array<{ id: string, operation: string, agent_name: string, highlight: string }>
  },
  total: number
}
```

**Dashboard components:**

```
apps/dashboard/src/
  app/dashboard/
    page.tsx                    # Overview page
    layout.tsx                  # Dashboard layout with sidebar nav
    architecture/page.tsx       # Architecture diagram page
  components/layout/
    DashboardSidebar.tsx
    DashboardBreadcrumbs.tsx
    GlobalSearchBar.tsx
    GlobalSearchResults.tsx
    PendingApprovalBadge.tsx
  components/overview/
    OverviewStats.tsx
    OverviewPendingList.tsx
    OverviewRecentTraces.tsx
    SystemHealthIndicator.tsx
  components/architecture/
    ArchitectureDiagram.tsx     # Reference v0-prototype/app/(app)/architecture/page.tsx
```

**Navigation structure:**

```typescript
const navItems = [
  { label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Agents', href: '/dashboard/agents', icon: 'Bot' },
  { label: 'Policies', href: '/dashboard/policies', icon: 'Shield' },
  { label: 'Approvals', href: '/dashboard/approvals', icon: 'CheckCircle', badge: pendingCount },
  { label: 'Audit', href: '/dashboard/audit', icon: 'ScrollText' },
  { label: 'Architecture', href: '/dashboard/architecture', icon: 'Network' },
];
```

**Architecture page:** Static page showing the conceptual control architecture diagram (Identity → Policy → Approval → Trace flow). Reference `v0-prototype/app/(app)/architecture/page.tsx` for the layout and content. This page provides "disproportionate credibility during enterprise conversations" (per v0 PRD).

**Acceptance criteria:**
- Overview page shows correct summary stats
- Pending approvals and recent traces are clickable
- Navigation consistent across all pages with pending badge
- Global search returns grouped results
- Breadcrumbs work on detail pages
- Architecture page renders the conceptual diagram

---

## Phase 3 — SDK & Integrations

**Goal:** Developers can integrate the governance layer into their existing agent code in under 5 minutes. MCP-native middleware, framework wrappers, IdP integration, and webhook delivery.

**Note:** P3.1, P3.2, and P3.3 can start ALONGSIDE Phase 2 — they work on SDK/packages, not dashboard/apps. P3.4 (IdP integration) MUST wait until P2.5 is complete, as it removes the development authentication bypass that the dashboard relies on during Phase 2. P3.5 depends on P3.1 and P3.2. P3.6 depends on P1.4 and P3.4.

---

### P3.1 — MCP Middleware

**Input:** SDK core from P1.1, MCP protocol specification.

**MCP SDK:** Use `@modelcontextprotocol/sdk` (latest stable version) for both the governance server and upstream client. The governance server extends the SDK's `Server` class. The upstream connection uses `StdioClientTransport` or `SSEClientTransport` from the SDK.

**Architecture:**

```
Agent (Claude, etc.)
  │
  ▼
Governance MCP Server (packages/sdk/src/mcp/)
  │
  ├── Intercepts tool call
  ├── Calls client.evaluate()
  ├── If allow: forwards to Real MCP Server
  ├── If approval_required: returns structured error (agent/orchestrator handles wait)
  ├── If deny: returns error to agent
  │
  ▼
Real MCP Server (user's existing server)
```

**IMPORTANT — approval_required behavior:** The MCP governance server CANNOT block waiting for human approval. MCP `tools/call` is a request-response protocol; blocking for minutes/hours would timeout the connection. Instead:

- On `approval_required`: return an MCP error response with structured data:
  ```json
  {
    "error": {
      "code": -32001,
      "message": "Approval required: [reason]",
      "data": {
        "type": "approval_required",
        "trace_id": "TR-...",
        "approval_request_id": "...",
        "dashboard_url": "https://app.agentidentity.dev/dashboard/approvals/...",
        "reason": "Policy requires human approval for this action"
      }
    }
  }
  ```
- The agent (or its orchestrator) is responsible for handling the wait/retry.
- Optionally, a `approvalWaitMode: 'block' | 'error'` config option allows blocking for short-lived automated approvals (default timeout: 30 seconds). `'error'` is the production default.

**Files:**

```
packages/sdk/src/mcp/
  governance-server.ts
  tool-interceptor.ts
  tool-mapper.ts
  config.ts
  index.ts
```

**GovernanceMCPServer configuration:**

```typescript
interface GovernanceMCPServerConfig {
  client: AgentIdentityClient;
  upstream: {
    transport: 'stdio' | 'sse' | 'streamable-http';
    command?: string;
    args?: string[];
    url?: string;
  };
  toolMappings?: ToolMapping[];
  defaultDataClassification?: DataClassification;
  defaultResourceScope?: string;
}

interface ToolMapping {
  toolName: string;                          // supports glob: "db_*"
  operation?: string;
  target_integration?: string;
  resource_scope?: string;
  data_classification?: DataClassification;
  skip_governance?: boolean;
}
```

**Resource scope derivation (when no explicit mapping):**

```typescript
function deriveResourceScope(toolName: string, args: Record<string, unknown>): string {
  const scopeKeys = ['path', 'file', 'table', 'database', 'collection', 'bucket', 'resource', 'url', 'endpoint'];
  for (const key of scopeKeys) {
    if (typeof args[key] === 'string') return args[key] as string;
  }
  return toolName;
}
```

**Usage example:**

```typescript
import { AgentIdentityClient, GovernanceMCPServer } from '@agent-identity/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.AGENT_IDENTITY_API_KEY,
  apiUrl: 'https://api.agentidentity.dev',
  agentId: 'agent-001'
});

const server = new GovernanceMCPServer({
  client,
  upstream: {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://...']
  },
  toolMappings: [
    { toolName: 'query', data_classification: 'confidential', operation: 'database_query' },
    { toolName: 'list_tables', skip_governance: true }
  ]
});

await server.start();
```

**Acceptance criteria:**
- Governance MCP server starts and connects to upstream via `@modelcontextprotocol/sdk`
- `tools/list` proxies correctly
- `tools/call` for allowed tool: forwarded, result returned, trace created
- `tools/call` for approval_required tool: returns structured MCP error with trace_id and approval_request_id (does NOT block)
- `tools/call` for denied tool: returns error immediately
- `approvalWaitMode: 'block'` with 30s timeout works for automated approval scenarios
- Tool mappings and glob matching work
- `skip_governance` tools forwarded without API calls
- `resources/*` and `prompts/*` pass through without governance
- Integration test: governance MCP server wrapping a mock MCP server

---

### P3.2 — Framework Wrappers

**Input:** SDK core from P1.1, `withGovernance()` from P1.1.

**Files:**

```
packages/sdk/src/middleware/
  langchain.ts       # LangChain.js / LangGraph.js wrapper
  openai-agents.ts   # OpenAI Agents SDK wrapper
  crewai.ts          # CrewAI wrapper
  vercel-ai.ts       # Vercel AI SDK wrapper
  generic.ts         # Generic wrapper for any async function
  index.ts           # Re-exports
```

**LangChain.js wrapper:** `governTool(tool, config)` and `governTools(tools, config)` — wraps LangChain Tools with governance.

**OpenAI Agents SDK wrapper:** `governOpenAITool(tool, config)` — wraps OpenAI function tools with governance. Uses the same evaluate → wait/error → execute → record pattern.

**CrewAI wrapper:** `governCrewAITool(tool, config)` — wraps CrewAI tools. If CrewAI.js doesn't exist yet, implement as a generic function wrapper that works with CrewAI's tool interface.

**Vercel AI SDK wrapper:** `governVercelTool(toolName, tool, config)` — wraps Vercel AI SDK CoreTool.

**Generic wrapper:** `governObject(obj, client, methodMappings)` — wraps methods of a plain object.

All wrappers follow the same pattern: evaluate before execution, record outcome after, throw `ActionDeniedError` on deny.

**Acceptance criteria:**
- Each wrapper works for all three decision paths
- Wrapped tools preserve original metadata (name, description, schema)
- Errors from original tools still thrown
- Outcome always recorded (success or error)
- Type safety maintained (no `any` leakage)
- Peer dependencies optional
- Unit tests for each wrapper

---

### P3.3 — Webhook Delivery

**Input:** Approval service from P1.4/P2.3a.

**Database migration:** `npx prisma migrate dev --name add-webhooks`

```prisma
model WebhookEndpoint {
  id          String   @id @default(uuid())
  tenant_id   String
  url         String
  secret      String
  events      String[]
  is_active   Boolean  @default(true)
  description String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  tenant      Tenant   @relation(fields: [tenant_id], references: [id])
  deliveries  WebhookDelivery[]
  @@index([tenant_id])
}

model WebhookDelivery {
  id            String   @id @default(uuid())
  endpoint_id   String
  event_type    String
  payload       Json
  status        String
  http_status   Int?
  response_body String?
  attempts      Int      @default(0)
  next_retry_at DateTime?
  created_at    DateTime @default(now())
  delivered_at  DateTime?
  endpoint      WebhookEndpoint @relation(fields: [endpoint_id], references: [id])
  @@index([endpoint_id, status])
  @@index([status, next_retry_at])
}
```

**Webhook event types:**

```typescript
type WebhookEventType =
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.denied'
  | 'approval.expired'
  | 'trace.completed'
  | 'agent.suspended'
  | 'agent.revoked'
  | 'policy.updated';
```

**Webhook payload shape:**

```typescript
interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  tenant_id: string;
  data: Record<string, unknown>;
}
```

**Delivery service (`apps/api/src/services/webhook-service.ts`):**

- `dispatch(tenantId, event, data)` — finds matching endpoints, creates WebhookDelivery records, queues for async processing
- `deliver(deliveryId)` — POSTs payload to endpoint URL with HMAC-SHA256 signature
- Signature: `X-Webhook-Signature: sha256=<HMAC(secret, JSON.stringify(payload))>`
- Additional headers: `Content-Type: application/json`, `X-Webhook-ID: <delivery_id>`, `X-Webhook-Timestamp: <ISO>`
- Retry schedule: attempt 1 → 1 min, attempt 2 → 5 min, attempt 3 → 30 min, attempt 4 → 2 hours, attempt 5 → give up (mark as 'failed')

**SDK webhook verification:**

```typescript
// packages/sdk/src/webhooks/verify.ts
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

**API endpoints:**

```
POST   /api/v1/webhooks          — create endpoint (returns secret ONCE)
GET    /api/v1/webhooks          — list endpoints (without secrets)
GET    /api/v1/webhooks/:id      — single endpoint (without secret)
PATCH  /api/v1/webhooks/:id      — update (url, events, is_active)
DELETE /api/v1/webhooks/:id      — delete endpoint
GET    /api/v1/webhooks/:id/deliveries?status=&limit=  — delivery history
POST   /api/v1/webhooks/:id/test — send test event, report success/failure
```

**IMPORTANT — Transaction boundary:** Webhook dispatch MUST occur AFTER the primary transaction commits. Pattern: commit the evaluation/approval/lifecycle transaction first, then dispatch webhooks in a separate, non-transactional step. If webhook dispatch fails (no matching endpoints, database error creating delivery records), log the error but do NOT affect the primary operation's result. Never roll back a successful evaluation because webhook dispatch failed.

**Integration points (where webhooks are dispatched):**

| Location | Event Type |
|----------|-----------|
| POST /api/v1/evaluate (when approval_required) | approval.requested |
| POST /api/v1/approvals/:id/approve | approval.approved |
| POST /api/v1/approvals/:id/deny | approval.denied |
| Approval expiry background job | approval.expired |
| POST /api/v1/traces/:traceId/outcome | trace.completed |
| POST /api/v1/agents/:id/suspend | agent.suspended |
| POST /api/v1/agents/:id/revoke | agent.revoked |
| PATCH /api/v1/policies/:id | policy.updated |

**Background job (`apps/api/src/jobs/webhook-delivery.ts`):**
- Runs every 10 seconds
- Picks up pending deliveries (max 20 per batch) using SELECT ... FOR UPDATE SKIP LOCKED
- Delivers in parallel (Promise.allSettled)
- Picks up failed deliveries where next_retry_at < now() (max 10 per batch)

**Acceptance criteria:**
- Creating endpoint returns secret exactly once
- Dispatching event creates delivery records for all matching endpoints
- Delivery POSTs with correct HMAC-SHA256 signature
- Signature verification function validates legitimate payloads and rejects tampered ones
- Retry schedule works (1m, 5m, 30m, 2h, give up)
- After 5 failures, delivery marked as failed
- Test endpoint sends test event and reports success/failure
- Job locking prevents duplicate delivery across instances
- Integration test: create endpoint → trigger approval → verify webhook received with correct signature

---

### P3.4 — IdP Integration (Okta / Auth0)

**Input:** User model from P0.2, dashboard from P2.5.

**Work:** OAuth 2.0 / OIDC authentication for the dashboard. API continues using API keys for SDK.

**Scope:** This task implements OIDC providers only (Okta, Auth0, generic OIDC). GitHub OAuth and email/password authentication are built in P5.3 as part of self-serve signup.

**Files:**

```
apps/api/src/auth/
  session.ts           # Session creation, validation, destruction
  oidc.ts              # OIDC client (authorization code flow with PKCE)
  providers/
    okta.ts            # Okta-specific configuration
    auth0.ts           # Auth0-specific configuration
    generic-oidc.ts    # Generic OIDC provider
  middleware.ts        # Extract session from cookie, load user into request context
```

**Authentication flow:**

1. User visits /dashboard → dashboard checks for session cookie
2. If no session → redirect to /api/v1/auth/login?provider=okta
3. API generates state + PKCE code_verifier, stores in short-lived server session, redirects to IdP
4. IdP authenticates → redirects to /api/v1/auth/callback
5. API exchanges code for tokens (authorization_code grant with PKCE)
6. API extracts user info from ID token (email, name, groups)
7. API creates or updates User record
8. API creates Session in PostgreSQL, sets HttpOnly cookie
9. Redirects to /dashboard

**Database model (migration: `npx prisma migrate dev --name add-sessions`):**

```prisma
model Session {
  id          String   @id @default(uuid())
  user_id     String
  tenant_id   String
  expires_at  DateTime
  created_at  DateTime @default(now())
  user        User     @relation(fields: [user_id], references: [id])
  @@index([user_id])
  @@index([expires_at])
}
```

**API endpoints:**

```
GET  /api/v1/auth/login?provider=okta&redirect_uri=...  → redirects to IdP
GET  /api/v1/auth/callback?code=...&state=...           → exchanges code, creates session
POST /api/v1/auth/logout                                → destroys session, clears cookie
GET  /api/v1/auth/me                                    → returns current user
```

**GET /api/v1/auth/me response:**
```typescript
{ data: { id: string, email: string, name: string, role: 'admin' | 'reviewer' | 'viewer', tenant_id: string, tenant_name: string } }
```

**Environment configuration:**
```
OIDC_PROVIDER=okta|auth0
OIDC_ISSUER=https://...
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=http://localhost:4000/api/v1/auth/callback
```

**Dashboard changes:**
- Add `AuthProvider` React context: on mount calls GET /api/v1/auth/me; if 401 redirects to login
- All dashboard API calls include session cookie (credentials: 'include')
- User avatar/name in top-right of dashboard nav
- Logout button

**Session management:**
- Sessions expire after 8 hours (configurable via `sessionTtlSeconds`)
- Background job: clean expired sessions every hour
- Session cookie: HttpOnly, Secure (in production), SameSite=Lax, path /
- In development mode, CSRF cookie uses SameSite=Lax (not Strict) to work with cross-port API calls

**Additional work:**
- **Remove dev bypass:** Update `apps/api/src/middleware/auth.ts` to remove the `X-Dev-Bypass` header support. Dashboard now authenticates via session cookies.
- **CSRF protection:** All state-changing API endpoints (POST, PATCH, DELETE) must validate a CSRF token via `X-CSRF-Token` header. Implement double-submit cookie pattern: API sets a `csrf_token` cookie (not HttpOnly, SameSite=Strict), dashboard reads it and sends as header.

**Acceptance criteria:**
- Login flow works end-to-end with Okta OR Auth0
- User created/updated in database on first login
- Session cookie: HttpOnly, Secure in prod, SameSite=Lax
- Dashboard redirects to login when no session
- GET /api/v1/auth/me returns correct user info
- Expired sessions rejected (401)
- API key auth still works independently for SDK
- PKCE used, state parameter validated
- Dev bypass is removed
- CSRF token required on all state-changing endpoints
- When any dashboard API call returns 401, the API client (`apps/dashboard/src/lib/api-client.ts`) redirects to `/login?expired=true` which shows 'Session expired, please log in again'. This is handled globally in the API client, not per-component.

---

### P3.5 — SDK Package & Developer Documentation

**Input:** SDK core from P1.1, MCP middleware from P3.1, framework wrappers from P3.2.

**SDK package structure (publish-ready):**

```
packages/sdk/
  package.json
  tsconfig.json
  tsup.config.ts            # Bundle config for dual CJS/ESM output
  README.md                 # Developer-facing quick start
  LICENSE                   # Apache 2.0
  src/
    index.ts                # Main entry: exports client, middleware, MCP, webhooks, types
    client/
      index.ts
      agent-identity-client.ts
      errors.ts
    middleware/
      index.ts
      governance.ts
      langchain.ts
      openai-agents.ts
      crewai.ts
      vercel-ai.ts
      generic.ts
    mcp/
      index.ts
      governance-server.ts
      tool-interceptor.ts
      tool-mapper.ts
      config.ts
    webhooks/
      index.ts
      verify.ts
    types/
      index.ts              # Re-exports from @agent-identity/shared
```

**Updated package.json exports:**

```json
{
  "exports": {
    ".": { "import": "./dist/index.mjs", "require": "./dist/index.cjs", "types": "./dist/index.d.ts" },
    "./mcp": { "import": "./dist/mcp/index.mjs", "require": "./dist/mcp/index.cjs", "types": "./dist/mcp/index.d.ts" },
    "./langchain": { "import": "./dist/middleware/langchain.mjs", "require": "./dist/middleware/langchain.cjs", "types": "./dist/middleware/langchain.d.ts" },
    "./openai-agents": { "import": "./dist/middleware/openai-agents.mjs", "require": "./dist/middleware/openai-agents.cjs", "types": "./dist/middleware/openai-agents.d.ts" },
    "./crewai": { "import": "./dist/middleware/crewai.mjs", "require": "./dist/middleware/crewai.cjs", "types": "./dist/middleware/crewai.d.ts" },
    "./vercel-ai": { "import": "./dist/middleware/vercel-ai.mjs", "require": "./dist/middleware/vercel-ai.cjs", "types": "./dist/middleware/vercel-ai.d.ts" },
    "./webhooks": { "import": "./dist/webhooks/index.mjs", "require": "./dist/webhooks/index.cjs", "types": "./dist/webhooks/index.d.ts" }
  },
  "peerDependencies": {
    "@langchain/core": ">=0.2.0",
    "ai": ">=3.0.0",
    "openai": ">=4.0.0"
  },
  "peerDependenciesMeta": {
    "@langchain/core": { "optional": true },
    "ai": { "optional": true },
    "openai": { "optional": true }
  }
}
```

**Acceptance criteria:**
- `npm pack` produces valid tarball containing dist/, README.md, LICENSE, package.json
- All subpath imports work in both CJS and ESM
- Peer dependencies are optional (SDK works without LangChain, Vercel AI, or OpenAI installed)
- Bundle size <50KB minified
- All SDK unit tests pass
- TypeScript types complete (no `any` in public API surface)
- README renders correctly on npm

---

### P3.6 — Approval Email Notifications

**Input:** Approval service from P1.4, webhook infrastructure from P3.3.

**Why this matters:** The approval primitive is the product's moat. Without proactive notifications, a reviewer must have the dashboard open to notice pending requests. For agents blocking on `waitForApproval()`, latency between 'requested' and 'reviewer sees it' could be hours.

**Work:**
- When an approval request is created (in the evaluate endpoint, after transaction commits):
  1. Look up users with role 'reviewer' or 'admin' in the tenant
  2. Send email with: agent name, operation, data classification, risk level, direct deep-link to approval detail in dashboard
  3. Use a transactional email service (Resend recommended for developer experience; alternatives: SendGrid, AWS SES)
  4. Rate limit: max 1 email per tenant per minute (batch multiple pending requests into a single digest email if several arrive within the window)
  5. Configurable per tenant: enable/disable, custom notification email list (overrides user lookup)

**Environment variables:**
```
EMAIL_PROVIDER=resend|sendgrid|ses    # which provider to use
EMAIL_API_KEY=...                      # provider API key
EMAIL_FROM=notifications@agentidentity.dev
```

**Files:**
```
apps/api/src/services/email-service.ts        # Email sending abstraction
apps/api/src/services/notification-service.ts  # Approval notification logic
apps/api/src/templates/approval-requested.ts   # Email template (plain text + HTML)
```

**Acceptance criteria:**
- Email sent when approval request created (after transaction commits)
- Email contains agent name, operation, risk level, and deep-link to dashboard
- Rate limiting: multiple requests within 1 minute batched into single email
- Configurable per tenant (can disable, can set custom recipients)
- Email delivery failure does NOT affect the evaluate endpoint response
- Works with at least one provider (Resend for initial implementation)

---

## Phase 4 — Enterprise Readiness

**Goal:** The platform can be sold to enterprise design partners. OIDC SSO, role-based access, tenant isolation, API key management, rate limiting, integrity hashes, and audit log export to SIEMs.

**Note:** SAML support is deferred to a future phase. Most design partners use OIDC (Okta, Auth0, Azure AD). SAML can be added when a specific customer requires it.

---

### P4.1 — RBAC (Role-Based Access Control)

**Input:** User model from P0.2, session auth from P3.4.

**Permission matrix:**

| Permission | `viewer` | `reviewer` | `admin` |
|-----------|----------|------------|---------|
| View agents, policies, traces | Yes | Yes | Yes |
| Approve/deny requests | No | Yes | Yes |
| Create/edit agents | No | No | Yes |
| Create/edit policies | No | No | Yes |
| Manage webhooks | No | No | Yes |
| Manage API keys | No | No | Yes |
| Manage users & roles | No | No | Yes |
| Suspend/revoke agents | No | No | Yes |
| Export traces | No | Yes | Yes |

**Implementation:** Middleware `requireRole(...roles)` on API routes — returns 403 with `error: 'forbidden'` if user's role is not in the allowed list. Dashboard hides UI elements the user can't act on.

**API endpoints:**

```
GET    /api/v1/users           — list users in tenant (admin only)
PATCH  /api/v1/users/:id       — update role (admin only). Request: { role: 'viewer' | 'reviewer' | 'admin' }
DELETE /api/v1/users/:id       — remove user from tenant (admin only). Invalidates all user sessions immediately.
```

**Dashboard — Users page** (`/dashboard/settings/users`):
- Table: name, email, role (dropdown for admin), last login, created date
- Admin can change roles via dropdown
- Admin can remove users (confirmation dialog)

**Acceptance criteria:**
- Viewer cannot approve/deny (API 403, UI hides buttons)
- Reviewer can approve/deny but cannot create agents or policies
- Admin can do everything
- Role changes take effect on next API call
- User removal invalidates sessions immediately
- Integration tests for each role against all protected endpoints

---

### P4.2 — Tenant Isolation

**Input:** Tenant model from P0.2, all API routes.

**Implementation approach — Prisma extension only (no RLS at this stage):**

```typescript
function tenantIsolation(tenantId: string) {
  return Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({ args, query, operation }) {
          // Operations that filter by where clause
          const whereOps = ['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique',
            'findUniqueOrThrow', 'count', 'aggregate', 'groupBy',
            'updateMany', 'deleteMany', 'update', 'delete', 'upsert'];
          if (whereOps.includes(operation)) {
            args.where = { ...args.where, tenant_id: tenantId };
          }
          // Operations that set data
          if (operation === 'create') {
            args.data = { ...args.data, tenant_id: tenantId };
          }
          if (operation === 'createMany') {
            args.data = Array.isArray(args.data)
              ? args.data.map(d => ({ ...d, tenant_id: tenantId }))
              : { ...args.data, tenant_id: tenantId };
          }
          if (operation === 'upsert') {
            args.create = { ...args.create, tenant_id: tenantId };
          }
          return query(args);
        }
      }
    }
  });
}
```

Each request gets a tenant-scoped Prisma client set by auth middleware.

**Note:** PostgreSQL Row-Level Security (RLS) is a future hardening step. Prisma extension provides application-level isolation which is sufficient for initial enterprise deployment. RLS adds database-level defense-in-depth but requires careful interaction with Prisma's connection pool (`SET LOCAL` within transactions). Defer to a future security hardening phase.

**Acceptance criteria:**
- Tenant A cannot see Tenant B's data (tested with two test tenants)
- Creating records automatically sets tenant_id
- API returns 404 (not 403) for cross-tenant access
- Integration tests with two tenants performing identical operations

---

### P4.3 — API Key Management

**Input:** ApiKey model from P0.2, tenant isolation from P4.2.

**API key scopes:**

```typescript
type ApiKeyScope = 'evaluate' | 'traces:read' | 'traces:write' | 'agents:read' | 'approvals:read' | 'admin';
```

Default SDK key scopes: `['evaluate', 'traces:read', 'traces:write', 'approvals:read']`

**Key format:** `ai_` + 32 random bytes as hex = 67 chars total. Stored as SHA-256 hash — raw key shown only once at creation.

**API endpoints:**

```typescript
// POST /api/v1/api-keys (admin only)
// Request: { name: string, scopes: ApiKeyScope[], expires_at?: string }
// Response: { data: { id, name, scopes, key: "ai_...", expires_at, created_at } }
//   ⚠ key field returned ONLY on creation

// GET /api/v1/api-keys (admin only)
// Response: { data: Array<{ id, name, scopes, key_prefix: "ai_a1b2...", last_used_at, expires_at, created_at }> }

// DELETE /api/v1/api-keys/:id (admin only)

// POST /api/v1/api-keys/:id/rotate (admin only)
// → Generates new key, invalidates old, returns new key once
```

**Auth middleware update (scope enforcement):**
- After validating API key hash, check scopes against the route
- Scope mapping: `POST /api/v1/evaluate` requires `evaluate`, `GET /api/v1/traces/*` requires `traces:read`, etc.
- Insufficient scope returns 403 with `error: 'forbidden'`
- Update `last_used_at` debounced (once per minute per key)

**Dashboard — API Keys page** (`/dashboard/settings/api-keys`):
- List: name, key prefix (first 12 chars), scopes, last used, expires, created
- Create button → modal (name, scope checkboxes, optional expiry)
- On create: show full key in copyable dialog with "This won't be shown again" warning
- Rotate button → confirmation → shows new key once
- Delete button → confirmation

**Acceptance criteria:**
- Key creation returns raw key exactly once
- Subsequent reads show only prefix
- SDK auth works with valid key
- Expired keys rejected (401)
- Deleted keys rejected immediately
- Scope enforcement: key with only `evaluate` scope cannot call GET /api/v1/agents (403)
- Key rotation invalidates old key
- `last_used_at` updates correctly
- Integration test: create → use → delete → verify rejected

---

### P4.4 — Rate Limiting

**Input:** API scaffold from P0.4, tenant isolation from P4.2.

**Rate limit tiers:**

| Endpoint Category | Free | Team | Enterprise |
|------------------|------|------|-----------|
| POST /evaluate | 100/min | 1,000/min | 10,000/min |
| Read endpoints | 300/min | 3,000/min | 30,000/min |
| Write endpoints | 60/min | 600/min | 6,000/min |

**Implementation:**
- In-memory sliding window counter (no Redis needed at this scale)
- Key: `{tenant_id}:{endpoint_category}:{window_minute}`
- Fastify `onRequest` hook checks counter
- Returns 429 with headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix timestamp), `Retry-After` (seconds)
- Rate limits are per tenant (multiple API keys share tenant limit)
- Limits configurable per tenant (for enterprise overrides via admin API)

**File:** `apps/api/src/middleware/rate-limit.ts`

**Scalability note:** In-memory rate limiting is per-process. For single-instance deployment (initial launch), this is sufficient. When scaling to multiple API instances, migrate to PostgreSQL-backed or Redis-backed counters. The implementation MUST use an interface (`RateLimiter` with `check(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean, remaining: number, resetAt: number }>`) so the storage backend can be swapped without changing route code.

**Acceptance criteria:**
- Rate limits enforced per tenant
- Correct 429 response with standard headers when exceeded
- Different limits for different endpoint categories
- SDK receives typed `RateLimitError` with `retryAfter` field
- Rate limit state resets correctly at window boundary

---

### P4.5 — Integrity Hashes & Audit Log Export

**Input:** Audit traces/events from P2.4, webhooks from P3.3.

**This task combines integrity hashing (moved from P2.4) with SIEM export.**

**Integrity hash chain:**
- Add `integrity_hash String?` to `AuditEvent` and `AuditTrace` models via migration: `npx prisma migrate dev --name add-integrity-hashes`
- Each audit event gets an `integrity_hash`: SHA-256 of (event content + previous event's hash)
- **Serialization:** All event creation for a given trace must be serialized. Use `SELECT ... FOR UPDATE` on the trace row to acquire a lock before inserting a new event and computing its hash. This prevents concurrent writes from breaking the chain.

**Integrity hash computation:**

```typescript
import { createHash } from 'crypto';

function computeEventHash(event: AuditEvent, previousHash: string | null): string {
  const payload = JSON.stringify({
    id: event.id,
    trace_id: event.trace_id,
    event_type: event.event_type,
    actor_type: event.actor_type,
    actor_name: event.actor_name,
    description: event.description,
    status: event.status,
    timestamp: event.timestamp,
    previous_hash: previousHash ?? 'GENESIS'
  });
  return createHash('sha256').update(payload).digest('hex');
}
```

**API endpoints:**

```typescript
// GET /api/v1/traces/:traceId/verify
{
  verified: boolean,
  total_events: number,
  verified_events: number,
  broken_at: { event_id, event_type, expected_hash, actual_hash } | null
}

// GET /api/v1/audit/export?from=&to=&format=json|csv
```

**Dashboard additions:**
- `TraceIntegrityBadge.tsx` — green check (verified) or red warning (broken)
- Audit Export page at `/dashboard/settings/audit-export`

**SIEM export:** JSON and CSV formats. Max 100MB or 100,000 events per request. Continuous export via webhook (`audit.event` and `audit.batch` event types). CEF format deferred until a design partner specifically requires ArcSight compatibility. Ship JSON and CSV only.

**Webhook type extension:** This task adds `'audit.event'` and `'audit.batch'` to the `WebhookEventType` union defined in P3.3. Update `apps/api/src/services/webhook-service.ts` to handle these new event types. Update webhook endpoint event validation to accept them.

**Acceptance criteria:**
- Hash chain integrity maintained for all new events
- Verify endpoint detects tampered events
- Dashboard shows integrity badge
- JSON and CSV export formats both valid
- Continuous export via webhook works
- Serialization lock prevents concurrent hash chain breaks

---

### P4.6 — Dashboard Settings & Tenant Configuration

**Input:** RBAC from P4.1, API keys from P4.3, webhooks from P3.3, audit export from P4.5.

**Dashboard pages:**

```
apps/dashboard/src/app/dashboard/settings/
  page.tsx                — Settings overview: tenant name, plan, quick stats, links to sub-pages
  users/page.tsx          — User management (P4.1)
  api-keys/page.tsx       — API key management (P4.3)
  webhooks/page.tsx       — Webhook endpoint management (P3.3)
  audit-export/page.tsx   — Audit export configuration (P4.5)
  general/page.tsx        — Tenant settings
```

**General settings:**
- Tenant display name (editable)
- Default approval TTL (seconds, used when policy doesn't specify max_session_ttl)
- Default data classification for unclassified actions
- Notification email for system alerts

**API endpoint:**
```typescript
GET   /api/v1/tenant/settings
PATCH /api/v1/tenant/settings (admin only)
// Request: { default_approval_ttl_seconds?: number, default_data_classification?: string, notification_email?: string }
```

**Navigation update:** Add "Settings" to sidebar nav (gear icon, at bottom). Settings sub-navigation: General, Users, API Keys, Webhooks, Audit Export.

**Acceptance criteria:**
- All settings sub-pages accessible and functional
- Only admins can access settings (viewers/reviewers redirected with "Admin access required")
- General settings save and take effect on subsequent API calls
- Default approval TTL used when policy doesn't set max_session_ttl

---

## Phase 5 — Open-Source & Launch

**Goal:** SDK published to npm, documentation site live, example apps, landing page, self-serve signup. Developers can discover, install, and start using the product without talking to anyone.

---

### P5.1 — Documentation Site

**Input:** SDK from P3.5, API from all phases.

**Framework:** Fumadocs (Next.js-native, MDX) — stays in the TypeScript monorepo. Alternative: Starlight (Astro) if build isolation preferred.

**Content structure:**

```
apps/docs/src/content/docs/
  index.mdx                    # Home / overview
  quickstart.mdx               # 2-minute getting started
  concepts/
    identity.mdx               # What is agent identity
    policy.mdx                 # How policies work
    approval.mdx               # The approval primitive
    traces.mdx                 # Audit traces explained
  sdk/
    installation.mdx
    evaluate.mdx
    with-governance.mdx
    wait-for-approval.mdx
    record-outcome.mdx
    errors.mdx
  integrations/
    mcp.mdx
    langchain.mdx
    openai-agents.mdx
    crewai.mdx
    vercel-ai.mdx
  platform/
    agents.mdx
    policies.mdx
    approvals.mdx
    audit.mdx
  enterprise/
    sso.mdx
    rbac.mdx
    api-keys.mdx
    webhooks.mdx
    siem-export.mdx
  compliance/
    finra-2026.mdx             # FINRA 2026 → product capability mapping
    eu-ai-act.mdx              # EU AI Act Articles 9/12/13/14 → product mapping
    nist-ai-rmf.mdx            # NIST AI RMF → product mapping
  api-reference/
    (auto-generated from OpenAPI spec)
```

**Quickstart page (most important page):**
```
# Quick Start — 2 minutes
1. Install: npm install @agent-identity/sdk
2. Sign up and get an API key (link to signup → dashboard → API keys)
3. Initialize client (3-line code block)
4. Wrap your tools (5-line code block showing withGovernance())
5. See it in action (run agent → approval appears in dashboard → approve → agent continues)
Next steps: MCP setup, first policy, LangChain integration
```

**Compliance mapping pages (critical for GTM):** FINRA 2026 → product capability mapping, EU AI Act Articles 9/12/13/14 → product capability mapping, NIST AI RMF → product capability mapping. These are static documentation pages that map regulatory requirements to specific product features and demonstrate compliance readiness.

**Acceptance criteria:**
- Docs site builds and serves via `turbo dev --filter=docs`
- Quickstart completable in under 2 minutes
- API reference matches actual API behavior (from OpenAPI spec)
- Search works across all pages
- Dark mode matches product aesthetic
- Mobile-responsive
- Deployable as static site
- Compliance mapping pages present and accurate

---

### P5.2 — Example Applications

**Input:** SDK from P3.5, MCP middleware from P3.1, framework wrappers from P3.2.

**Three example applications:**

**1. `mcp-postgres-governed`** (hero example)
Wraps the standard MCP PostgreSQL server with governance. Agent can read any table freely, but queries touching the `customers` table require approval, and DROP/DELETE statements are auto-blocked.

```typescript
// index.ts (complete, runnable)
import { AgentIdentityClient, GovernanceMCPServer } from '@agent-identity/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.AGENT_IDENTITY_API_KEY!,
  apiUrl: process.env.AGENT_IDENTITY_API_URL ?? 'http://localhost:4000',
  agentId: 'postgres-agent'
});

const server = new GovernanceMCPServer({
  client,
  upstream: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', process.env.DATABASE_URL!] },
  toolMappings: [{ toolName: 'query', operation: 'database_query', target_integration: 'postgres', data_classification: 'confidential' }]
});

await server.start();
```

**2. `langchain-customer-support`**
Customer support agent with three governed tools: `search_knowledge_base` (allowed), `send_email_to_customer` (requires approval), `export_customer_data` (denied). Uses LangChain.js with `governTools()`.

**3. `vercel-ai-assistant`**
Next.js app using Vercel AI SDK with governed tools. Demonstrates the product in a web app context.

**Each example includes:** README, complete code, docker-compose.yml (if needed), seed script for agent/policies, expected output description.

**Acceptance criteria:**
- Each runs with `npm install && npm start` (plus env vars)
- Each demonstrates at least 2 policy effects
- READMEs clear for a developer with no prior knowledge
- Examples work against both local stack and hosted platform

---

### P5.3 — Self-Serve Signup & Tenant Provisioning

**Input:** Tenant model from P0.2, OIDC auth from P3.4.

**Work:**

This task extends P3.4's OIDC authentication with additional auth providers for self-serve signup.

**Additional auth providers to build:**

- **GitHub OAuth provider** (`apps/api/src/auth/providers/github.ts`):
  - GitHub uses plain OAuth 2.0 (NOT OIDC). Implement authorization code flow manually.
  - After token exchange, call GitHub API (`GET /user`) to get email, name, avatar.
  - Map to User model.

- **Google OIDC provider** (`apps/api/src/auth/providers/google.ts`):
  - Google supports OIDC. Can use the generic-oidc.ts provider with Google-specific configuration.
  - Issuer: `https://accounts.google.com`

- **Email/password provider** (`apps/api/src/auth/providers/email-password.ts`):
  - `POST /api/v1/auth/signup` — creates user with bcrypt-hashed password (cost factor 12)
  - `POST /api/v1/auth/login` — validates credentials, creates session
  - Add `password_hash String?` and `auth_provider String` to User model via migration
  - Email validation (format check, not verification at this stage)

**Signup flow:**

1. Developer visits landing page → clicks "Get Started Free"
2. Redirected to /signup
3. Options: "Sign up with GitHub" / "Sign up with Google" / "Sign up with email"
4. OAuth flow or email + bcrypt password
5. On first login:
   a. Create Tenant (name defaults to user's name + "'s workspace")
   b. Create User (role: admin)
   c. Create default API key (scopes: evaluate, traces:read, traces:write, approvals:read)
   d. Show onboarding: "Here's your API key: ai_... Copy it now, you won't see it again"
   e. Redirect to /dashboard with onboarding checklist

**Onboarding checklist (persisted in tenant settings):**
- [ ] Copy your API key
- [ ] Register your first agent
- [ ] Create a policy
- [ ] Run your first evaluation (auto-completed when first trace appears)
- [ ] See your first trace

Dashboard: dismissible checklist bar at top. Disappears when all steps complete or dismissed.

**Free plan limits:**

```typescript
const FREE_PLAN_LIMITS = {
  max_agents: 5,
  max_policies_per_agent: 10,
  max_api_keys: 2,
  max_webhook_endpoints: 1,
  max_users: 3,
  trace_retention_days: 7,
  rate_limit_evaluate_per_min: 100,
};
```

Enforced at API level: return 402 with `{ error: "plan_limit_reached", message: "Free plan allows up to 5 agents. Upgrade to Team for more.", limit: "max_agents", current: 5, max: 5 }`.

**Acceptance criteria:**
- GitHub OAuth signup works end-to-end
- Google OIDC signup works end-to-end
- Email/password signup works with bcrypt hashing
- Tenant, user, API key created atomically
- API key shown exactly once during onboarding
- Free plan limits enforced (402 response)
- Duplicate email returns clear error

---

### P5.4 — Landing Page

**Input:** Design tokens from P0.5, product positioning from market research.

**Page structure (top to bottom):**

1. **Hero** — "The approval and accountability layer for agentic AI" / subheadline / [Get Started Free] [View on GitHub]
2. **Problem** — 3 stats: "73% of CISOs fear agent risks. Only 30% are ready." / "79% have blind spots" / "37% already had incidents"
3. **Four Primitives** — Identity → Policy → Approval → Trace visual with one-line descriptions
4. **Approval Demo** — Screenshot of approval detail panel. Caption: "Every high-risk action gets a context-rich approval card."
5. **Comparison** — "What makes this different": Others do I+P+A. We add the Approval primitive with rich context.
6. **Use Cases** — Finance (FINRA), Healthcare (HIPAA), Platform Teams (scale)
7. **Pricing** — Free (5 agents) / Team ($X/mo, 50 agents) / Enterprise (custom)
8. **Open Source** — "The SDK is Apache 2.0. We monetize the hosted platform, not the developer tool."
9. **CTA Footer** — "Get started in 2 minutes" / [Create Free Account] / `npm install @agent-identity/sdk`

**Design:** "Institutional Calm" — dark background (#0A0A0B), muted text (#E4E4E7), no AI sparkle, no gradient blobs. Inter for body, JetBrains Mono for code.

**Directory:**
```
apps/landing/src/
  app/
    page.tsx, layout.tsx
  components/
    Hero.tsx, ProblemStatement.tsx, FourPrimitives.tsx, ApprovalDemo.tsx,
    ComparisonTable.tsx, UseCases.tsx, Pricing.tsx, OpenSource.tsx, CTAFooter.tsx
```

**Acceptance criteria:**
- Page loads fast (<2s LCP)
- "Get Started Free" links to /signup
- "View on GitHub" links to SDK repo
- All stats cite sources (small footnotes)
- Responsive (works on mobile)
- Passes Lighthouse accessibility (>90)
- Pricing reflects actual free tier limits

---

### P5.5 — npm Publish & GitHub Repository

**Input:** SDK from P3.5, docs from P5.1, examples from P5.2.

**npm publish checklist:**
- package.json: name @agent-identity/sdk, version 0.1.0, license Apache-2.0, repository URL
- LICENSE: Apache 2.0 full text
- README.md: quick start, badge links
- CHANGELOG.md: initial entry
- dist/ built with tsup (dual CJS/ESM, type declarations)
- All tests pass, bundle <50KB, no secrets or internal URLs

**GitHub repository setup:**
```
README.md (with badges: npm version, license, CI status)
LICENSE (Apache 2.0)
CONTRIBUTING.md
CODE_OF_CONDUCT.md (Contributor Covenant)
.github/
  ISSUE_TEMPLATE/bug_report.md, feature_request.md
  PULL_REQUEST_TEMPLATE.md
  workflows/
    ci.yml          — lint, typecheck, test, build on PR
    release.yml     — publish to npm on tag push (v*.*.*)
examples/
```

**Release workflow:** triggered on tag push matching `v*.*.*` → checkout → setup Node → install → test → build → publish to npm (NPM_TOKEN secret) → create GitHub Release with changelog.

**Acceptance criteria:**
- `npm install @agent-identity/sdk` works
- Package page on npmjs.com shows correct README, version, license
- GitHub repo is public with correct license
- CI runs on PRs, blocks merge on failure
- Release workflow publishes to npm on version tag
- Issue templates work
- `npm audit` shows no vulnerabilities

---

### P5.6 — Deployment

**Input:** All apps from previous phases, Docker Compose from P0.4.

**Work:**
- Create production Dockerfiles for each service:
  - `apps/api/Dockerfile` — multi-stage build (install → build → runtime). Node.js slim base image. Runs Prisma migrations on startup.
  - `apps/dashboard/Dockerfile` — multi-stage build. Next.js standalone output mode.
  - `apps/docs/Dockerfile` — static site build, served via nginx or similar.
  - `apps/landing/Dockerfile` — static site build, served via nginx or similar.
- Create `docker-compose.production.yml` with all services, PostgreSQL, and environment variable configuration.
- Create `deployment/` directory with:
  - `env.example` — documented environment variables for all services
  - `.env.development` — local development defaults (created/updated by seed script)
- Database migration strategy: API container runs `npx prisma migrate deploy` on startup before accepting traffic.

**Health check probes for container orchestration:**
- Readiness probe: `GET /health` returns 200 when API is ready to serve traffic (DB connected, migrations applied)
- Liveness probe: `GET /health/live` returns 200 as long as the process is running (no dependency checks)
- Both probes documented in Dockerfiles and docker-compose.yml

**Acceptance criteria:**
- `docker compose -f docker-compose.production.yml up` starts all services
- API, dashboard, docs, and landing page all accessible
- Health check probes work correctly for container orchestration
- Environment variables documented in env.example
- Database migrations run automatically on API startup
- Images are minimal size (multi-stage builds, no dev dependencies in production)

---

## Post-Launch Priorities

### Python SDK (Target: 4 weeks after TypeScript SDK launch)

The TypeScript SDK covers LangChain.js, Vercel AI SDK, and MCP (language-agnostic). However, the majority of AI agent developers use Python (LangChain: 47M monthly PyPI downloads, CrewAI: Python-native, OpenAI Agents SDK: Python-first).

**Python SDK scope:**
1. Core client: `evaluate()`, `wait_for_approval()`, `record_outcome()` — thin wrapper over the REST API
2. LangChain/LangGraph Python wrapper
3. CrewAI wrapper
4. OpenAI Agents SDK wrapper

**Implementation approach:** The Python SDK is a thin HTTP client — no business logic, just API calls + typed responses. Can be built by a single developer or AI agent in 2-3 weeks. Use Pydantic for type definitions mirroring the TypeScript shared types.

---

## Cross-Cutting Concerns

These constraints apply to ALL code in ALL phases. Include relevant sections as context when delegating tasks to Claude Code.

---

### CC.1 — Dependency Graph & Critical Path

```
Phase 0 ────────────────────────────────────────────────────────────┐
  P0.1 → P0.2 → P0.3 ──┐                                          │
                P0.2 → P0.4                                         │
         P0.1 → P0.5                                                │
         All  → P0.6                                                │
                                                                     │
Phase 1 ────────────────────────────────────────────────────────────┤
  P1.1 (depends P0.2, P0.4)  ──┐                                    │
  P1.2 (depends P0.3)     ─────┼── P1.3 → P1.4 ──┐                 │
                                │                   ├── P1.5         │
                                │                   └── P1.6         │
                                └────────── P1.7 (depends all)       │
                                                                     │
Phase 2 ────────────────────────────────────────────────────────────┤
  ⚡ P2.1a,b,c | P2.2a,b,c | P2.3a,b,c | P2.4 in PARALLEL         │
     (all depend on P1.7)                                            │
  P2.5 (depends on all P2.x subtasks)                               │
                                                                     │
Phase 3 (can start ALONGSIDE Phase 2) ─────────────────────────────┤
  ⚡ P3.1, P3.2, P3.3 in PARALLEL (depend on P1.1/P1.4)            │
  P3.4 (depends on P0.2, P0.4, P2.5)                                │
  P3.5 (depends on P3.1, P3.2)                                      │
  P3.6 (depends on P1.4, P3.4 for user roles)                        │
                                                                     │
Phase 4 ────────────────────────────────────────────────────────────┤
  P4.1 (depends on P3.4)                                             │
  P4.2 (depends on P0.3)                                             │
  ⚡ P4.1, P4.2 in PARALLEL                                         │
  P4.3 (depends P4.1, P4.2) → P4.4                                  │
  ⚡ P4.5 in PARALLEL with P4.3-P4.4 (depends P2.4, P3.3)          │
  P4.6 (depends P4.1-P4.5)                                          │
                                                                     │
Phase 5 ────────────────────────────────────────────────────────────┘
  ⚡ P5.1, P5.2, P5.3, P5.4 in PARALLEL
     P5.3 depends on P3.4 + P4.2
  P5.5 (depends P5.1, P5.2)
  P5.6 (depends all)
```

**Critical path:**
`P0.1 → P0.2 → P0.3 → P1.2 → P1.3 → P1.4 → P1.5 → P1.7 → longest(P2.1a-c, P2.2a-c, P2.3a-c, P2.4) → P2.5 → P3.4 → P4.1 → P4.6 → P5.6`

**Maximum parallelism per phase:**

| Phase | Parallel streams | Notes |
|-------|-----------------|-------|
| Phase 0 | 2: (P0.2→P0.3→P0.4) and (P0.5) | P0.6 waits for both |
| Phase 1 | 2: (P1.1) and (P1.2), then merge at P1.3. (P1.5) and (P1.6) parallel after P1.4 | P1.7 waits for all |
| Phase 2 | 4: P2.1a-c, P2.2a-c, P2.3a-c, P2.4 all parallel | P2.5 waits for all |
| Phase 3 | 4: P3.1, P3.2, P3.3, P3.4 all parallel | P3.5 waits for P3.1+P3.2 |
| Phase 4 | 2: (P4.1, P4.2 parallel → P4.3 → P4.4) and (P4.5) | P4.6 waits for all |
| Phase 5 | 4: P5.1, P5.2, P5.3, P5.4 all parallel | P5.5 waits for P5.1+P5.2 |

---

### CC.2 — Error Handling Conventions

**API error response shape (every error, everywhere):**

```typescript
interface ApiError {
  error: string;           // machine-readable: "not_found", "validation_error"
  message: string;         // human-readable
  status: number;
  details?: Record<string, unknown>;
  trace_id?: string;
  request_id: string;      // unique per request
}
```

**Standard error codes:**

| Error Code | HTTP Status | When Used |
|-----------|-------------|-----------|
| `validation_error` | 400 | Zod validation failure |
| `invalid_lifecycle_transition` | 400 | Invalid agent state change |
| `unauthorized` | 401 | Missing/invalid API key or session |
| `forbidden` | 403 | Valid auth, insufficient role/scope |
| `separation_of_duties_violation` | 403 | Agent owner attempting self-approval |
| `not_found` | 404 | Entity doesn't exist OR belongs to another tenant |
| `conflict` | 409 | Approval already decided, concurrent modification |
| `plan_limit_reached` | 402 | Free tier limit exceeded |
| `rate_limit_exceeded` | 429 | Rate limit hit |
| `internal_error` | 500 | Unexpected server error |

**Rules:**
- Return 404 (not 403) for cross-tenant access — no information leakage
- Always include `request_id`
- Log full error server-side, return sanitized to client
- Validation errors include specific field in `details`

**SDK error classes:**

```typescript
class AgentIdentityError extends Error { code: string; status: number; }
class ActionDeniedError extends AgentIdentityError { reason: string; traceId: string; }
class ApprovalTimeoutError extends AgentIdentityError { approvalRequestId: string; timeoutMs: number; }
class ApprovalExpiredError extends AgentIdentityError { approvalRequestId: string; }
class RateLimitError extends AgentIdentityError { retryAfterSeconds: number; }
class PlanLimitError extends AgentIdentityError { limitName: string; current: number; max: number; }
```

---

### CC.3 — Testing Strategy

**Test pyramid:**

```
                    ┌─────────┐
                    │  E2E    │  2-5 per feature
                   ┌┴─────────┴┐
                   │Integration │  5-15 per service
                  ┌┴───────────┴┐
                  │   Unit       │  10-30 per module
                  └──────────────┘
```

- **Unit tests (Vitest):** co-located as `*.test.ts`. Mock dependencies. Policy engine: 100% branch coverage.
- **Integration tests:** real PostgreSQL, test DB per suite. Located in `__tests__/integration/`.
- **E2E tests:** full Docker Compose stack. Located in `tests/e2e/`.
- **Dashboard:** React Testing Library for interactive components.
- **Test data:** always use factory functions from P0.6. Never raw object literals.
- **Coverage targets:** Policy engine 100%, API services >80%, SDK >80%, Dashboard >60%.

---

### CC.4 — Observability

**Structured JSON logging (pino via Fastify):**

Every log line includes: `level`, `msg`, `request_id`, `tenant_id`.

**What to log:**

| Event | Level |
|-------|-------|
| Request received/completed | `info` |
| Policy evaluated | `info` |
| Approval decided | `info` |
| Webhook delivered | `info` |
| Webhook failed | `warn` |
| Auth failed | `warn` |
| Rate limit hit | `warn` |
| Unhandled error | `error` |
| **NEVER:** API keys, session tokens, passwords, PII | — |

**Request ID:** UUID generated per request, set as `X-Request-ID` response header, propagated to all services and log lines.

**Health checks:**

```typescript
// GET /health — readiness probe (checks DB and dependencies)
{
  status: 'healthy' | 'degraded',
  version: '0.1.0',
  uptime_seconds: 12345,
  checks: {
    database: { status: 'healthy', latency_ms: 2 },
    background_jobs: {
      status: 'healthy',
      last_run_at: '2026-03-20T10:00:00Z',
      jobs: {
        expire_approvals: { last_run_at: '...', status: 'healthy' },
        webhook_delivery: { last_run_at: '...', status: 'healthy' }
      }
    }
  }
}

// GET /health/live — liveness probe (always 200 if process is running)
{ status: 'ok' }
```

---

### CC.5 — Security Hardening

**API:**
- All endpoints require auth except: `GET /health`, `GET /health/live`, `/api/v1/auth/*`, landing page, docs
- CORS: only allow dashboard origin in production (configurable via `ALLOWED_ORIGINS`)
- Helmet headers via Fastify plugin
- Request body size limit: 1MB
- No `eval()`, no `Function()`, no dynamic code execution

**Authentication:**
- API keys: stored as SHA-256 hash, never in plaintext
- Sessions: HttpOnly, Secure (in prod), SameSite=Lax cookies
- OIDC: PKCE required, state parameter validated
- Passwords (email signup): bcrypt with cost factor 12
- Session expiry: 8 hours, absolute

**CSRF protection:**
- All state-changing API endpoints (POST, PATCH, DELETE) validate CSRF token
- Double-submit cookie pattern: API sets `csrf_token` cookie (not HttpOnly, SameSite=Strict)
- Dashboard reads cookie value and sends as `X-CSRF-Token` header
- API validates header matches cookie value

**Authentication rate limiting (implemented in P5.3a alongside email/password auth):** `/api/v1/auth/login`: max 5 failed attempts per IP per 15 minutes. `/api/v1/auth/signup`: max 3 attempts per IP per hour. Implemented via the same rate limiting infrastructure as P4.4 but with IP-based (not tenant-based) keys.

**Data:**
- Tenant isolation via Prisma extension (application layer)
- Audit events are append-only (no UPDATE or DELETE)
- Integrity hashes on audit events (Phase 4+)
- Webhook secrets: hashed after first display

**Input validation:**
- Every endpoint validates with Zod `strict()` mode
- Trim whitespace, enforce max length on strings
- Validate enums against known values

**Dependency security:**
- `npm audit` in CI
- Minimal dependency footprint

---

### CC.6 — Code Style & Conventions

**TypeScript:** strict mode, no `any` in public API, prefer `interface` over `type`, use `unknown` for external data + narrow with Zod.

**Naming:**
- Files: `kebab-case.ts`
- Classes/interfaces: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Database columns: `snake_case`
- API routes: `kebab-case`
- Environment variables: `SCREAMING_SNAKE_CASE`

**File organization:** One exported class per file. Barrel exports at boundaries. Tests co-located.

**API routes:** One file per resource. Route handlers: validate → call service → format response (3 steps max).

**Database:** All queries through Prisma. Transactions for multi-table operations. Forward-only migrations. Idempotent seed script.

**Comments:** Only for non-obvious decisions, regulatory reasons, or external spec links. JSDoc on public SDK surfaces.

---

### CC.7 — Environment Configuration

```typescript
interface Config {
  port: number;                    // default: 4000
  host: string;                    // default: '0.0.0.0'
  environment: 'development' | 'test' | 'production';
  databaseUrl: string;             // required
  sessionSecret: string;           // required, min 32 chars
  sessionTtlSeconds: number;       // default: 28800
  oidcIssuer?: string;             // required in production
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcRedirectUri?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  allowedOrigins: string[];        // default: ['http://localhost:3000']
  rateLimitEnabled: boolean;       // default: true in prod, false in dev
  jobsEnabled: boolean;            // default: true, false in test
  webhookTimeoutMs: number;        // default: 10000
  webhookMaxRetries: number;       // default: 5
  databaseConnectionLimit?: number;    // default: 10 in dev, 20 in production
  databasePoolTimeout?: number;        // default: 10000 (ms)
}
```

Validated with Zod on API boot. Missing required fields: exit with clear error listing every missing field.
