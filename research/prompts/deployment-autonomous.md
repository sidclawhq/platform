# Task: Fully Autonomous Deployment of SidClaw to Production

## Overview

You are deploying the **SidClaw** platform to production. You have access to Chrome browser automation tools to interact with web services. Use them for everything — Railway, Cloudflare, GitHub, Google Cloud Console, Resend.

**Do everything autonomously. Do not ask for confirmation — proceed step by step.**

## Credentials & Accounts

The user already has accounts on:
- **Cloudflare** — domain `sidclaw.com` is registered and managed here
- **GitHub** — org `sidclawhq` exists at `github.com/sidclawhq`
- **npm** — org `@sidclaw` exists at `npmjs.com/org/sidclaw`
- **Railway** — the user may or may not have an account. If not, sign up.

Email routing is configured: `hello@sidclaw.com` → user's Gmail.

## Step-by-Step Instructions

### Phase A: Push Code to GitHub

1. **Create the GitHub repository:**
   - Open `https://github.com/organizations/sidclawhq/repositories/new` in Chrome
   - Repository name: `platform` (the full monorepo — SDK + API + Dashboard + Docs + Landing)
   - Description: "SidClaw — The approval and accountability layer for agentic AI"
   - Visibility: **Public** (the SDK is Apache 2.0 open-source)
   - Do NOT initialize with README (we have one)
   - Create the repository

2. **Push the code** via terminal:
   ```bash
   cd /Users/vlpetrov/Documents/Programming/agent-identity
   git remote add origin https://github.com/sidclawhq/platform.git
   # If origin already exists: git remote set-url origin https://github.com/sidclawhq/platform.git
   git branch -M main
   git push -u origin main
   ```

   If push requires authentication, check if `gh` CLI is authenticated:
   ```bash
   gh auth status
   ```
   If not, prompt the user to run `! gh auth login` interactively.

3. **Verify** the repo is live:
   - Open `https://github.com/sidclawhq/platform` in Chrome
   - Verify README, LICENSE, source code are all visible

### Phase B: Deploy to Railway

