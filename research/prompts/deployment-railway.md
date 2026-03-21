# Task: Deploy SidClaw to Railway

## Context

You are deploying the **SidClaw** platform (Agent Identity & Approval Layer) to Railway. The codebase is complete and verified — 589+ tests passing, all features working locally.

**Brand details:**
- Domain: `sidclaw.com` (registered on Cloudflare)
- GitHub org: `sidclawhq`
- npm org: `@sidclaw`

**Services to deploy:**
1. **PostgreSQL** — managed database
2. **API** (`apps/api`) — Fastify backend, port 4000
3. **Dashboard** (`apps/dashboard`) — Next.js, port 3000
4. **Docs** (`apps/docs`) — Next.js/Fumadocs, port 3001
5. **Landing** (`apps/landing`) — Next.js, port 3002

**Target domains:**
- `api.sidclaw.com` → API service
- `app.sidclaw.com` → Dashboard
- `docs.sidclaw.com` → Docs site
- `sidclaw.com` → Landing page

## What To Do

### Step 1: Create Railway Project

1. Go to `railway.app` and create a new project
2. Name it "sidclaw" or "sidclaw-production"

### Step 2: Add PostgreSQL

1. In the Railway project, click "New Service" → "Database" → "PostgreSQL"
2. Railway will provision a managed PostgreSQL instance
3. Note the `DATABASE_URL` from the service variables — it will look like:
   `postgresql://postgres:password@host.railway.internal:5432/railway`
4. Railway's internal networking allows services to connect via `*.railway.internal` hostnames

### Step 3: Deploy API Service

1. Click "New Service" → "GitHub Repo" (or "Docker Image")
2. If using GitHub: connect the `sidclawhq` GitHub org, select the repo
3. Configure:
   - **Root Directory:** `apps/api` (if Railway supports monorepo root dirs), OR use the Dockerfile at `apps/api/Dockerfile` with build context set to repo root
   - **Dockerfile Path:** `apps/api/Dockerfile`
   - **Build Context:** `/` (repo root — the Dockerfile needs access to `packages/shared/`)

4. Set environment variables:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}    # Railway variable reference
NODE_ENV=production
PORT=4000
SESSION_SECRET=<generate with: openssl rand -hex 32>
ALLOWED_ORIGINS=https://app.sidclaw.com,https://sidclaw.com
OIDC_REDIRECT_URI=https://api.sidclaw.com/api/v1/auth/callback
RATE_LIMIT_ENABLED=true
DASHBOARD_URL=https://app.sidclaw.com
EMAIL_FROM=SidClaw <notifications@sidclaw.com>
```

**Optional (add when ready):**
```
OIDC_ISSUER=           # When you set up Okta/Auth0
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
GITHUB_CLIENT_ID=      # When you register GitHub OAuth app
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://api.sidclaw.com/api/v1/auth/callback/github
GOOGLE_CLIENT_ID=      # When you register Google OAuth
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api.sidclaw.com/api/v1/auth/callback/google
EMAIL_API_KEY=          # When you set up Resend
```

5. Set health check: `GET /health` on port 4000
6. Add custom domain: `api.sidclaw.com`

### Step 4: Deploy Dashboard

1. New Service → same repo
2. Configure:
   - **Dockerfile Path:** `apps/dashboard/Dockerfile`
   - **Build Context:** `/`

3. Environment variables:
```
NEXT_PUBLIC_API_URL=https://api.sidclaw.com
PORT=3000
NODE_ENV=production
```

4. Add custom domain: `app.sidclaw.com`

### Step 5: Deploy Docs

1. New Service → same repo
2. Configure:
   - **Dockerfile Path:** `apps/docs/Dockerfile`
   - **Build Context:** `/`

3. Environment variables:
```
PORT=3001
NODE_ENV=production
```

4. Add custom domain: `docs.sidclaw.com`

### Step 6: Deploy Landing Page

1. New Service → same repo
2. Configure:
   - **Dockerfile Path:** `apps/landing/Dockerfile`
   - **Build Context:** `/`

3. Environment variables:
```
PORT=3002
NODE_ENV=production
```

4. Add custom domain: `sidclaw.com` and `www.sidclaw.com`

### Step 7: Configure DNS in Cloudflare

For each custom domain, Railway will provide a CNAME target. In Cloudflare DNS for `sidclaw.com`:

```
Type    Name    Target                          Proxy
CNAME   api     <railway-api-target>.railway.app    Proxied
CNAME   app     <railway-dash-target>.railway.app   Proxied
CNAME   docs    <railway-docs-target>.railway.app   Proxied
CNAME   @       <railway-landing-target>.railway.app Proxied
CNAME   www     sidclaw.com                         Proxied
```

**Cloudflare SSL settings:**
- SSL/TLS mode: **Full (strict)** — Railway provides its own SSL, Cloudflare proxies with its own
- Always Use HTTPS: **On**
- Minimum TLS Version: **1.2**

### Step 8: Run Database Migrations

The API Dockerfile should run `npx prisma migrate deploy` on startup. If it doesn't start automatically:

```bash
# Railway CLI
railway run -s api npx prisma migrate deploy
```

Or trigger a deploy of the API service — the Dockerfile CMD runs migrations before starting.

### Step 9: Seed Initial Data (One-Time)

After the first deployment with migrations applied:

```bash
# Via Railway CLI
railway run -s api npx prisma db seed
```

This creates the default tenant, admin user, and development API key. Note the API key printed to the console — you'll need it for the demo script.

**Important:** For production, you'll create real tenants via the self-serve signup flow, not the seed script. The seed is just for the initial deployment verification.

### Step 10: Register OAuth Applications

#### GitHub OAuth App

1. Go to `github.com/organizations/sidclawhq/settings/applications` → "New OAuth App"
2. Application name: `SidClaw`
3. Homepage URL: `https://sidclaw.com`
4. Authorization callback URL: `https://api.sidclaw.com/api/v1/auth/callback/github`
5. Copy Client ID and Client Secret → add to Railway API service env vars:
   ```
   GITHUB_CLIENT_ID=<client_id>
   GITHUB_CLIENT_SECRET=<client_secret>
   ```

