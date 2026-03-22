# Task: Fix Fresh Clone Experience Issues

## Context

A fresh developer tested the repo from scratch and found 7 issues preventing a smooth setup. Read the full report: `research/stress-tests/fresh-clone-report.md`.

Fix all issues, then verify the setup instructions work end-to-end.

## Issue 1: Missing `prisma generate` in setup docs (BLOCKER)

**Problem:** The README and CLAUDE.md say `npx prisma migrate deploy && npx prisma db seed` but the seed fails because the Prisma client hasn't been generated.

**Fix:** Add `npx prisma generate` to the setup steps in both files.

**README.md** — find the self-hosting section and update:

```bash
# Current (broken):
cd apps/api && npx prisma migrate deploy && npx prisma db seed

# Fixed:
cd apps/api && npx prisma generate && npx prisma migrate deploy && npx prisma db seed
```

**CLAUDE.md** — find the "Running Locally" section and update the same way. Search for all instances of `prisma migrate deploy` and ensure `prisma generate` comes before it everywhere.

## Issue 2: No documented way to log into the dashboard (BLOCKER)

**Problem:** The seeded admin user has `password_hash: null`. There's no documented way to log in. The dev-login endpoint exists but is undiscoverable.

**Fix — two parts:**

### Part A: Document the dev-login flow

Add a note to **README.md** in the self-hosting section, after the setup commands:

```markdown
## Logging In (Development)

When OIDC is not configured (local development), click **"Sign in with SSO"** on the login page.
This uses the automatic dev-login endpoint that authenticates you as the seeded admin user — no password needed.
```

Add the same note to **CLAUDE.md** in the "Running Locally" section.

### Part B: Set a password on the seeded admin user

Update `apps/api/prisma/seed.ts` to set a bcrypt password hash on the admin user so email/password login also works:

```typescript
import { hash } from 'bcrypt';

// In the seed script, when creating the admin user:
const adminPasswordHash = await hash('admin', 12);  // password: "admin"

const user = await prisma.user.upsert({
  where: { /* ... */ },
  create: {
    // ... existing fields ...
    password_hash: adminPasswordHash,
  },
  update: {},
});
```

Then document in both README.md and CLAUDE.md:

```markdown
**Development credentials:**
- Email: `admin@example.com`
- Password: `admin`
- Or click "Sign in with SSO" to auto-login without a password
```

**Note:** Check what hashing library the auth system uses (bcrypt, argon2, etc.) — look at `apps/api/src/auth/providers/email-password.ts` for the correct hashing function and import. Use the same one in the seed script.

## Issue 3: CLAUDE.md claims `X-Dev-Bypass` exists (SIGNIFICANT)

**Problem:** CLAUDE.md says "API accepts `X-Dev-Bypass: true` header when `NODE_ENV=development`" — this was removed in P3.4 but the documentation wasn't updated.

**Fix:** Search CLAUDE.md for every mention of `X-Dev-Bypass` and `Dev-Bypass`. Remove or update each reference:

- If it says the API accepts `X-Dev-Bypass`: remove that claim entirely
- If it says the dashboard API client sends `X-Dev-Bypass`: remove that claim
- Replace with a note about the dev-login endpoint: "When OIDC is not configured, the API provides a dev-login endpoint at `GET /api/v1/auth/dev-login` that auto-authenticates as the seeded admin user."
- Remove any `// TODO(P3.4)` comments referencing the dev bypass if they still exist in the documentation

**Also search the codebase** for any remaining references to `X-Dev-Bypass` in code files (not just docs):

```bash
grep -r "Dev-Bypass\|dev.bypass\|devBypass" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=v0-prototype .
```

If any remain in actual code (middleware, API client), they're dead code — remove them too.

## Issue 4: CONTRIBUTING.md wrong repo URL (SIGNIFICANT)

**Problem:** CONTRIBUTING.md references `github.com/sidclawhq/sdk` but the repo is `github.com/sidclawhq/platform`.

**Fix:** Search CONTRIBUTING.md for `sidclawhq/sdk` and replace with `sidclawhq/platform`:

```bash
grep -n "sidclawhq/sdk" CONTRIBUTING.md
```

Replace all instances. Also check if the clone command is correct:

```markdown
# Wrong:
git clone https://github.com/sidclawhq/sdk.git

# Right:
git clone https://github.com/sidclawhq/platform.git
```

## Issue 5: Demo apps have no individual READMEs (SIGNIFICANT)

**Problem:** `apps/demo/`, `apps/demo-devops/`, `apps/demo-healthcare/` don't have README files. A developer can't tell which port each runs on.

**Fix:** Create a brief README.md for each:

### `apps/demo/README.md`:

