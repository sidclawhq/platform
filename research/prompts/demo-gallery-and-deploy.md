# Task: Demo Gallery Section + Deploy All 3 Demos

## Part A: Add Demo Gallery to Landing Page

### Context

Read these files:
1. `apps/landing/src/app/page.tsx` — current landing page with 9 sections.
2. `apps/landing/src/components/` — existing landing page components.
3. `apps/dashboard/src/app/globals.css` — design tokens.

### What To Do

Add a new section to the landing page between the **Use Cases** and **Pricing** sections. This section showcases the 3 interactive demos.

#### Create `apps/landing/src/components/DemoGallery.tsx`

```tsx
const DEMOS = [
  {
    icon: '💬',
    industry: 'Financial Services',
    title: 'Atlas Financial',
    description: 'AI customer support agent sends emails, looks up accounts, and handles sensitive data. See FINRA-compliant approval workflows in action.',
    highlight: 'FINRA 2026 compliant',
    features: ['Chat with AI agent', 'Email approval flow', 'PII export blocked'],
    url: 'https://demo.sidclaw.com',
    color: 'amber',  // accent color for this card
  },
  {
    icon: '📊',
    industry: 'DevOps & Platform',
    title: 'Nexus Labs',
    description: 'AI ops agent monitors infrastructure, scales services, and deploys to production. See how governance prevents destructive actions.',
    highlight: 'Deploy safety controls',
    features: ['Live service monitoring', 'Production deploy approval', 'Namespace deletion blocked'],
    url: 'https://demo-devops.sidclaw.com',
    color: 'blue',
  },
  {
    icon: '🏥',
    industry: 'Healthcare',
    title: 'MedAssist Health',
    description: 'AI clinical assistant reviews patient charts and recommends treatments. See HIPAA-compliant controls that keep physicians in the loop.',
    highlight: 'HIPAA compliant',
    features: ['Patient chart review', 'Lab order approval', 'Prescriptions blocked for AI'],
    url: 'https://demo-health.sidclaw.com',
    color: 'green',
  },
];
```

**Design:**

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  See it in action                                                │
│  text-3xl font-semibold text-primary text-center                │
│                                                                  │
│  Pick a scenario. Each demo uses real SidClaw governance —       │
│  only the business data is simulated.                            │
│  text-base text-secondary text-center max-w-2xl mx-auto         │
│                                                                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │                  │ │                  │ │                  │ │
│  │  💬              │ │  📊              │ │  🏥              │ │
│  │  text-3xl        │ │                  │ │                  │ │
│  │                  │ │                  │ │                  │ │
│  │  FINANCIAL       │ │  DEVOPS          │ │  HEALTHCARE      │ │
│  │  SERVICES        │ │  & PLATFORM      │ │                  │ │
│  │  text-xs upper   │ │                  │ │                  │ │
│  │  tracking-wider  │ │                  │ │                  │ │
│  │  text-accent-*   │ │                  │ │                  │ │
│  │                  │ │                  │ │                  │ │
│  │  Atlas Financial │ │  Nexus Labs      │ │  MedAssist       │ │
│  │  text-base       │ │                  │ │  Health          │ │
│  │  font-medium     │ │                  │ │                  │ │
│  │                  │ │                  │ │                  │ │
│  │  AI customer     │ │  AI ops agent    │ │  AI clinical     │ │
│  │  support agent...│ │  monitors infra..│ │  assistant...    │ │
│  │  text-sm         │ │                  │ │                  │ │
│  │  text-secondary  │ │                  │ │                  │ │
│  │                  │ │                  │ │                  │ │
│  │  ✓ Chat with AI  │ │  ✓ Live monitor  │ │  ✓ Patient chart │ │
│  │  ✓ Email approval│ │  ✓ Deploy approve│ │  ✓ Lab order     │ │
│  │  ✓ PII blocked   │ │  ✓ Delete blocked│ │  ✓ Rx blocked    │ │
│  │  text-xs         │ │                  │ │                  │ │
│  │  text-muted      │ │                  │ │                  │ │
│  │                  │ │                  │ │                  │ │
│  │  ┌────────────┐  │ │  ┌────────────┐  │ │  ┌────────────┐  │ │
│  │  │ Try Demo → │  │ │  │ Try Demo → │  │ │  │ Try Demo → │  │ │
│  │  └────────────┘  │ │  └────────────┘  │ │  └────────────┘  │ │
│  │                  │ │                  │ │                  │ │
│  │  FINRA 2026      │ │  Deploy safety   │ │  HIPAA           │ │
│  │  compliant       │ │  controls        │ │  compliant       │ │
│  │  text-xs pill    │ │                  │ │                  │ │
│  │                  │ │                  │ │                  │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                  │
│  2 minutes · No signup required · Real governance                │
│  text-sm text-muted text-center                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Card design:**
- `bg-surface-1 border-default rounded-lg p-6`
- Hover: `border-accent-{color}/50` (amber for finance, blue for devops, green for healthcare)
- Icon: `text-3xl` centered at top
- Industry label: `text-xs uppercase tracking-wider font-medium text-accent-{color}`
- Title: `text-base font-medium text-primary mt-2`
- Description: `text-sm text-secondary mt-2`
- Feature checklist: `text-xs text-muted mt-4`, each line with `✓` in `text-accent-green`
- CTA button: `w-full mt-4 bg-surface-2 border-default rounded-lg py-2.5 text-sm font-medium text-primary hover:border-accent-{color}/50 text-center`
- Compliance pill at bottom: `text-xs px-2 py-0.5 rounded bg-accent-{color}/10 text-accent-{color} mt-3` centered

