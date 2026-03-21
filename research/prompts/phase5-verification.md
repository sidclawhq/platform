# Phase 5 Verification — Launch Readiness QA Test

You are a QA tester. Your job is to verify that the Agent Identity & Approval Layer platform (brand: **SidClaw**) is launch-ready after Phase 5 completion. Do NOT write any code or modify any files. Only test and report.

## Context

Read these files first:
1. `research/2026-03-20-product-development-plan.md` — Overview, Phase 5 sections
2. `research/2026-03-21-phase4-verification-report.md` — previous test report
3. `packages/sdk/README.md` — SDK documentation
4. `packages/sdk/package.json` — SDK package config

Phase 5 introduced:
- P5.1: Documentation site (Fumadocs, MDX, dark theme)
- P5.2: Example applications (MCP postgres, LangChain, Vercel AI)
- P5.3: Self-serve signup (GitHub OAuth, Google OIDC, email/password, onboarding, plan limits)
- P5.4: Landing page (marketing, pricing, comparison)
- P5.5: npm publish tooling (GitHub workflows, templates, badges)
- P5.6: Deployment config (Dockerfiles, production docker-compose, env documentation)

## Prerequisites

1. Start the database: `docker compose up db -d`
2. Run migrations: `cd apps/api && npx prisma migrate deploy`
3. Seed the database: `cd apps/api && npx prisma db seed`
4. Start the API: `cd apps/api && npm run dev` (port 4000)
5. Start the dashboard: `cd apps/dashboard && npm run dev` (port 3000)
6. Start the docs: `cd apps/docs && npm run dev` (port 3001)
7. Start the landing page: `cd apps/landing && npm run dev` (port 3002)

Wait for each service to be ready.

---

## Test 1: Demo Script Regression

Run: `SIDCLAW_API_KEY=<key> npx tsx scripts/demo.ts`

Verify all 3 scenarios produce correct decisions. This is the ultimate regression test — if the demo works, the core platform works.

---

## Test 2: Documentation Site

Open `http://localhost:3001` in Playwright.

### 2a: Structure & Navigation
- Home page loads with dark theme
- Sidebar navigation shows all sections: Quick Start, Concepts, SDK, Integrations, Platform, Enterprise, Compliance, API Reference
- Click through each top-level section — verify pages render without errors

### 2b: Quick Start Page
Navigate to the Quick Start page. Verify:
- 5 steps are present: Install, Get API Key, Initialize Client, Wrap Tools, See It In Action
- Code blocks show `@sidclaw/sdk` (NOT `@agent-identity/sdk`)
- Code blocks have syntax highlighting
- "Next steps" links work

### 2c: SDK Reference Pages
Check at least 3 SDK pages:
- `sdk/client.mdx` or `sdk/evaluate.mdx` — has code examples
- `sdk/errors.mdx` — lists error types
- `sdk/with-governance.mdx` — shows wrapper usage

### 2d: Integration Pages
Check at least 2 integration pages:
- `integrations/mcp.mdx` — MCP governance server setup
- `integrations/langchain.mdx` — governTool/governTools usage

### 2e: Compliance Mapping Pages
These are critical for enterprise GTM. Verify ALL THREE exist:
- `compliance/finra-2026.mdx` — FINRA requirements mapped to product capabilities
- `compliance/eu-ai-act.mdx` — EU AI Act articles mapped
- `compliance/nist-ai-rmf.mdx` — NIST framework mapped

Each should have: regulatory requirement, then "SidClaw provides:" with specific feature references.

### 2f: Search
Use the docs search:
- Type "approval" — results should include multiple pages
- Type "MCP" — should find the MCP integration page
- Type "FINRA" — should find the compliance page

### 2g: Design
- Dark mode consistent with dashboard aesthetic
- Code blocks readable with dark background
- Mobile-responsive (resize browser to 375px width)

Take screenshots of: home page, quickstart, a compliance page, search results.

---

## Test 3: Example Applications

### 3a: MCP Postgres Example
```bash
cd examples/mcp-postgres-governed
cat README.md  # Verify README is complete and clear
cat package.json  # Verify uses @sidclaw/sdk
cat seed.ts  # Verify creates agent + 3 policies
```

Verify:
- README has setup instructions, "What This Demonstrates" section, architecture diagram
- `package.json` uses `@sidclaw/sdk` (not `@agent-identity/sdk`)
- `seed.ts` creates: agent, allow policy, approval_required policy, deny policy
- `index.ts` creates GovernanceMCPServer with tool mappings

