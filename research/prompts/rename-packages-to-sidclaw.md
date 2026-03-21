# Task: Rename Packages from @agent-identity to @sidclaw

## Context

The project brand is **SidClaw** with domain `sidclaw.com`, GitHub org `sidclawhq`, and npm org `@sidclaw`. All package references need to be updated from `@agent-identity/*` to `@sidclaw/*`.

**IMPORTANT:** Run this task with NO other sessions active. It touches imports across the entire codebase.

## What To Do

### 1. Rename Package Names

**`packages/shared/package.json`:**
- `"name": "@agent-identity/shared"` → `"name": "@sidclaw/shared"`

**`packages/sdk/package.json`:**
- `"name": "@agent-identity/sdk"` → `"name": "@sidclaw/sdk"`
- Update `repository.url` to `https://github.com/sidclawhq/sdk`

### 2. Update All Imports Across the Codebase

Search and replace across the entire repo (excluding `node_modules/`, `dist/`, `.next/`, `v0-prototype/`):

```
@agent-identity/shared → @sidclaw/shared
@agent-identity/sdk    → @sidclaw/sdk
```

**Files that will be affected (non-exhaustive — search to find all):**

- `packages/sdk/src/**/*.ts` — imports from shared
- `packages/shared/src/**/*.ts` — internal references if any
- `apps/api/src/**/*.ts` — imports from shared
- `apps/api/prisma/seed.ts` — if it imports from shared
- `apps/dashboard/src/**/*.ts` and `*.tsx` — imports from shared
- `apps/docs/**` — if docs reference package names
- `apps/landing/**` — if landing page references package names
- `turbo.json` — if it references package names in filters
- `tsconfig.base.json` — path aliases
- `tsconfig.json` in each package/app — path aliases and references
- `packages/sdk/README.md` — install instructions, import examples
- `packages/sdk/CHANGELOG.md` — if it references the package name
- `packages/sdk/src/index.ts` — re-exports from shared
- `packages/sdk/tsup.config.ts` — external dependencies list
- `scripts/demo.ts` — if it imports from SDK
- `tests/e2e/**/*.ts` — if tests import from SDK or shared
- `research/prompts/*.md` — prompt files reference package names (update these too so future prompts use the new name)
- `research/2026-03-20-product-development-plan.md` — references throughout the plan document

### 3. Update TypeScript Path Aliases

**`tsconfig.base.json` (or wherever path aliases are configured):**

```json
{
  "compilerOptions": {
    "paths": {
      "@sidclaw/shared": ["./packages/shared/src"],
      "@sidclaw/shared/*": ["./packages/shared/src/*"],
      "@sidclaw/sdk": ["./packages/sdk/src"],
      "@sidclaw/sdk/*": ["./packages/sdk/src/*"]
    }
  }
}
```

Check each app's `tsconfig.json` for local path aliases that may also reference the old name.

### 4. Update Workspace References

**Root `package.json`:**
- If workspace config references package names, update them

**`turbo.json`:**
- If any `--filter` references use the old name, update them

### 5. Update SDK Package Exports and Metadata

**`packages/sdk/package.json`:**
- `"description"` — update any mention of "agent-identity" to "sidclaw"
- `"repository"` — `"url": "https://github.com/sidclawhq/sdk"`
- `"keywords"` — add "sidclaw"

**`packages/sdk/README.md`:**
- All `@agent-identity/sdk` → `@sidclaw/sdk`
- `npm install @agent-identity/sdk` → `npm install @sidclaw/sdk`
- All import examples updated

### 6. Update API and Dashboard Internal References

Search for string literals that reference the old package name (not just imports):

```typescript
// Examples to find and update:
// In server.ts or swagger config:
title: 'Agent Identity & Approval Layer API'  // keep this — it's the product name, not the package name

// In GovernanceMCPServer:
{ name: 'agent-identity-governance', version: '0.1.0' }
// → { name: 'sidclaw-governance', version: '0.1.0' }

// In MCP client:
{ name: 'agent-identity-governance-client', version: '0.1.0' }
// → { name: 'sidclaw-governance-client', version: '0.1.0' }
```

**Note:** The product name "Agent Identity & Approval Layer" and API title can stay as-is — those are product/marketing names, not package names. Only rename technical identifiers (npm packages, MCP server names, etc.).

### 7. Update Environment Variable References

Check if any env vars or config files reference the old name. The API key prefix `ai_` can stay (it stands for the product, not the package).

### 8. Update Research Documents

In `research/prompts/*.md` — update references so any future prompts use `@sidclaw/*`:

```bash
# Find all prompt files that reference the old name
grep -r "@agent-identity" research/prompts/
```

Update each match. Also update `research/2026-03-20-product-development-plan.md` if it references package names.

### 9. Clean and Rebuild

After all renames:

```bash
# Clean all build artifacts
rm -rf packages/shared/dist packages/sdk/dist apps/api/dist apps/dashboard/.next

# Reinstall (workspace names changed)
rm -rf node_modules packages/*/node_modules apps/*/node_modules
npm install

# Verify everything builds
turbo build

# Verify all tests pass
turbo test

# Verify the API starts
cd apps/api && npm run dev

# Verify the dashboard starts
cd apps/dashboard && npm run dev
```

### 10. Verify Completeness

Run a final check to make sure no old references remain:

```bash
# Search for any remaining references (excluding node_modules, dist, .next, v0-prototype)
grep -r "@agent-identity" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=v0-prototype .
```

This should return zero results (except possibly in v0-prototype which we don't touch).

## Acceptance Criteria

- [ ] `packages/shared` has name `@sidclaw/shared`
- [ ] `packages/sdk` has name `@sidclaw/sdk`
- [ ] All imports across `packages/`, `apps/`, `tests/`, `scripts/` use `@sidclaw/*`
- [ ] TypeScript path aliases updated in all tsconfig files
- [ ] SDK README uses `@sidclaw/sdk` in all examples
- [ ] MCP server names updated to `sidclaw-governance`
- [ ] `npm install` succeeds with new workspace names
- [ ] `turbo build` succeeds
- [ ] `turbo test` passes
- [ ] API starts and health check works
- [ ] Dashboard starts and loads correctly
- [ ] `grep -r "@agent-identity"` returns zero results (excluding v0-prototype)
- [ ] Research prompts and plan document updated

## Constraints

- Do NOT rename the project directory (`agent-identity/` folder name stays — it's the working directory)
- Do NOT rename the product name "Agent Identity & Approval Layer" — that's the product, not the package
- Do NOT touch anything in `v0-prototype/`
- Do NOT modify any business logic — this is purely a naming change
- Run this with NO other sessions active