#### Google OAuth (OIDC)

1. Go to `console.cloud.google.com` → APIs & Services → Credentials → "Create OAuth Client ID"
2. Application type: Web application
3. Name: `SidClaw`
4. Authorized redirect URIs: `https://api.sidclaw.com/api/v1/auth/callback/google`
5. Copy Client ID and Client Secret → add to Railway API service env vars:
   ```
   GOOGLE_CLIENT_ID=<client_id>
   GOOGLE_CLIENT_SECRET=<client_secret>
   ```

### Step 11: Verify Deployment

After all services are deployed and DNS propagates (usually 5-30 minutes):

```bash
# API health
curl https://api.sidclaw.com/health
# Expected: { "status": "healthy", "version": "0.1.0", ... }

# Landing page
curl -I https://sidclaw.com
# Expected: 200

# Dashboard
curl -I https://app.sidclaw.com
# Expected: 200 (or redirect to login)

# Docs
curl -I https://docs.sidclaw.com
# Expected: 200

# Test signup flow
# Open https://sidclaw.com in browser
# Click "Get Started Free"
# Sign up with email
# Verify dashboard loads with onboarding
```

### Step 12: Set Up Resend for Email Notifications (Optional)

1. Sign up at `resend.com`
2. Add domain: `sidclaw.com`
3. Add DNS records in Cloudflare (Resend will provide them — SPF, DKIM, DMARC)
4. Get API key from Resend dashboard
5. Add to Railway API env vars:
   ```
   EMAIL_API_KEY=re_...
   ```
6. Verify: trigger an approval request → email should arrive

---

## Post-Deployment Checklist

- [ ] `https://api.sidclaw.com/health` returns healthy
- [ ] `https://sidclaw.com` loads the landing page
- [ ] `https://app.sidclaw.com` loads the dashboard (redirects to login)
- [ ] `https://docs.sidclaw.com` loads the documentation
- [ ] SSL certificates valid on all 4 domains
- [ ] Email/password signup works
- [ ] GitHub OAuth works (if configured)
- [ ] Google OAuth works (if configured)
- [ ] Demo script works against production API
- [ ] Dashboard approval flow works end-to-end
- [ ] Trace viewer shows events with integrity hashes

## Cost Estimate (Railway)

- **Hobby plan:** $5/month base + usage
- **PostgreSQL:** ~$5-10/month for small instance
- **4 services:** ~$5-20/month each depending on usage
- **Total estimate:** $25-60/month for initial deployment
- Scale as needed — Railway supports autoscaling

## Rollback Plan

If something breaks:
1. Railway supports instant rollback to previous deployment
2. Database: Railway PostgreSQL has point-in-time recovery
3. DNS: Cloudflare changes propagate in seconds