**If docker-compose.yml exists:** Try starting the example database:
```bash
docker compose up -d
```

**Run the seed script** (if API is running):
```bash
SIDCLAW_API_KEY=<key> npx tsx seed.ts
```
Verify: agent and policies created successfully.

### 3b: LangChain Example
```bash
cd examples/langchain-customer-support
cat README.md
cat package.json  # Uses @sidclaw/sdk
cat tools.ts  # 3 tool definitions
cat index.ts  # Uses governTools()
```

### 3c: Vercel AI Example
```bash
cd examples/vercel-ai-assistant
cat README.md
cat package.json  # Uses @sidclaw/sdk
```

Verify each example:
- [ ] Has complete README with prerequisites and setup steps
- [ ] Uses `@sidclaw/sdk` in imports and package.json
- [ ] Has seed.ts for creating agent and policies
- [ ] Demonstrates at least 2 policy effects

---

## Test 4: Self-Serve Signup

### 4a: Signup Page
Open `http://localhost:3000/signup` in Playwright:
- Page renders with dark "Institutional Calm" theme
- Shows: "Sign up with GitHub", "Sign up with Google", email/password form
- "Already have an account? Sign in" link present
- Take a screenshot

### 4b: Email/Password Signup
Fill in the signup form:
- Name: "Test Signup User"
- Email: "test-signup@example.com"
- Password: "TestPassword123"
- Click "Create Account"

Expected behavior:
- If signup endpoint works: redirected to dashboard with onboarding
- If signup fails (duplicate email, etc.): error message shown

### 4c: Onboarding Flow
After successful signup (or if you can trigger onboarding via URL param):
- API key dialog should appear showing the raw key with "Copy this key" warning
- Onboarding checklist bar at top of dashboard with 5 steps
- Steps link to relevant pages (Agents, Policies, etc.)
- "Dismiss" button hides the checklist
- Take a screenshot of the onboarding checklist

### 4d: Plan Limits
Test free plan limits via API:
```bash
# Create 5 agents (free limit), then try to create 6th:
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:4000/api/v1/agents \
    -H "Authorization: Bearer <key>" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Limit Test $i\",\"description\":\"test\",\"owner_name\":\"test\",\"owner_role\":\"test\",\"team\":\"test\",\"authority_model\":\"self\",\"identity_mode\":\"service_identity\",\"delegation_model\":\"self\",\"created_by\":\"test\"}"
  echo ""
done
# First 5 should return 201, 6th should return 402
```

**Note:** This test depends on the tenant's plan being 'free'. The seed data creates an enterprise tenant. You may need to create a new free-plan tenant via signup first, or temporarily update the seed tenant's plan.

### 4e: Login Page
Open `http://localhost:3000/login`:
- Shows GitHub and Google OAuth buttons
- Shows "Don't have an account? Sign up" link
- If `?expired=true` in URL: shows "Session expired" message in amber
- Take a screenshot

---

## Test 5: Landing Page

Open `http://localhost:3002` in Playwright.

### 5a: All 9 Sections Present
Scroll through the entire page and verify:
1. **Hero**: headline, subheadline, CTA buttons, npm install command
2. **Problem**: 3 stats with numbers (73%, 79%, 37%) and source citations
3. **Four Primitives**: Identity → Policy → Approval → Trace cards
4. **Approval Demo**: screenshot or mock of approval detail panel
5. **Comparison**: table showing SidClaw vs Traditional IAM
6. **Use Cases**: Finance, Healthcare, Platform Teams
7. **Pricing**: Free / Team / Enterprise tiers
8. **Open Source**: Apache 2.0 message
9. **CTA Footer**: final call-to-action

### 5b: Links
- "Get Started Free" → links to signup (verify URL)
- "View on GitHub" → links to `https://github.com/sidclawhq/sdk`
- npm install command has copy button (or is selectable)
- Navigation header: Docs, GitHub, Pricing links work

### 5c: Pricing Accuracy
Verify the Free tier matches actual limits:
- 5 agents
- 10 policies per agent
- 2 API keys
- 7-day trace retention