```markdown
# Atlas Financial — Interactive Demo

AI customer support agent for a fictional fintech company. Demonstrates SidClaw governance with:
- **Allow:** Knowledge base search, account lookup
- **Approval Required:** Customer email sending, case updates
- **Deny:** PII export, account closure

## Run Locally

```bash
# Prerequisites: API running on port 4000, database seeded
npm run dev  # Starts on port 3003
```

Open http://localhost:3003

## Environment Variables

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<key from deployment/.env.development>
ANTHROPIC_API_KEY=<your Anthropic API key>
```

## Production

Deployed at https://demo.sidclaw.com
```

### `apps/demo-devops/README.md`:

```markdown
# Nexus DevOps — Interactive Demo

AI infrastructure operations agent. Demonstrates governance for:
- **Allow:** Health checks, log reading
- **Approval Required:** Service scaling, production deployments
- **Deny:** Namespace deletion, secret rotation

## Run Locally

```bash
npm run dev  # Starts on port 3004
```

Open http://localhost:3004

## Environment Variables

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<key from deployment/.env.development>
```

## Production

Deployed at https://demo-devops.sidclaw.com
```

### `apps/demo-healthcare/README.md`:

```markdown
# MedAssist Health — Interactive Demo

AI clinical assistant. Demonstrates governance for:
- **Allow:** Chart review, literature search
- **Approval Required:** Lab orders, patient communication
- **Deny:** Medication prescribing, treatment plan modification

## Run Locally

```bash
npm run dev  # Starts on port 3005
```

Open http://localhost:3005

## Environment Variables

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<key from deployment/.env.development>
```

## Production

Deployed at https://demo-healthcare.sidclaw.com
```

## Issue 6: Docker Compose port hardcoded (QUICK WIN)

**Problem:** `docker-compose.yml` hardcodes port 5432, which conflicts with local PostgreSQL installations.

**Fix:** Update `docker-compose.yml` to use a configurable port:

```yaml
# Find:
    ports:
      - "5432:5432"

# Replace with:
    ports:
      - "${DB_PORT:-5432}:5432"
```

Add a note to README.md self-hosting section:

```markdown
> **Port conflict?** If you already have PostgreSQL on port 5432, use a different port:
> `DB_PORT=5433 docker compose up -d`
> Then set `DATABASE_URL=postgresql://agent_identity:agent_identity@localhost:5433/agent_identity` in `apps/api/.env`
```

## Issue 7: CORS documentation (QUICK WIN)

**Problem:** If the dashboard runs on a non-standard port, CORS blocks API calls. Not documented.

**Fix:** Add a note to CLAUDE.md in the "Running Locally" section:

```markdown
> **Running dashboard on a different port?** Set `ALLOWED_ORIGINS` when starting the API:
> `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3010 npm run dev`
```

## Verification

After all fixes:

1. **Simulate a fresh clone experience:**
   ```bash
   # In a temp directory, clone the repo
   cd /tmp
   git clone https://github.com/sidclawhq/platform.git sidclaw-fresh-test
   cd sidclaw-fresh-test

   # Follow README instructions exactly
   npm install
   docker compose up db -d  # or DB_PORT=5433 docker compose up db -d
   cd apps/api && npx prisma generate && npx prisma migrate deploy && npx prisma db seed
   npm run dev &

   # In another terminal
   cd apps/dashboard && npm run dev &

   # Can you log in?
   # Try email: admin@example.com, password: admin
   # Try clicking "Sign in with SSO"
   # Both should work

   # Clean up
   cd /tmp && rm -rf sidclaw-fresh-test
   ```

2. **Verify no stale X-Dev-Bypass references:**
   ```bash
   grep -r "Dev-Bypass" --include="*.ts" --include="*.tsx" --include="*.md" \
     --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=v0-prototype .
   # Should return zero results (or only in research/prompts which document the history)
   ```

3. **Verify CONTRIBUTING.md URL:**
   ```bash
   grep "sidclawhq/sdk" CONTRIBUTING.md
   # Should return zero results
   ```

4. **Verify all demo READMEs exist:**
   ```bash
   cat apps/demo/README.md apps/demo-devops/README.md apps/demo-healthcare/README.md | head -5
   # Should show content from all three
   ```

5. **Run tests:**
   ```bash
   turbo test
   # All should pass
   ```

## Acceptance Criteria

- [ ] README setup instructions include `prisma generate` before `migrate deploy`
- [ ] CLAUDE.md setup instructions include `prisma generate`
- [ ] Dev login documented: "Click Sign in with SSO" and email/password credentials
- [ ] Seeded admin user has a working password (`admin`)
- [ ] All `X-Dev-Bypass` references removed from CLAUDE.md
- [ ] No stale `X-Dev-Bypass` code references in the codebase
- [ ] CONTRIBUTING.md uses `sidclawhq/platform` (not `sidclawhq/sdk`)
- [ ] All 3 demo apps have README.md with port numbers and setup instructions
- [ ] Docker compose port is configurable via `DB_PORT` env var
- [ ] Port conflict and CORS workarounds documented
- [ ] `turbo test` passes
- [ ] Fresh setup following README works end-to-end (install → generate → migrate → seed → start → login)
