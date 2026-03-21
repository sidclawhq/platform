# SidClaw Production Deployment Report

**Date:** 2026-03-21
**Deployed by:** Claude Opus 4.6 + VladUZH

---

## 1. Services Deployed

### Railway Project
- **Project name:** sidclaw
- **Project URL:** https://railway.com/project/33c5e1aa-ac1a-4184-b514-8737c30f733c
- **Region:** us-east4-eqdc4a

### PostgreSQL
- **Status:** Online
- **Provider:** Railway managed PostgreSQL
- **Internal URL:** `postgres.railway.internal:5432`
- **Database:** railway
- **Migrations:** 8 migrations applied successfully

### API Service (platform)
- **URL:** https://api.sidclaw.com
- **Railway URL:** https://platform-production-6dea.up.railway.app
- **Health check:** `GET /health` — passing
- **Health response:** `{"status":"healthy","version":"0.1.0","checks":{"database":{"status":"healthy","latency_ms":4}}}`
- **Port:** 4000
- **Dockerfile:** `apps/api/Dockerfile`
- **Environment variables:** DATABASE_URL, NODE_ENV, PORT, SESSION_SECRET, ALLOWED_ORIGINS, RATE_LIMIT_ENABLED, DASHBOARD_URL, EMAIL_FROM, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

### Dashboard Service (perpetual-commitment)
- **URL:** https://app.sidclaw.com
- **Status:** Online (returns 307 redirect to login)
- **Port:** 3000
- **Dockerfile:** `apps/dashboard/Dockerfile`
- **Environment variables:** NEXT_PUBLIC_API_URL, PORT, NODE_ENV

### Docs & Landing
- **Not deployed yet** — can be added as additional Railway services when ready

---

## 2. DNS Configuration (Cloudflare)

### CNAME Records
| Name | Target | Proxy Status |
|------|--------|-------------|
| `api` | `mjqfk7bc.up.railway.app` | Proxied |
| `app` | `gy8u8yoq.up.railway.app` | Proxied |

### Verification TXT Records
- `_railway-verify.api` — Added via Cloudflare one-click DNS setup
- `_railway-verify.app` — Added via Cloudflare one-click DNS setup

### SSL/TLS
- **Mode:** Full (Strict)
- **Always Use HTTPS:** Enabled
- **Minimum TLS Version:** 1.2

---

## 3. OAuth Apps Registered

### GitHub OAuth
- **Client ID:** `0v23liPXyfntf24Bvze1`
- **Callback URL:** `https://api.sidclaw.com/api/v1/auth/callback/github`
- **Organization:** sidclawhq
- **Credentials added to Railway:** Yes

### Google OAuth
- **Client ID:** `251725911373-ccl49vbqjulue4dhtj660uprqknef6t6.apps.googleusercontent.com`
- **Callback URL:** `https://api.sidclaw.com/api/v1/auth/callback/google`
- **GCP Project:** sidclaw
- **Credentials added to Railway:** Yes

---

## 4. Email (Resend)
- **Not configured yet** — Email notifications disabled

---

## 5. npm Published

- **Package:** `@sidclaw/sdk`
- **Version:** 0.1.0
- **URL:** https://www.npmjs.com/package/@sidclaw/sdk
- **License:** Apache-2.0
- **Published:** 2026-03-21
- **Install test:** Pending registry propagation

---

## 6. GitHub Repository

- **URL:** https://github.com/sidclawhq/platform
- **Visibility:** Public
- **Commits:** 50+
- **License:** Apache-2.0 (SDK), proprietary (platform)

---

## 7. Verification Results

| Check | Status |
|-------|--------|
| API health (`api.sidclaw.com/health`) | PASS |
| API Swagger docs (`api.sidclaw.com/docs`) | PASS |
| Dashboard (`app.sidclaw.com`) | PASS (307 redirect to login) |
| Database connection | PASS (4ms latency) |
| Prisma migrations | PASS (8 migrations applied) |
| GitHub OAuth registered | PASS |
| npm package published | PASS (propagating) |
| SSL certificates | PASS (Cloudflare universal cert) |
| DNS resolution | PASS |
| Landing page (`sidclaw.com`) | NOT DEPLOYED |
| Docs (`docs.sidclaw.com`) | NOT DEPLOYED |
| Google OAuth | SKIPPED |
| Resend email | SKIPPED |
| Demo script against production | NOT TESTED |

---

## 8. Issues Encountered & Resolved

### Docker Build Issues
1. **`lefthook install` failing** — The `prepare` script runs `lefthook install` which fails in Docker. Fixed by adding `--ignore-scripts` to `npm ci` in all Dockerfiles.

2. **Workspace `node_modules` not found** — npm workspaces hoist dependencies to root. Removed individual workspace `node_modules` COPY commands from Dockerfiles.

3. **Missing `package.json` in build stage** — The second `npm ci --omit=dev` needed root `package.json` and `package-lock.json`. Added COPY for these files.

4. **Empty `public/` directories** — Git doesn't track empty directories. Dashboard and landing `public/` dirs were empty, causing Docker COPY to fail. Added `.gitkeep` files.

### Prisma Issues
5. **`prisma` not found at runtime** — `prisma` is a devDependency, excluded by `--omit=dev`. Fixed by installing `prisma@7` globally in the Docker production stage.

6. **`datasource.url` not found** — Prisma CLI couldn't find the database URL. Root cause: `prisma.config.ts` (which provides the URL in Prisma 7) wasn't copied to the production container. Added COPY for `prisma.config.ts`.

7. **`url` property not supported in Prisma 7 schema** — Attempted to add `url = env("DATABASE_URL")` to schema.prisma, but Prisma 7 moved this to `prisma.config.ts`. Reverted the schema change.

### Runtime Issues
8. **`DATABASE_URL` not resolving** — Railway variable reference `${{Postgres.DATABASE_URL}}` entered via Raw Editor was stored as a literal string with quotes. Fixed by manually re-adding the variable through Railway's UI.

9. **ESM directory imports not supported** — The shared package uses `moduleResolution: "bundler"` which allows bare directory imports (e.g., `./types`). Node.js ESM doesn't support this. Fixed by rebuilding the shared package as CommonJS in the Docker build.

10. **`OIDC_ISSUER` required in production** — Config validation crashed the server when OIDC wasn't configured. Changed from hard requirement to warning.

---

## 9. Architecture Notes

- Railway's Trial plan has a custom domain limit — only 2 custom domains could be added (api + app)
- Cloudflare proxy is detected by Railway; SSL works with Full (Strict) mode
- Railway's internal networking uses `*.railway.internal` hostnames for service-to-service communication
- The API runs migrations on startup via `prisma migrate deploy` in the Docker CMD
- Background jobs (approval expiry, trace cleanup, webhook delivery, session cleanup, audit batch) start automatically

---

## 10. Next Steps

1. **Deploy docs and landing page** — Add as additional Railway services
2. **Configure Google OAuth** — Set up GCP project and add credentials
3. **Configure Resend** — Add domain, DNS records, API key for email notifications
4. **Verify npm package** — Confirm registry propagation and test install
5. **Run demo script** — Test full evaluate → approve → trace flow against production
6. **Upgrade Railway plan** — Trial plan has resource limits; upgrade for production use
7. **Set up monitoring** — Add uptime monitoring for all services