### 5d: Design
- Dark background (#0A0A0B)
- No gradients, no AI sparkle icons, no decorative blobs
- Inter font for body, JetBrains Mono for code
- Responsive: resize to 375px width — still readable

### 5e: Performance
Note the page load time. Should feel fast (<2s).

### 5f: Source Citations
The Problem section stats must cite sources:
- 73% CISOs — should reference NeuralTrust or PR Newswire
- 79% blind spots — should reference NeuralTrust
- 37% incidents — should reference NeuralTrust

Take screenshots of: full hero, problem section, pricing, comparison table.

---

## Test 6: SDK Package

### 6a: Build
```bash
cd packages/sdk
npm run build
```
Verify build succeeds without errors.

### 6b: Bundle Contents
```bash
npm pack --dry-run 2>&1
```
Verify the tarball contains ONLY:
- `package.json`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`
- `dist/**`

No source files (`.ts`), no test files, no internal config.

### 6c: Bundle Size
```bash
du -sh dist/
```
Should be <200KB total.

### 6d: Imports
```bash
# CJS
node -e "const { AgentIdentityClient } = require('./packages/sdk/dist/index.cjs'); console.log('Main:', typeof AgentIdentityClient);"
node -e "const { verifyWebhookSignature } = require('./packages/sdk/dist/webhooks/index.cjs'); console.log('Webhooks:', typeof verifyWebhookSignature);"
node -e "const { GovernanceMCPServer } = require('./packages/sdk/dist/mcp/index.cjs'); console.log('MCP:', typeof GovernanceMCPServer);"

# ESM
node --input-type=module -e "import { AgentIdentityClient } from './packages/sdk/dist/index.js'; console.log('ESM:', typeof AgentIdentityClient);"
```
All should print `function`.

### 6e: Package Metadata
```bash
node -e "const pkg = require('./packages/sdk/package.json'); console.log('Name:', pkg.name); console.log('Version:', pkg.version); console.log('License:', pkg.license);"
```
- Name: `@sidclaw/sdk`
- Version: `0.1.0`
- License: `Apache-2.0`

### 6f: README
Verify `packages/sdk/README.md`:
- Has badges (npm version, license, CI)
- Uses `@sidclaw/sdk` in all examples (NOT `@agent-identity/sdk`)
- Has Quick Start section
- Has sections for MCP, LangChain, Vercel AI, Webhooks
- Links point to `sidclaw.com` or `github.com/sidclawhq`

### 6g: Security Check
```bash
# No secrets or internal URLs in dist
grep -r "localhost" packages/sdk/dist/ && echo "WARNING: localhost found in dist" || echo "OK: no localhost"
grep -r "password" packages/sdk/dist/ && echo "WARNING: password found in dist" || echo "OK: no password"
grep -r "api_key" packages/sdk/dist/ && echo "WARNING: api_key found in dist" || echo "OK: no api_key"

# npm audit
cd packages/sdk && npm audit
```

---

## Test 7: GitHub Repository Files

Verify these files exist at the project root:

```bash
test -f CONTRIBUTING.md && echo "CONTRIBUTING.md exists" || echo "MISSING"
test -f CODE_OF_CONDUCT.md && echo "CODE_OF_CONDUCT.md exists" || echo "MISSING"
test -f .github/ISSUE_TEMPLATE/bug_report.md && echo "Bug template exists" || echo "MISSING"
test -f .github/ISSUE_TEMPLATE/feature_request.md && echo "Feature template exists" || echo "MISSING"
test -f .github/PULL_REQUEST_TEMPLATE.md && echo "PR template exists" || echo "MISSING"
test -f .github/workflows/release.yml && echo "Release workflow exists" || echo "MISSING"
```

Check `.github/workflows/release.yml`:
- Triggered on tag push `v*.*.*`
- Steps: checkout → setup node → install → test → build → publish to npm → create GitHub Release
- Uses `NPM_TOKEN` secret

---

## Test 8: Deployment Configuration

### 8a: Dockerfiles Exist
```bash
test -f apps/api/Dockerfile && echo "API Dockerfile exists" || echo "MISSING"
test -f apps/dashboard/Dockerfile && echo "Dashboard Dockerfile exists" || echo "MISSING"
test -f apps/docs/Dockerfile && echo "Docs Dockerfile exists" || echo "MISSING"
test -f apps/landing/Dockerfile && echo "Landing Dockerfile exists" || echo "MISSING"
test -f docker-compose.production.yml && echo "Production compose exists" || echo "MISSING"
```

### 8b: Environment Documentation
```bash
test -f deployment/env.example && echo "env.example exists" || echo "MISSING"
```

Verify `deployment/env.example` documents:
- Database config (DB_NAME, DB_USER, DB_PASSWORD)
- Session secret
- OIDC config
- GitHub/Google OAuth config
- Email config
- URLs (API, Dashboard)
- Rate limiting toggle
- Ports

### 8c: API Dockerfile Build (Optional — May Take Time)
```bash
docker build -t sidclaw-api -f apps/api/Dockerfile .
```
If this succeeds, verify:
- Image is <500MB
- Multi-stage build (no dev dependencies in final image)

### 8d: Health Probes
```bash
# Readiness probe (already tested in previous phases)
curl http://localhost:4000/health
# Should include database check

# Liveness probe (new in P5.6)
curl http://localhost:4000/health/live
# Should return { status: "alive" } without database check
```

### 8e: Next.js Standalone
Verify `apps/dashboard/next.config.ts` has `output: 'standalone'`:
```bash
grep -n "standalone" apps/dashboard/next.config.ts
```

---

## Test 9: Cross-Reference Check — @sidclaw Rename

Verify the rename from `@agent-identity` to `@sidclaw` is complete:

```bash
# Search for any remaining @agent-identity references
grep -r "@agent-identity" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.mdx" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=v0-prototype . 2>/dev/null | head -20

# Expected: zero results (except possibly in v0-prototype which is excluded)
```

If any results found, list them in the report.

---

## Test 10: Phase 1-4 Full Regression

Quick pass/fail for every major feature:

| # | Feature | Check |
|---|---------|-------|
| 1 | Agent Registry | `GET /agents` returns agents |
| 2 | Agent Detail | `GET /agents/:id` returns stats + integrations |
| 3 | Agent Lifecycle | Suspend/reactivate via API |
| 4 | Policy CRUD | Create, list, update, soft-delete |
| 5 | Policy Test | Dry-run evaluation |
| 6 | Policy Versions | Version history after update |
| 7 | Evaluate (allow) | Returns `decision: allow` |
| 8 | Evaluate (approval) | Returns `decision: approval_required` |
| 9 | Evaluate (deny) | Returns `decision: deny` |
| 10 | Approve from API | Status changes to approved |
| 11 | Deny from API | Status changes to denied, trace finalized |
| 12 | Separation of duties | Owner self-approve returns 403 |
| 13 | Trace list + detail | Events in correct order |
| 14 | Trace export (JSON) | Downloads valid JSON |
| 15 | Trace export (CSV) | Downloads valid CSV |
| 16 | Integrity verify | Returns verified: true |
| 17 | RBAC | Viewer gets 403 on write endpoints |
| 18 | Tenant isolation | Cross-tenant returns 404 |
| 19 | API key scopes | Insufficient scope returns 403 |
| 20 | Rate limiting | 429 after exceeding limit |
| 21 | Webhooks | Create endpoint, dispatch event |
| 22 | Overview dashboard | Stats, pending, recent traces |
| 23 | Global search | Returns grouped results |
| 24 | Architecture page | Renders diagram |
| 25 | Settings pages | All 6 sub-pages load |

---

## Test 11: All Tests Pass

```bash
turbo test
```

Report total pass/fail counts per package. Compare to Phase 4 (571 tests).

---

## Deliverable

Write a test report to `research/2026-03-21-phase5-verification-report.md` with:

1. **Summary table**: Pass/fail for each of the 11 tests
2. **Screenshots** saved to `research/screenshots/phase5/`:
   - Docs home page
   - Docs quickstart page
   - Docs compliance page (FINRA)
   - Landing page hero
   - Landing page pricing
   - Landing page comparison table
   - Signup page
   - Onboarding checklist (if visible)
   - Login page
3. **Bugs found**: severity, location, description, impact
4. **Regression check**: did any Phase 1-4 functionality break?
5. **Launch readiness assessment**:
   - Is the documentation complete enough for a developer to self-serve?
   - Is the landing page compelling? Does it communicate the value proposition?
   - Is the SDK package clean and publishable?
   - Are the example apps runnable and clear?
   - What are the top 3 things to fix before going live?
6. **@sidclaw rename verification**: any remaining `@agent-identity` references?
7. **Overall verdict**: Ready to deploy? Ready to publish to npm? Ready for design partner outreach?
