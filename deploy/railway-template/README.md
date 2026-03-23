# SidClaw — Railway Deployment

Deploy SidClaw on Railway with PostgreSQL, API, and Dashboard.

## How Railway Templates Work

Railway templates define multi-service projects. They are created **through the Railway UI** (template composer) — there is no file-based format for multi-service templates. Each individual service can have a `railway.toml` for build/deploy config (see `apps/api/railway.toml` and `apps/dashboard/railway.toml`), but the service composition, database provisioning, and variable wiring are all done in the template composer.

## Creating the Template

### Step 1: Create a New Template

1. Go to https://railway.app/templates
2. Click **Submit Template**
3. Connect the `sidclawhq/platform` repository

### Step 2: Add Services

Add three services on the template canvas:

#### PostgreSQL Database
- Click **+ Add Database** > **PostgreSQL**
- Railway auto-provisions the database and exposes `DATABASE_URL`

#### API Service
- Click **+ Add Service** > **GitHub Repo**
- Select `sidclawhq/platform`
- Root directory: `/` (Dockerfile references `apps/api/Dockerfile`)
- The `railway.toml` at `apps/api/railway.toml` configures the build and deploy settings automatically

#### Dashboard Service
- Click **+ Add Service** > **GitHub Repo**
- Select `sidclawhq/platform`
- Root directory: `/` (Dockerfile references `apps/dashboard/Dockerfile`)
- The `railway.toml` at `apps/dashboard/railway.toml` configures the build and deploy settings automatically

### Step 3: Configure Variables

#### API Service Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference to PostgreSQL |
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | |
| `SESSION_SECRET` | `${{secret(64)}}` | Auto-generated |
| `ALLOWED_ORIGINS` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | API's own domain |
| `DASHBOARD_URL` | `https://${{Dashboard.RAILWAY_PUBLIC_DOMAIN}}` | Reference to dashboard service |
| `RATE_LIMIT_ENABLED` | `true` | |

#### Dashboard Service Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://${{API.RAILWAY_PUBLIC_DOMAIN}}` | Reference to API service |
| `PORT` | `3000` | |
| `NODE_ENV` | `production` | |

### Step 4: Template Metadata

- **Template name:** SidClaw — AI Agent Governance Platform
- **Description:** Deploy the approval and accountability layer for agentic AI. Policy evaluation, human approval workflows, and audit trails for AI agents.
- **Categories:** Developer Tools, Security
- **Icon:** Use the SidClaw logo

### Step 5: Publish

Click **Publish** to make the template available at `railway.app/template/sidclaw`.

## Post-Deploy Steps

1. Wait for the API health check to pass (runs Prisma migrations on startup)
2. Open the dashboard via the Railway-assigned public URL
3. Seed the database: in the API service shell, run `tsx prisma/seed.ts`
4. Log in with `admin@example.com` / `admin` or click "Sign in with SSO"
5. Go to **Settings > API Keys** to generate your first API key

## Optional Variables

Add these to the API service for additional functionality:

| Variable | Description |
|----------|-------------|
| `OIDC_ISSUER` | OIDC provider URL (Okta, Auth0) |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `EMAIL_API_KEY` | Resend API key for email notifications |
| `EMAIL_FROM` | Sender address (e.g., `SidClaw <notifications@yourdomain.com>`) |

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  PostgreSQL  │ ──► │   API        │ ◄── │  Dashboard   │
│  (database)  │     │  :4000       │     │  :3000       │
└──────────────┘     └──────────────┘     └──────────────┘
```

The API connects to PostgreSQL via `DATABASE_URL`. The dashboard connects to the API via `NEXT_PUBLIC_API_URL`. Both are exposed with Railway's public domains and automatic HTTPS.

## Config-as-Code Files

Per-service build/deploy configuration is defined in:

- `apps/api/railway.toml` — API build (Dockerfile) and deploy (start command, health check)
- `apps/dashboard/railway.toml` — Dashboard build (Dockerfile) and deploy (health check)

These files are automatically picked up by Railway when the services are connected to the repository.
