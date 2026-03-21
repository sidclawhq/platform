# P5.1 Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Fumadocs documentation site at `apps/docs/` with 38 MDX content pages covering concepts, SDK reference, integrations, platform guides, enterprise features, compliance mappings, and API reference.

**Architecture:** Next.js 15 app using Fumadocs (fumadocs-core + fumadocs-ui + fumadocs-mdx) for MDX-based documentation. Dark theme matching the "Institutional Calm" aesthetic. Runs on port 3001. No runtime dependencies on other monorepo packages — all SDK/API references are static code examples in MDX.

**Tech Stack:** Next.js 15, React 19, Fumadocs (v15), Tailwind v4, MDX

---

## Task 1: App Scaffolding

Creates the docs app skeleton: package.json, configs, App Router layouts, dynamic page routes, and search API.

**Files:**
- Create: `apps/docs/package.json`
- Create: `apps/docs/tsconfig.json`
- Create: `apps/docs/next.config.ts`
- Create: `apps/docs/source.config.ts`
- Create: `apps/docs/postcss.config.mjs`
- Create: `apps/docs/eslint.config.mjs`
- Create: `apps/docs/.gitignore`
- Create: `apps/docs/src/lib/source.ts`
- Create: `apps/docs/src/app/layout.tsx`
- Create: `apps/docs/src/app/globals.css`
- Create: `apps/docs/src/app/(home)/page.tsx`
- Create: `apps/docs/src/app/(home)/layout.tsx`
- Create: `apps/docs/src/app/docs/layout.tsx`
- Create: `apps/docs/src/app/docs/[[...slug]]/page.tsx`
- Create: `apps/docs/src/app/api/search/route.ts`
- Reference: `apps/dashboard/package.json` (dep versions)
- Reference: `apps/dashboard/tsconfig.json` (tsconfig pattern)
- Reference: `apps/dashboard/postcss.config.mjs` (postcss pattern)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@sidclaw/docs",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test": "echo 'no tests yet'"
  },
  "dependencies": {
    "fumadocs-core": "^15",
    "fumadocs-ui": "^15",
    "fumadocs-mdx": "^15",
    "next": "15.5.14",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@tailwindcss/postcss": "^4",
    "@types/mdx": "^2",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.5.14",
    "tailwindcss": "^4",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Extends base config. Must include `.source/**/*.ts` for fumadocs-mdx generated types.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "noEmit": true,
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "fumadocs-mdx:collections/*": [".source/*"]
    },
    "allowJs": true
  },
  "include": [
    "next-env.d.ts",
    "source.config.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    ".next/types/**/*.ts",
    ".source/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

Must use fumadocs-mdx `createMDX` wrapper.

```ts
import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

const withMDX = createMDX();
export default withMDX(nextConfig);
```

- [ ] **Step 4: Create source.config.ts**

Defines where MDX content lives. Must be at the app root (not in src/).

```ts
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

export default defineConfig();
```

- [ ] **Step 5: Create postcss.config.mjs, eslint.config.mjs, .gitignore**

`postcss.config.mjs` — identical to dashboard:
```js
const config = {
  plugins: ["@tailwindcss/postcss"],
};
export default config;
```

`eslint.config.mjs`:
```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: ["node_modules/**", ".next/**", "out/**", ".source/**"] },
];

export default eslintConfig;
```

`.gitignore`:
```
.next/
.source/
node_modules/
out/
```

- [ ] **Step 6: Create source loader**

`src/lib/source.ts` — **Note:** Import paths and API calls (e.g., `toFumadocsSource()` vs `toRuntime()`, `loader` vs `createMDXSource`) may differ between fumadocs versions. After `npm install`, check the fumadocs docs or generated `.source/index.ts` for the correct API. The pattern below is typical:

```ts
import { docs } from 'fumadocs-mdx:collections';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

- [ ] **Step 7: Create root layout with fonts and RootProvider**

`src/app/layout.tsx` — dark mode always on, Inter + JetBrains Mono fonts:
```tsx
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: { template: '%s | SidClaw Docs', default: 'SidClaw Documentation' },
  description: 'Documentation for SidClaw — governance for AI agents',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Create globals.css with Institutional Calm theme**

`src/app/globals.css` — see Task 2 for full content. Placeholder for now to unblock build.

```css
@import "tailwindcss";
@import "fumadocs-ui/style/ocean.css";

@theme inline {
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), monospace;
}
```

- [ ] **Step 9: Create home page and layout**

`src/app/(home)/layout.tsx`:
```tsx
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      nav={{ title: 'SidClaw' }}
      links={[
        { text: 'Documentation', url: '/docs' },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
```

`src/app/(home)/page.tsx`:
```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center text-center px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">SidClaw</h1>
      <p className="text-fd-muted-foreground text-lg mb-8 max-w-xl">
        Governance for AI agents. Identity, policy, approval, and audit — in one platform.
      </p>
      <div className="flex gap-4">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground"
        >
          Get Started
        </Link>
        <Link
          href="/docs/quickstart"
          className="rounded-md border border-fd-border px-6 py-2.5 text-sm font-medium"
        >
          Quick Start
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Create docs layout and dynamic page**

`src/app/docs/layout.tsx` — **Note:** `source.pageTree` may need to be `source.pageTree` (property) or `source.getPageTree()` (method). Check the fumadocs-core source type after install.

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{ title: 'SidClaw' }}
    >
      {children}
    </DocsLayout>
  );
}
```

`src/app/docs/[[...slug]]/page.tsx` — **Note:** Import paths like `fumadocs-ui/page` may need adjustment (could be `fumadocs-ui/layouts/docs/page` in some versions). Verify after install.

```tsx
import { source } from '@/lib/source';
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
```

- [ ] **Step 11: Create search API route**

`src/app/api/search/route.ts`:
```ts
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source);
```

- [ ] **Step 12: Install dependencies and verify dev server starts**

```bash
cd apps/docs && npm install
npm run dev
# Visit http://localhost:3001 — should show home page
# Visit http://localhost:3001/docs — should show empty docs (no content yet)
```

- [ ] **Step 13: Commit scaffolding**

```bash
git add apps/docs/
git commit -m "feat(docs): scaffold Fumadocs documentation site at apps/docs"
```

---

## Task 2: Theme Configuration

Customize Fumadocs colors to match Institutional Calm. The dashboard's `globals.css` is the reference.

**Files:**
- Modify: `apps/docs/src/app/globals.css`
- Reference: `apps/dashboard/src/app/globals.css` (design tokens)

- [ ] **Step 1: Write complete globals.css**

Fumadocs UI uses `--color-fd-*` CSS variables via Tailwind v4. We override these to match the Institutional Calm palette. The `ocean.css` preset provides a dark base closest to our aesthetic.

```css
@import "tailwindcss";
@import "fumadocs-ui/style/ocean.css";

@theme inline {
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), monospace;

  --color-fd-background: #0A0A0B;
  --color-fd-foreground: #E4E4E7;
  --color-fd-muted: #1A1A1D;
  --color-fd-muted-foreground: #71717A;
  --color-fd-popover: #111113;
  --color-fd-popover-foreground: #E4E4E7;
  --color-fd-card: #111113;
  --color-fd-card-foreground: #E4E4E7;
  --color-fd-border: #2A2A2E;
  --color-fd-primary: #E4E4E7;
  --color-fd-primary-foreground: #0A0A0B;
  --color-fd-secondary: #1A1A1D;
  --color-fd-secondary-foreground: #E4E4E7;
  --color-fd-accent: #1A1A1D;
  --color-fd-accent-foreground: #E4E4E7;
  --color-fd-ring: #3B82F6;
}

@layer base {
  html {
    color-scheme: dark;
  }
  body {
    @apply bg-fd-background text-fd-foreground antialiased;
  }
}
```

**Important:** The exact CSS variable names (`--color-fd-*`) must be validated after install by inspecting `node_modules/fumadocs-ui/dist/`. If they differ (e.g., `--fd-background` without the `color-` prefix), adjust accordingly. The ocean preset file will show the canonical names.

- [ ] **Step 2: Verify dark theme renders correctly**

```bash
cd apps/docs && npm run dev
# Visit http://localhost:3001 — verify:
# - Background is near-black (#0A0A0B)
# - Text is light gray (#E4E4E7)
# - Code blocks use JetBrains Mono
# - Body text uses Inter
# - No light theme flash
```

- [ ] **Step 3: Commit theme**

```bash
git add apps/docs/src/app/globals.css
git commit -m "feat(docs): apply Institutional Calm dark theme"
```

---

## Task 3: Navigation Structure (meta.json files)

Create all sidebar navigation configuration.

**Files:**
- Create: `apps/docs/content/docs/meta.json`
- Create: `apps/docs/content/docs/concepts/meta.json`
- Create: `apps/docs/content/docs/sdk/meta.json`
- Create: `apps/docs/content/docs/integrations/meta.json`
- Create: `apps/docs/content/docs/platform/meta.json`
- Create: `apps/docs/content/docs/enterprise/meta.json`
- Create: `apps/docs/content/docs/compliance/meta.json`
- Create: `apps/docs/content/docs/api-reference/meta.json`

- [ ] **Step 1: Create root meta.json**

`content/docs/meta.json`:
```json
{
  "title": "Documentation",
  "pages": [
    "index",
    "quickstart",
    "---Concepts---",
    "...concepts",
    "---SDK Reference---",
    "...sdk",
    "---Integrations---",
    "...integrations",
    "---Platform---",
    "...platform",
    "---Enterprise---",
    "...enterprise",
    "---Compliance---",
    "...compliance",
    "---API Reference---",
    "...api-reference"
  ]
}
```

- [ ] **Step 2: Create section meta.json files**

`content/docs/concepts/meta.json`:
```json
{ "title": "Concepts", "pages": ["identity", "policy", "approval", "traces"] }
```

`content/docs/sdk/meta.json`:
```json
{ "title": "SDK Reference", "pages": ["installation", "client", "evaluate", "with-governance", "wait-for-approval", "record-outcome", "errors"] }
```

`content/docs/integrations/meta.json`:
```json
{ "title": "Integrations", "pages": ["mcp", "langchain", "openai-agents", "crewai", "vercel-ai"] }
```

`content/docs/platform/meta.json`:
```json
{ "title": "Platform", "pages": ["agents", "policies", "approvals", "audit"] }
```

`content/docs/enterprise/meta.json`:
```json
{ "title": "Enterprise", "pages": ["sso", "rbac", "api-keys", "webhooks", "siem-export"] }
```

`content/docs/compliance/meta.json`:
```json
{ "title": "Compliance", "pages": ["finra-2026", "eu-ai-act", "nist-ai-rmf"] }
```

`content/docs/api-reference/meta.json`:
```json
{ "title": "API Reference", "pages": ["index", "evaluate", "agents", "policies", "approvals", "traces", "webhooks", "auth"] }
```

- [ ] **Step 3: Commit navigation**

```bash
git add apps/docs/content/
git commit -m "feat(docs): add sidebar navigation structure"
```

---

## Task 4: Home + Quickstart Pages

The two most important pages. Quickstart is the #1 priority page.

**Files:**
- Create: `apps/docs/content/docs/index.mdx`
- Create: `apps/docs/content/docs/quickstart.mdx`
- Reference: `research/prompts/P5.1-documentation-site.md:88-160` (quickstart content)
- Reference: `packages/sdk/README.md` (SDK examples)

- [ ] **Step 1: Write index.mdx (home/overview)**

Explains what SidClaw is, the four primitives, why it exists. Keep it concise — link to concept pages for depth.

- [ ] **Step 2: Write quickstart.mdx**

Use the exact content from the P5.1 prompt (lines 88-160) as the starting point. Must be completable in 2 minutes. Five steps: install SDK, get API key, initialize client, wrap tools with `withGovernance()`, see it in action. All code examples must use `@sidclaw/sdk` imports.

- [ ] **Step 3: Verify pages render and sidebar shows them**

```bash
cd apps/docs && npm run dev
# Visit http://localhost:3001/docs — should show overview
# Visit http://localhost:3001/docs/quickstart — should show quickstart
# Sidebar should list both pages
```

- [ ] **Step 4: Commit**

```bash
git add apps/docs/content/docs/index.mdx apps/docs/content/docs/quickstart.mdx
git commit -m "feat(docs): add home and quickstart pages"
```

---

## Task 5: Concepts Pages

Four pages explaining the core primitives: identity, policy, approval, traces.

**Files:**
- Create: `apps/docs/content/docs/concepts/identity.mdx`
- Create: `apps/docs/content/docs/concepts/policy.mdx`
- Create: `apps/docs/content/docs/concepts/approval.mdx`
- Create: `apps/docs/content/docs/concepts/traces.mdx`
- Reference: `research/2026-03-20-product-development-plan.md` (architecture, primitives)
- Reference: `apps/api/src/services/policy-engine.ts` (policy matching logic)
- Reference: `apps/api/src/services/approval-service.ts` (approval flow)
- Reference: `apps/api/src/services/risk-classification.ts` (risk levels)

- [ ] **Step 1: Write concepts/identity.mdx**

Cover: what is agent identity, the Agent model (fields: name, owner, authority_model, identity_mode, delegation_model, autonomy_tier, lifecycle_state, environment), lifecycle states (active/suspended/revoked), authority models (full/delegated/supervised), identity modes, autonomy tiers.

- [ ] **Step 2: Write concepts/policy.mdx**

Cover: how policies work, policy matching (conditions: operation, target_integration, resource_scope, data_classification), effects (allow/approval_required/deny), priority/conflict resolution, risk classification hierarchy (data_classification + operation type → low/medium/high/critical), policy versioning.

- [ ] **Step 3: Write concepts/approval.mdx**

Cover: the approval primitive (SidClaw's differentiator), when approvals are triggered, context-rich approval cards (what the agent wants to do, why it was flagged, risk classification, agent reasoning), separation of duties (agent owners cannot approve their own agent's requests), approval lifecycle (pending → approved/denied/expired), expiry settings.

- [ ] **Step 4: Write concepts/traces.mdx**

Cover: audit traces explained, the event chain (trace_initiated → identity_resolved → policy_evaluated → [approval flow] → outcome), event types (all 16), integrity hashes (tamper-proof hash chain on audit events), trace outcomes (in_progress/executed/blocked/denied/completed_with_approval/expired), parent traces for delegation chains, export formats (JSON single, CSV bulk).

- [ ] **Step 5: Verify and commit**

```bash
cd apps/docs && npm run dev
# Navigate to each concept page, verify render
git add apps/docs/content/docs/concepts/
git commit -m "feat(docs): add concepts pages — identity, policy, approval, traces"
```

---

## Task 6: SDK Reference Pages

Seven pages documenting the SDK's public API with code examples.

**Files:**
- Create: `apps/docs/content/docs/sdk/installation.mdx`
- Create: `apps/docs/content/docs/sdk/client.mdx`
- Create: `apps/docs/content/docs/sdk/evaluate.mdx`
- Create: `apps/docs/content/docs/sdk/with-governance.mdx`
- Create: `apps/docs/content/docs/sdk/wait-for-approval.mdx`
- Create: `apps/docs/content/docs/sdk/record-outcome.mdx`
- Create: `apps/docs/content/docs/sdk/errors.mdx`
- Reference: `packages/sdk/src/client/agent-identity-client.ts` (all client methods)
- Reference: `packages/sdk/src/middleware/governance.ts` (withGovernance)
- Reference: `packages/sdk/src/errors.ts` (error classes)
- Reference: `packages/sdk/README.md` (examples)

- [ ] **Step 1: Write sdk/installation.mdx**

`npm install @sidclaw/sdk`. Requirements (Node.js 18+, TypeScript recommended). Import patterns. Package exports (`@sidclaw/sdk`, `@sidclaw/sdk/langchain`, `@sidclaw/sdk/vercel-ai`, `@sidclaw/sdk/openai-agents`, `@sidclaw/sdk/webhooks`).

- [ ] **Step 2: Write sdk/client.mdx**

`AgentIdentityClient` constructor. `ClientConfig` type: apiKey (required), apiUrl (required), agentId (required), maxRetries (default: 3), retryBaseDelayMs (default: 500). Example initialization.

- [ ] **Step 3: Write sdk/evaluate.mdx**

`client.evaluate(action)`. EvaluateRequest shape: operation, target_integration, resource_scope, data_classification, context?. EvaluateResponse shape: decision, trace_id, approval_request_id?, reason, policy_rule_id, risk_classification?. Full example showing each decision path.

- [ ] **Step 4: Write sdk/with-governance.mdx**

`withGovernance(client, config, fn)`. GovernanceConfig: operation, target_integration, resource_scope, data_classification, context?, approvalOptions?. Shows how it wraps a function, handles all three decision paths automatically. Complete example with email sending function.

- [ ] **Step 5: Write sdk/wait-for-approval.mdx**

`client.waitForApproval(approvalRequestId, options?)`. WaitForApprovalOptions: timeout (default 300000ms), pollInterval (default 2000ms). ApprovalStatusResponse shape. Throws ApprovalTimeoutError on timeout, ApprovalExpiredError if expired server-side. Example polling flow.

- [ ] **Step 6: Write sdk/record-outcome.mdx**

`client.recordOutcome(traceId, outcome)`. RecordOutcomeRequest: status ('success' | 'error'), metadata?. Used after action executes to close the audit trace. Example.

- [ ] **Step 7: Write sdk/errors.mdx**

All 6 error classes: AgentIdentityError (base), ActionDeniedError (properties: reason, traceId, policyRuleId), ApprovalTimeoutError (properties: approvalRequestId, traceId), ApprovalExpiredError (properties: approvalRequestId, traceId), RateLimitError (properties: retryAfter), ApiRequestError (properties: statusCode, body). Example try/catch patterns.

- [ ] **Step 8: Verify and commit**

```bash
cd apps/docs && npm run dev
# Navigate to each SDK page
git add apps/docs/content/docs/sdk/
git commit -m "feat(docs): add SDK reference pages"
```

---

## Task 7: Integration Pages

Five pages for framework integrations with code examples.

**Files:**
- Create: `apps/docs/content/docs/integrations/mcp.mdx`
- Create: `apps/docs/content/docs/integrations/langchain.mdx`
- Create: `apps/docs/content/docs/integrations/openai-agents.mdx`
- Create: `apps/docs/content/docs/integrations/crewai.mdx`
- Create: `apps/docs/content/docs/integrations/vercel-ai.mdx`
- Reference: `packages/sdk/src/mcp/governance-server.ts` (MCP server)
- Reference: `packages/sdk/src/mcp/config.ts` (MCP config types)
- Reference: `packages/sdk/src/middleware/langchain.ts` (governTool/governTools)
- Reference: `packages/sdk/src/middleware/governance.ts` (OpenAI/CrewAI/Vercel wrappers)
- Reference: `packages/sdk/README.md` (integration examples)

- [ ] **Step 1: Write integrations/mcp.mdx**

GovernanceMCPServer setup. Config: client, upstream (transport, command, args), toolMappings (toolName, operation?, target_integration?, data_classification?, skip_governance?). Complete example wrapping a PostgreSQL MCP server. Show how to skip governance for read-only tools.

- [ ] **Step 2: Write integrations/langchain.mdx**

`governTool(tool, config)` and `governTools(tools, config)` from `@sidclaw/sdk/langchain`. Import path: `import { governTools } from '@sidclaw/sdk/langchain'`. GovernedToolConfig shape. Example wrapping LangChain tools. Show that tool names are preserved.

- [ ] **Step 3: Write integrations/openai-agents.mdx**

`governOpenAITool(tool, handler, config)` from `@sidclaw/sdk/openai-agents`. Returns `{ tool, handler }` — tool definition unchanged, handler wrapped. Example.

- [ ] **Step 4: Write integrations/crewai.mdx**

`governCrewAITool(tool, config)` from `@sidclaw/sdk/crewai` (or main `@sidclaw/sdk` entry). Wraps the `func` property. Example.

- [ ] **Step 5: Write integrations/vercel-ai.mdx**

`governVercelTool(toolName, tool, config)` and `governVercelTools(tools, config)` from `@sidclaw/sdk/vercel-ai`. Wraps the `execute` function. Example.

- [ ] **Step 6: Verify and commit**

```bash
git add apps/docs/content/docs/integrations/
git commit -m "feat(docs): add integration pages — MCP, LangChain, OpenAI, CrewAI, Vercel AI"
```

---

## Task 8: Platform Pages

Four pages documenting the dashboard/platform features.

**Files:**
- Create: `apps/docs/content/docs/platform/agents.mdx`
- Create: `apps/docs/content/docs/platform/policies.mdx`
- Create: `apps/docs/content/docs/platform/approvals.mdx`
- Create: `apps/docs/content/docs/platform/audit.mdx`
- Reference: `apps/api/src/routes/agents.ts` (agent CRUD endpoints)
- Reference: `apps/api/src/routes/policies.ts` (policy CRUD endpoints)
- Reference: `apps/api/src/routes/approvals.ts` (approval endpoints)
- Reference: `apps/api/src/routes/traces.ts` (trace endpoints)

- [ ] **Step 1: Write platform/agents.mdx**

Agent registry: creating agents, agent detail view, lifecycle management (active → suspended → revoked, reactivation), agent fields, filtering/searching. Dashboard walkthrough.

- [ ] **Step 2: Write platform/policies.mdx**

Policy management: creating policies, conditions (operation, target_integration, resource_scope, data_classification), effects, priority, versioning, dry-run testing via `POST /api/v1/policies/test`. Dashboard policy editor walkthrough.

- [ ] **Step 3: Write platform/approvals.mdx**

Approval queue: viewing pending approvals, approval detail with context snapshot, risk classification badge, approve/deny flow, separation of duties check, sorting/filtering, stale indicators. Dashboard approval flow walkthrough.

- [ ] **Step 4: Write platform/audit.mdx**

Trace viewer: listing traces with filters (agent, outcome, date range), trace detail with event chain, event expansion, integrity verification, export (JSON single trace, CSV bulk). Dashboard audit walkthrough.

- [ ] **Step 5: Verify and commit**

```bash
git add apps/docs/content/docs/platform/
git commit -m "feat(docs): add platform pages — agents, policies, approvals, audit"
```

---

## Task 9: Enterprise Pages

Five pages covering enterprise features.

**Files:**
- Create: `apps/docs/content/docs/enterprise/sso.mdx`
- Create: `apps/docs/content/docs/enterprise/rbac.mdx`
- Create: `apps/docs/content/docs/enterprise/api-keys.mdx`
- Create: `apps/docs/content/docs/enterprise/webhooks.mdx`
- Create: `apps/docs/content/docs/enterprise/siem-export.mdx`
- Reference: `apps/api/src/middleware/require-role.ts` (RBAC)
- Reference: `apps/api/src/routes/api-keys.ts` (API key management)
- Reference: `apps/api/src/routes/webhooks.ts` (webhook endpoints)
- Reference: `apps/api/src/services/webhook-service.ts` (webhook delivery)
- Reference: `apps/api/src/jobs/audit-batch.ts` (audit export)

- [ ] **Step 1: Write enterprise/sso.mdx**

OIDC SSO setup: supported providers (Okta, Auth0, generic OIDC), configuration settings, tenant settings for SSO. Note: current implementation uses dev bypass auth — SSO is the production replacement.

- [ ] **Step 2: Write enterprise/rbac.mdx**

Roles: admin (full access), reviewer (can approve/deny, view all), viewer (read-only). Permission matrix showing which endpoints each role can access. How roles are assigned.

- [ ] **Step 3: Write enterprise/api-keys.mdx**

API key management: creating keys (name, scopes, expiry), available scopes (`evaluate`, `traces:read`, `traces:write`, `agents:read`, `approvals:read`, `admin`), rotation best practices, key prefix format (`ai_...`). Dashboard Settings → API Keys walkthrough.

- [ ] **Step 4: Write enterprise/webhooks.mdx**

Webhook setup: creating endpoints (URL, event types), event types (`approval.requested`, `approval.approved`, `approval.denied`, `trace.completed`), signature verification using `verifyWebhookSignature()` from SDK, delivery history, retry behavior, test endpoint. Show SDK verification example.

- [ ] **Step 5: Write enterprise/siem-export.mdx**

Audit export: single trace JSON export, bulk CSV export (`GET /api/v1/traces/export`), SIEM-ready audit event export (`GET /api/v1/audit/export`), continuous export via webhooks (subscribe to `trace.completed` events), data format and fields. Integration with Splunk/Datadog/ELK.

- [ ] **Step 6: Verify and commit**

```bash
git add apps/docs/content/docs/enterprise/
git commit -m "feat(docs): add enterprise pages — SSO, RBAC, API keys, webhooks, SIEM export"
```

---

## Task 10: Compliance Mapping Pages

Three pages critical for enterprise GTM. Map regulatory requirements to product capabilities.

**Files:**
- Create: `apps/docs/content/docs/compliance/finra-2026.mdx`
- Create: `apps/docs/content/docs/compliance/eu-ai-act.mdx`
- Create: `apps/docs/content/docs/compliance/nist-ai-rmf.mdx`
- Reference: `research/prompts/P5.1-documentation-site.md:166-208` (FINRA mapping draft)
- Reference: `research/2026-03-20-market-viability-assessment.md` (regulatory details)

- [ ] **Step 1: Write compliance/finra-2026.mdx**

Use the content from P5.1 prompt lines 166-208 as the base. Three sections: Pre-Approval of AI Use Cases (→ Agent Registry + Policy Rules + Audit Trail), Human-in-the-Loop Validation (→ Approval Primitive + Context Cards + Separation of Duties), Audit Trails (→ Correlated Traces + Integrity Hashes + SIEM Export + Trace Verification).

- [ ] **Step 2: Write compliance/eu-ai-act.mdx**

Map EU AI Act articles to product capabilities:
- Article 9 (Risk Management) → Policy engine risk classification, agent authority models
- Article 12 (Record-Keeping) → Audit traces, automatic logging, 6+ month retention via trace retention jobs
- Article 13 (Transparency) → Trace viewer, integrity hashes, export capabilities
- Article 14 (Human Oversight) → Approval primitive, human-in-the-loop workflows, dashboard

- [ ] **Step 3: Write compliance/nist-ai-rmf.mdx**

Map NIST AI Risk Management Framework categories to product capabilities:
- Govern → Agent registry with identity and authority models, RBAC
- Map → Policy engine with data classification and risk assessment
- Measure → Audit traces with integrity verification, risk classification
- Manage → Approval workflows, lifecycle management, webhook notifications

- [ ] **Step 4: Verify and commit**

```bash
git add apps/docs/content/docs/compliance/
git commit -m "feat(docs): add compliance mapping pages — FINRA 2026, EU AI Act, NIST AI RMF"
```

---

## Task 11: API Reference Pages

Eight pages documenting all API endpoints. For each endpoint: method, path, auth required, request schema, response schema, example curl, error codes.

**Files:**
- Create: `apps/docs/content/docs/api-reference/index.mdx`
- Create: `apps/docs/content/docs/api-reference/evaluate.mdx`
- Create: `apps/docs/content/docs/api-reference/agents.mdx`
- Create: `apps/docs/content/docs/api-reference/policies.mdx`
- Create: `apps/docs/content/docs/api-reference/approvals.mdx`
- Create: `apps/docs/content/docs/api-reference/traces.mdx`
- Create: `apps/docs/content/docs/api-reference/webhooks.mdx`
- Create: `apps/docs/content/docs/api-reference/auth.mdx`
- Reference: All files in `apps/api/src/routes/` (endpoint implementations)

- [ ] **Step 1: Write api-reference/index.mdx**

Overview: base URL (`https://api.sidclaw.com/api/v1` or `http://localhost:4000/api/v1`), authentication (API key via `Authorization: Bearer <key>` header), response format (JSON, `{ data: ... }` for success, `{ error, message, status, details?, trace_id?, request_id }` for errors), pagination pattern (limit/offset query params, `{ data: [...], pagination: { total, limit, offset } }`), rate limiting, versioning.

- [ ] **Step 2: Write api-reference/evaluate.mdx**

`POST /api/v1/evaluate` — the core endpoint. Request: `{ agent_id, operation, target_integration, resource_scope, data_classification, context? }`. Response: `{ decision, trace_id, approval_request_id?, reason, policy_rule_id, risk_classification? }`. Auth: API key with `evaluate` scope. Example curl + SDK equivalent.

- [ ] **Step 3: Write api-reference/agents.mdx**

All agent endpoints: POST (create), GET (list with filters), GET /:id (detail with stats), PATCH /:id (update), POST /:id/suspend, POST /:id/revoke, POST /:id/reactivate. Auth: admin for mutations, any role for reads. Example curls.

- [ ] **Step 4: Write api-reference/policies.mdx**

All policy endpoints: POST (create), GET (list with filters), GET /:id (detail), PATCH /:id (update), DELETE /:id (soft-delete/deactivate), GET /:id/versions (version history), POST /test (dry-run). Auth: admin for mutations. Example curls.

- [ ] **Step 5: Write api-reference/approvals.mdx**

All approval endpoints: GET /:id/status (lightweight poll), GET /count (pending count), GET (list with filters), GET /:id (detail with context), POST /:id/approve (approve), POST /:id/deny (deny). Auth: reviewer/admin for approve/deny. Example curls.

- [ ] **Step 6: Write api-reference/traces.mdx**

All trace endpoints: POST /:traceId/outcome (record outcome), GET (list with filters), GET /:id (detail with events), GET /:traceId/verify (integrity verification), GET /:traceId/export (single JSON export), GET /export (bulk CSV export), GET /api/v1/audit/export (SIEM export). Auth: reviewer/admin for exports. Example curls.

- [ ] **Step 7: Write api-reference/webhooks.mdx**

All webhook endpoints: POST (create), GET (list), GET /:id (detail), PATCH /:id (update), DELETE /:id (delete), GET /:id/deliveries (delivery history), POST /:id/test (send test event). Auth: admin. Valid event types: approval.requested, approval.approved, approval.denied, trace.completed. Example curls.

- [ ] **Step 8: Write api-reference/auth.mdx**

Authentication: API key-based auth via `Authorization: Bearer <key>` header. How to create API keys (via dashboard or API). Scopes and their permissions. Development bypass (`X-Dev-Bypass: true` header when `NODE_ENV=development`). Rate limiting (per-key). Session auth for dashboard users (OIDC SSO).

- [ ] **Step 9: Verify and commit**

```bash
git add apps/docs/content/docs/api-reference/
git commit -m "feat(docs): add API reference pages"
```

---

## Task 12: Final Verification

End-to-end verification of the complete documentation site.

**Files:**
- None (verification only)

- [ ] **Step 1: Full build**

```bash
# From monorepo root
turbo build --filter=@sidclaw/docs
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Verify all pages render**

```bash
cd apps/docs && npm run dev
```

Visit every page and verify no 404s or render errors:
- `/` (home)
- `/docs` (overview)
- `/docs/quickstart`
- `/docs/concepts/identity`, `/docs/concepts/policy`, `/docs/concepts/approval`, `/docs/concepts/traces`
- `/docs/sdk/installation`, `/docs/sdk/client`, `/docs/sdk/evaluate`, `/docs/sdk/with-governance`, `/docs/sdk/wait-for-approval`, `/docs/sdk/record-outcome`, `/docs/sdk/errors`
- `/docs/integrations/mcp`, `/docs/integrations/langchain`, `/docs/integrations/openai-agents`, `/docs/integrations/crewai`, `/docs/integrations/vercel-ai`
- `/docs/platform/agents`, `/docs/platform/policies`, `/docs/platform/approvals`, `/docs/platform/audit`
- `/docs/enterprise/sso`, `/docs/enterprise/rbac`, `/docs/enterprise/api-keys`, `/docs/enterprise/webhooks`, `/docs/enterprise/siem-export`
- `/docs/compliance/finra-2026`, `/docs/compliance/eu-ai-act`, `/docs/compliance/nist-ai-rmf`
- `/docs/api-reference`, `/docs/api-reference/evaluate`, `/docs/api-reference/agents`, `/docs/api-reference/policies`, `/docs/api-reference/approvals`, `/docs/api-reference/traces`, `/docs/api-reference/webhooks`, `/docs/api-reference/auth`

- [ ] **Step 3: Verify search works**

Type search terms in the search bar: "evaluate", "approval", "FINRA", "LangChain". Results should appear from relevant pages.

- [ ] **Step 4: Verify sidebar navigation**

All sections and pages should appear in correct order in the sidebar. Sections should be collapsible. Active page should be highlighted.

- [ ] **Step 5: Content checklist**

- All code examples use `@sidclaw/sdk` imports
- All code examples are valid TypeScript
- Dashboard links point to `app.sidclaw.com` or `localhost:3000`
- API links point to `api.sidclaw.com` or `localhost:4000`
- No broken internal links between docs pages
- 38 content MDX files + 8 meta.json files present

- [ ] **Step 6: TypeScript check**

```bash
cd apps/docs && npm run typecheck
```

- [ ] **Step 7: Final commit**

```bash
git add -A apps/docs/
git commit -m "feat(docs): complete P5.1 documentation site — 38 pages across 8 sections"
```

---

## File Manifest (60 files total)

### Config files (11)
```
apps/docs/package.json
apps/docs/tsconfig.json
apps/docs/next.config.ts
apps/docs/source.config.ts
apps/docs/postcss.config.mjs
apps/docs/eslint.config.mjs
apps/docs/.gitignore
apps/docs/src/lib/source.ts
apps/docs/src/app/layout.tsx
apps/docs/src/app/globals.css
apps/docs/src/app/api/search/route.ts
```

### Route/layout files (4)
```
apps/docs/src/app/(home)/page.tsx
apps/docs/src/app/(home)/layout.tsx
apps/docs/src/app/docs/layout.tsx
apps/docs/src/app/docs/[[...slug]]/page.tsx
```

### Meta.json files (8)
```
apps/docs/content/docs/meta.json
apps/docs/content/docs/concepts/meta.json
apps/docs/content/docs/sdk/meta.json
apps/docs/content/docs/integrations/meta.json
apps/docs/content/docs/platform/meta.json
apps/docs/content/docs/enterprise/meta.json
apps/docs/content/docs/compliance/meta.json
apps/docs/content/docs/api-reference/meta.json
```

### Content MDX files (38)
```
apps/docs/content/docs/index.mdx
apps/docs/content/docs/quickstart.mdx
apps/docs/content/docs/concepts/{identity,policy,approval,traces}.mdx
apps/docs/content/docs/sdk/{installation,client,evaluate,with-governance,wait-for-approval,record-outcome,errors}.mdx
apps/docs/content/docs/integrations/{mcp,langchain,openai-agents,crewai,vercel-ai}.mdx
apps/docs/content/docs/platform/{agents,policies,approvals,audit}.mdx
apps/docs/content/docs/enterprise/{sso,rbac,api-keys,webhooks,siem-export}.mdx
apps/docs/content/docs/compliance/{finra-2026,eu-ai-act,nist-ai-rmf}.mdx
apps/docs/content/docs/api-reference/{index,evaluate,agents,policies,approvals,traces,webhooks,auth}.mdx
```

## Parallelization Strategy

After Task 1-3 (scaffolding, theme, navigation) are complete sequentially:

Tasks 4-11 (all content sections) can be written **in parallel** by separate agents — they are independent MDX files with no cross-dependencies. Recommended grouping:

| Agent | Tasks | Files |
|-------|-------|-------|
| Agent 1 | Task 4 + 5 | Home, Quickstart, 4 Concepts pages |
| Agent 2 | Task 6 | 7 SDK reference pages |
| Agent 3 | Task 7 + 8 | 5 Integration + 4 Platform pages |
| Agent 4 | Task 9 + 10 | 5 Enterprise + 3 Compliance pages |
| Agent 5 | Task 11 | 8 API Reference pages |

Task 12 (verification) runs after all content is merged.