1. **Open Railway:**
   - Navigate to `https://railway.app` in Chrome
   - If not logged in, log in (Railway supports GitHub OAuth — use the sidclawhq GitHub account or user's personal account)

2. **Create a new project:**
   - Click "New Project"
   - Name it "sidclaw"

3. **Add PostgreSQL:**
   - In the project, click "New" → "Database" → "PostgreSQL"
   - Wait for it to provision
   - Note: Railway automatically creates a `DATABASE_URL` variable on the PostgreSQL service

4. **Deploy API service:**
   - Click "New" → "GitHub Repo"
   - Connect to `sidclawhq/platform` repository
   - Railway may auto-detect multiple services. If it shows a service config:
     - Set **Root Directory** or **Dockerfile Path**: configure to use `apps/api/Dockerfile`
     - If Railway doesn't support Dockerfile path directly, you may need to use the "Docker" deploy option and specify the Dockerfile
   - Set the following environment variables on the API service:
     ```
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     NODE_ENV=production
     PORT=4000
     ALLOWED_ORIGINS=https://app.sidclaw.com,https://sidclaw.com
     RATE_LIMIT_ENABLED=true
     DASHBOARD_URL=https://app.sidclaw.com
     EMAIL_FROM=SidClaw <notifications@sidclaw.com>
     ```
   - Generate a `SESSION_SECRET`: run `openssl rand -hex 32` in terminal and set it as the value
   - Set health check path: `/health`
   - Add custom domain: `api.sidclaw.com`
   - Railway will show a CNAME target — note it for Cloudflare DNS

5. **Deploy Dashboard service:**
   - Click "New" → "GitHub Repo" → same repo `sidclawhq/platform`
   - Configure Dockerfile: `apps/dashboard/Dockerfile`
   - Environment variables:
     ```
     NEXT_PUBLIC_API_URL=https://api.sidclaw.com
     PORT=3000
     NODE_ENV=production
     ```
   - Add custom domain: `app.sidclaw.com`
   - Note the CNAME target

6. **Deploy Docs service:**
   - Same repo, Dockerfile: `apps/docs/Dockerfile`
   - Environment variables:
     ```
     PORT=3001
     NODE_ENV=production
     ```
   - Add custom domain: `docs.sidclaw.com`
   - Note the CNAME target

7. **Deploy Landing page:**
   - Same repo, Dockerfile: `apps/landing/Dockerfile`
   - Environment variables:
     ```
     PORT=3002
     NODE_ENV=production
     ```
   - Add custom domain: `sidclaw.com`
   - Also add: `www.sidclaw.com`
   - Note the CNAME targets

**Note on Railway UI:** Railway's interface may change. If you can't find specific buttons or options:
- Take a screenshot to understand the current state
- Look for alternative paths (settings tab, service config panel, etc.)
- Railway's "New Service" flow may differ from the steps above — adapt as needed
- If Railway offers a "monorepo" mode that auto-detects services, use that and configure each service's Dockerfile path

### Phase C: Configure Cloudflare DNS

1. **Open Cloudflare dashboard:**
   - Navigate to `https://dash.cloudflare.com` in Chrome
   - Select the `sidclaw.com` domain
   - Go to DNS → Records

2. **Add CNAME records** for each Railway service. For each record:
   - Type: `CNAME`
   - Proxy status: **Proxied** (orange cloud)

   | Name | Target (from Railway) |
   |------|----------------------|
   | `api` | `<railway-api-cname>.railway.app` |
   | `app` | `<railway-dashboard-cname>.railway.app` |
   | `docs` | `<railway-docs-cname>.railway.app` |
   | `@` | `<railway-landing-cname>.railway.app` |
   | `www` | `sidclaw.com` |

   Use the CNAME targets that Railway provided when you added custom domains.

3. **Configure SSL:**
   - Go to SSL/TLS → Overview
   - Set mode to **Full (strict)**
   - Go to SSL/TLS → Edge Certificates
   - Enable "Always Use HTTPS"
   - Set Minimum TLS Version to 1.2

### Phase D: Run Database Migrations and Seed

After the API service deploys successfully on Railway:

1. **Check if Railway CLI is installed:**
   ```bash
   railway --version
   ```
   If not installed:
   ```bash
   npm install -g @railway/cli
   railway login
   ```
   The login may open a browser — use the Chrome automation to complete it if needed.

2. **Link to the project:**
   ```bash
   railway link
   # Select the sidclaw project and api service
   ```

3. **Run migrations:**
   ```bash
   railway run npx prisma migrate deploy
   ```

4. **Run seed (optional — for initial verification):**
   ```bash
   railway run npx prisma db seed
   ```
   Note the API key printed to console.

If the Railway CLI approach doesn't work, check if the API's Dockerfile CMD already runs migrations on startup (`npx prisma migrate deploy && node dist/server.js`). In that case, migrations should run automatically on first deploy.

### Phase E: Register GitHub OAuth App

1. **Open GitHub OAuth settings:**
   - Navigate to `https://github.com/organizations/sidclawhq/settings/applications` in Chrome
   - Click "Register a new application" (or "New OAuth App")

2. **Fill in:**
   - Application name: `SidClaw`
   - Homepage URL: `https://sidclaw.com`
   - Application description: `Sign in to SidClaw with your GitHub account`
   - Authorization callback URL: `https://api.sidclaw.com/api/v1/auth/callback/github`

3. **Submit** and note:
   - Client ID
   - Click "Generate a new client secret" → copy the secret

4. **Add to Railway API service env vars:**
   - Go back to Railway → sidclaw project → API service → Variables
   - Add:
     ```
     GITHUB_CLIENT_ID=<the client ID>
     GITHUB_CLIENT_SECRET=<the secret>
     ```
   - This will trigger a redeploy of the API

### Phase F: Register Google OAuth App

1. **Open Google Cloud Console:**
   - Navigate to `https://console.cloud.google.com` in Chrome
   - Create a new project (or select existing): name it "SidClaw"

2. **Enable OAuth:**
   - Go to APIs & Services → OAuth consent screen
   - User Type: External
   - App name: SidClaw
   - User support email: `hello@sidclaw.com`
   - Developer contact: `hello@sidclaw.com`
   - Save and continue through scopes (default scopes are fine — email, profile, openid)
   - Add test users if needed (in testing mode)
   - Publish the app (or leave in testing for now)

3. **Create OAuth credentials:**
   - Go to APIs & Services → Credentials → "Create Credentials" → "OAuth Client ID"
   - Application type: Web application
   - Name: SidClaw
   - Authorized redirect URIs: `https://api.sidclaw.com/api/v1/auth/callback/google`
   - Create

4. **Note:**
   - Client ID
   - Client Secret

5. **Add to Railway API service env vars:**
   ```
   GOOGLE_CLIENT_ID=<client ID>
   GOOGLE_CLIENT_SECRET=<client secret>
   ```

### Phase G: Set Up Resend for Email

1. **Open Resend:**
   - Navigate to `https://resend.com` in Chrome
   - Sign up or log in (use `hello@sidclaw.com` or user's email)

2. **Add domain:**
   - Go to Domains → Add Domain → `sidclaw.com`
   - Resend will show DNS records to add (SPF, DKIM, DMARC)

3. **Add DNS records in Cloudflare:**
   - Go back to Cloudflare DNS for `sidclaw.com`
   - Add the TXT records that Resend provided:
     - SPF record (TXT on `@`)
     - DKIM record (TXT on a specific subdomain like `resend._domainkey`)
     - DMARC record (TXT on `_dmarc`)
   - **Important:** If there's already an SPF record, merge the Resend include into the existing record rather than creating a duplicate

4. **Verify domain in Resend** — click "Verify" after adding DNS records (may take a few minutes to propagate)

5. **Get API key:**
   - Go to API Keys → Create API Key
   - Name: SidClaw Production
   - Permission: Sending access
   - Copy the key

6. **Add to Railway API service env vars:**
   ```
   EMAIL_API_KEY=re_...
   ```

### Phase H: Publish SDK to npm

1. **Verify the package is ready:**
   ```bash
   cd /Users/vlpetrov/Documents/Programming/agent-identity/packages/sdk
   npm run build
   npm pack --dry-run
   ```
   Verify only dist/, README.md, LICENSE, CHANGELOG.md, package.json are included.

2. **Check npm authentication:**
   ```bash
   npm whoami
   ```
   If not logged in:
   ```bash
   npm login --scope=@sidclaw
   ```
   This may open a browser — complete the login via Chrome.

3. **Publish:**
   ```bash
   cd /Users/vlpetrov/Documents/Programming/agent-identity/packages/sdk
   npm publish --access public
   ```

4. **Verify on npm:**
   - Open `https://www.npmjs.com/package/@sidclaw/sdk` in Chrome
   - Verify: name, version 0.1.0, README renders, license shows Apache-2.0

5. **Test installation:**
   ```bash
   cd /tmp
   mkdir test-install && cd test-install
   npm init -y
   npm install @sidclaw/sdk
   node -e "const { AgentIdentityClient } = require('@sidclaw/sdk'); console.log('Install works:', typeof AgentIdentityClient);"
   cd /Users/vlpetrov/Documents/Programming/agent-identity
   rm -rf /tmp/test-install
   ```

### Phase I: Verify Everything Live

Run through all live URLs:

1. **API health:**
   ```bash
   curl https://api.sidclaw.com/health
   ```
   Expected: `{ "status": "healthy" }`

2. **Landing page:**
   - Open `https://sidclaw.com` in Chrome
   - Verify all 9 sections render
   - Take a screenshot

3. **Documentation:**
   - Open `https://docs.sidclaw.com` in Chrome
   - Verify Quick Start page loads
   - Take a screenshot

4. **Dashboard:**
   - Open `https://app.sidclaw.com` in Chrome
   - Should redirect to login
   - Take a screenshot of login page

5. **Signup flow:**
   - Click "Sign up" or navigate to `https://app.sidclaw.com/signup`
   - Sign up with email (use a test email)
   - Verify onboarding flow works
   - Take a screenshot of the dashboard after signup

6. **GitHub OAuth (if configured):**
   - Click "Sign in with GitHub"
   - Complete GitHub OAuth flow
   - Verify redirect back to dashboard

7. **Run demo script against production:**
   ```bash
   SIDCLAW_API_KEY=<production-key> SIDCLAW_API_URL=https://api.sidclaw.com npx tsx scripts/demo.ts
   ```
   Verify all 3 scenarios work.

8. **npm package:**
   - Open `https://www.npmjs.com/package/@sidclaw/sdk` in Chrome
   - Verify package page exists with correct metadata
   - Take a screenshot

### Phase J: Final Report

Save all screenshots to `research/screenshots/deployment/`.

Write a deployment report to `research/2026-03-21-deployment-report.md` with:

1. **Services deployed:**
   - Railway project URL
   - PostgreSQL status
   - API: URL, health check result
   - Dashboard: URL, login page status
   - Docs: URL, quick start page status
   - Landing: URL, all sections status

2. **DNS configured:**
   - CNAME records added in Cloudflare
   - SSL mode
   - Propagation status

3. **OAuth apps registered:**
   - GitHub: Client ID (not secret), callback URL
   - Google: Client ID (not secret), callback URL

4. **Email (Resend):**
   - Domain verified: yes/no
   - Test email sent: yes/no

5. **npm published:**
   - Package URL: `https://www.npmjs.com/package/@sidclaw/sdk`
   - Version: 0.1.0
   - Install test: pass/fail

6. **Verification results:**
   - API health: pass/fail
   - Landing page: pass/fail
   - Docs site: pass/fail
   - Dashboard login: pass/fail
   - Signup flow: pass/fail
   - OAuth flow: pass/fail
   - Demo script: pass/fail

7. **Screenshots** of every live page

8. **Issues encountered** during deployment and how they were resolved

---

## Important Notes

- **Take screenshots frequently** — before and after each major step, so the user can review what happened
- **If any step fails**, document the error, take a screenshot, and attempt to fix it. If you can't fix it, document what happened and move on to the next step.
- **Environment secrets** (SESSION_SECRET, OAuth secrets, Resend API key) should NEVER be written to files in the repository. Only set them as Railway environment variables.
- **Railway may require a credit card** for the Hobby plan ($5/month). If prompted, inform the user.
- **DNS propagation** can take up to 24 hours but usually completes in 5-30 minutes. If a domain doesn't resolve immediately, note it and move on.
- **Google OAuth** may require the app to be verified for production use (shows "unverified app" warning during testing). This is fine for initial launch — verification can be done later.