**Responsive:** 3 columns on desktop, 1 column on mobile (stack vertically).

#### Update Landing Page

In `apps/landing/src/app/page.tsx`, add the `DemoGallery` component between `UseCases` and `Pricing`:

```tsx
<UseCases />
<DemoGallery />  {/* NEW */}
<Pricing />
```

#### Also update the Hero CTA

Add a secondary link under the hero buttons:

```tsx
<div className="mt-4 text-sm text-muted">
  or <a href="#demos" className="text-accent-blue hover:underline">try an interactive demo</a> — no signup needed
</div>
```

Add `id="demos"` to the DemoGallery section wrapper so the anchor link works.

#### Build and verify

```bash
cd apps/landing && npm run build
```

Open `localhost:3002` and verify:
- Demo gallery section visible between Use Cases and Pricing
- All 3 cards render with correct branding, descriptions, features
- "Try Demo →" buttons link to correct URLs
- Responsive at 375px width
- Hero "try an interactive demo" anchor scrolls to the section

---

## Part B: Deploy 3 Demo Apps to Railway

### What To Do

Deploy each demo app as a new Railway service with a custom domain. You have access to Chrome browser automation (Playwright MCP tools) for Railway and Cloudflare interactions.

#### Prerequisites

1. Each demo app needs a `Dockerfile`. Check if they already exist. If not, create them:

**`apps/demo/Dockerfile`** (and same pattern for demo-devops, demo-healthcare):

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/demo/package.json ./apps/demo/
RUN npm ci --workspace=apps/demo --workspace=packages/shared --workspace=packages/sdk

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ ./packages/
COPY --from=deps /app/apps/demo/node_modules ./apps/demo/node_modules
COPY packages/shared/ ./packages/shared/
COPY packages/sdk/ ./packages/sdk/
COPY apps/demo/ ./apps/demo/
COPY tsconfig.base.json ./
RUN cd packages/shared && npm run build
RUN cd packages/sdk && npm run build
RUN cd apps/demo && npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 demo
COPY --from=build /app/apps/demo/.next/standalone ./
COPY --from=build /app/apps/demo/.next/static ./.next/static
COPY --from=build /app/apps/demo/public ./public 2>/dev/null || true
USER demo
EXPOSE 3003
ENV PORT=3003 HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003 || exit 1
CMD ["node", "server.js"]
```

**Important:** Each demo's `next.config.ts` must have `output: 'standalone'`. Check and add if missing:

```typescript
const nextConfig = {
  output: 'standalone',
};
```

#### Deploy Steps

For EACH demo app (demo, demo-devops, demo-healthcare), do the following:

##### 1. Add Service to Railway

Open `https://railway.app` in Playwright. Navigate to the `sidclaw` project.

For each demo:
- Click "New" → "GitHub Repo" (or add service from existing repo)
- Configure:
  - Dockerfile path: `apps/demo/Dockerfile` (or `apps/demo-devops/Dockerfile` or `apps/demo-healthcare/Dockerfile`)
  - Build context: `/` (repo root)

##### 2. Set Environment Variables

| Variable | Demo 1 (Atlas) | Demo 2 (DevOps) | Demo 3 (Healthcare) |
|----------|----------------|-----------------|---------------------|
| `SIDCLAW_API_URL` | `http://api.railway.internal:4000` or `https://api.sidclaw.com` | same | same |
| `DEMO_ADMIN_API_KEY` | `<admin key with * scope>` | same | same |
| `NEXT_PUBLIC_SIDCLAW_API_URL` | `https://api.sidclaw.com` | same | same |
| `ANTHROPIC_API_KEY` | `<key>` (Demo 1 needs it for chat) | not needed | not needed |
| `PORT` | `3003` | `3004` | `3005` |
| `NODE_ENV` | `production` | `production` | `production` |

**Note on `SIDCLAW_API_URL`:** If Railway supports internal networking between services, use the internal URL (`http://api.railway.internal:4000` or whatever Railway assigns). This avoids going through the public internet for API calls. If internal networking isn't available, use `https://api.sidclaw.com`.

##### 3. Add Custom Domains

| Service | Domain |
|---------|--------|
| Demo 1 (Atlas Financial) | `demo.sidclaw.com` |
| Demo 2 (Nexus DevOps) | `demo-devops.sidclaw.com` |
| Demo 3 (MedAssist Health) | `demo-health.sidclaw.com` |

Railway will provide CNAME targets for each.

##### 4. Add DNS Records in Cloudflare

Open `https://dash.cloudflare.com` in Playwright. Go to `sidclaw.com` → DNS → Records.

Add 3 CNAME records:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `demo` | `<railway-demo1-target>.railway.app` | Proxied |
| CNAME | `demo-devops` | `<railway-demo2-target>.railway.app` | Proxied |
| CNAME | `demo-health` | `<railway-demo3-target>.railway.app` | Proxied |

##### 5. Push Updated Code

The landing page changes (Demo Gallery section) need to be pushed to GitHub for Railway to redeploy:

```bash
cd /Users/vlpetrov/Documents/Programming/agent-identity
git add apps/landing/src/components/DemoGallery.tsx
git add apps/landing/src/app/page.tsx
git add apps/demo/Dockerfile apps/demo-devops/Dockerfile apps/demo-healthcare/Dockerfile
git add apps/demo/next.config.ts apps/demo-devops/next.config.ts apps/demo-healthcare/next.config.ts
git commit -m "Add demo gallery to landing page and Dockerfiles for demo apps"
git push origin main
```

##### 6. Verify All Demos Live

After deployment and DNS propagation:

```bash
# Demo 1
curl -I https://demo.sidclaw.com
# Expected: 200

# Demo 2
curl -I https://demo-devops.sidclaw.com
# Expected: 200

# Demo 3
curl -I https://demo-health.sidclaw.com
# Expected: 200

# Landing page
curl -I https://sidclaw.com
# Expected: 200
```

Open each in Playwright and take a screenshot:

1. `https://demo.sidclaw.com` — verify split-screen chat + governance panel loads
2. `https://demo-devops.sidclaw.com` — verify ops dashboard + governance panel loads, health checks auto-run
3. `https://demo-health.sidclaw.com` — verify EHR patient view + governance panel loads, chart review auto-runs
4. `https://sidclaw.com` — scroll to Demo Gallery section, verify all 3 cards render with correct links

##### 7. Test Each Demo

For each demo, perform the core flow:

**Demo 1 (Atlas):**
- Type "What's the refund policy?" → should get answer, ALLOWED trace on right
- Type "Send a follow-up email to Sarah" → APPROVAL card should appear → click Approve

**Demo 2 (DevOps):**
- Verify 3 service cards (api-gateway healthy, user-service degraded, payment-processor healthy)
- Click "Scale to 6 replicas" → APPROVAL card → Approve
- Click "Delete namespace" → BLOCKED

**Demo 3 (Healthcare):**
- Verify patient header (Sarah Martinez), vitals (BP elevated), labs (A1c above target)
- Click "Order CMP + HbA1c" → APPROVAL card → Approve
- Click "Prescribe Lisinopril" → BLOCKED

Take screenshots of each demo's key moments (approval card, blocked action).

---

## Deliverable

Write a deployment report to `research/2026-03-22-demo-deployment-report.md` with:

1. **Landing page update:** Demo Gallery section added, screenshot
2. **Deployment status:**

| Demo | Railway Service | Domain | Status | Screenshot |
|------|----------------|--------|--------|------------|
| Atlas Financial | ✓/✗ | demo.sidclaw.com | 200/error | path |
| Nexus DevOps | ✓/✗ | demo-devops.sidclaw.com | 200/error | path |
| MedAssist Health | ✓/✗ | demo-health.sidclaw.com | 200/error | path |

3. **Functional verification:** Did the core flow work for each demo?
4. **Issues encountered** during deployment
5. **Screenshots** saved to `research/screenshots/demos/`

## Acceptance Criteria

- [ ] Demo Gallery section visible on `sidclaw.com` between Use Cases and Pricing
- [ ] All 3 demo cards render with correct branding, descriptions, and feature lists
- [ ] "Try Demo →" links point to correct demo subdomains
- [ ] Hero section has "try an interactive demo" anchor link
- [ ] `demo.sidclaw.com` loads and Atlas Financial chat works
- [ ] `demo-devops.sidclaw.com` loads and Nexus DevOps dashboard works
- [ ] `demo-health.sidclaw.com` loads and MedAssist EHR view works
- [ ] All 3 demos connect to `api.sidclaw.com` for real governance
- [ ] DNS configured in Cloudflare with Proxied CNAME records
- [ ] SSL works on all 3 demo subdomains
- [ ] Responsive: demo gallery is single-column on mobile
- [ ] `turbo build` succeeds
- [ ] Code pushed to GitHub

## Constraints

- Do NOT modify the demo apps themselves (Demo 1, 2, 3 code should be finalized)
- Only modify: `apps/landing/` (add DemoGallery component), Dockerfiles (if missing), next.config.ts (add standalone output if missing)
- Use Playwright MCP tools for all Railway and Cloudflare interactions
- Follow code style: files in `kebab-case.tsx`, components in `PascalCase`
