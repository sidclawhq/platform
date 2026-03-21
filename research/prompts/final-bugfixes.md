# Task: Final Bugfixes Before Launch

## Context

Read `research/2026-03-21-phase5-verification-report.md` and `research/2026-03-21-phase4-verification-report.md` for full bug descriptions. Fix all 5 bugs, then run `turbo test` and verify manually.

---

## BUG-8: API Key Rotation Returns 500 (High)

**Location:** `apps/api/src/services/api-key-service.ts`, `rotate` method

**Problem:** `POST /api/v1/api-keys/:id/rotate` returns 500. The tenant-scoped Prisma extension (P4.2) adds `tenant_id` to the `update` where clause, which conflicts with Prisma's unique identifier lookup on `{ id: keyId }`.

**Fix:** The `rotate` method already verifies tenant ownership via `findFirst`. Switch the `update` call to use a pattern that works with the tenant extension:

```typescript
async rotate(tenantId: string, keyId: string) {
  // Verify key exists and belongs to tenant
  const existing = await this.prisma.apiKey.findFirst({
    where: { id: keyId, tenant_id: tenantId },
  });
  if (!existing) throw new NotFoundError('ApiKey', keyId);

  const rawKey = 'ai_' + randomBytes(32).toString('hex');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 12);

  // Use updateMany which works correctly with the tenant extension
  await this.prisma.apiKey.updateMany({
    where: { id: keyId },
    data: {
      key_prefix: keyPrefix,
      key_hash: keyHash,
      last_used_at: null,
    },
  });

  // Fetch the updated record to return
  const updated = await this.prisma.apiKey.findFirst({
    where: { id: keyId },
  });

  return { ...updated!, key: rawKey };
}
```

If `updateMany` also fails with the tenant extension, the alternative is to use the unscoped base prisma client for this specific operation (import and use the base client from `db/client.ts` after the tenant-scoped `findFirst` has verified ownership).

**Verify:**
```bash
# Start API
cd apps/api && npm run dev

# Create a key (via dev-login session or API key with admin scope)
# Then rotate it:
curl -X POST http://localhost:4000/api/v1/api-keys/<id>/rotate \
  -H "Cookie: session=<session_cookie>" \
  -H "X-CSRF-Token: <csrf_token>"

# Should return 200 with new key
# Old key should return 401
# New key should work
```

---

## BUG-9: Trace Detail API Missing integrity_hash (Medium)

**Location:** `apps/api/src/routes/traces.ts`, the `GET /api/v1/traces/:traceId` handler

**Problem:** The `select` clause for `audit_events` does not include `integrity_hash`.

**Fix:** Find the select object for audit events in the trace detail query and add `integrity_hash: true`:

```typescript
// Find the audit_events select/include in the trace detail handler and add:
integrity_hash: true,
```

Search for the `findFirst` or `findUnique` call on `auditTrace` that includes `audit_events` with a `select` clause. Add `integrity_hash: true` to that select.

**Verify:**
```bash
curl -H "Authorization: Bearer <key>" http://localhost:4000/api/v1/traces/<trace_id>
# Events should now include integrity_hash field (non-null for recently created events)
```

---

## BUG-12: Documentation Search Returns 500 (Medium)

**Location:** `apps/docs/` — Fumadocs search configuration

**Problem:** The search API endpoint (`/api/search`) throws: "Cannot find structured data from page, please define the page to index function." Fumadocs requires the source configuration to provide structured data for the search index.

**Fix:** This depends on the Fumadocs version and setup. The most common fix:

**Option A — Use `createSearchAPI` with the source:**

In `apps/docs/src/app/api/search/route.ts` (or wherever the search endpoint is defined):

```typescript
import { source } from '@/lib/source';  // or wherever the content source is defined
import { createSearchAPI } from 'fumadocs-core/search/server';

export const { GET } = createSearchAPI('advanced', {
  indexes: source.getPages().map((page) => ({
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    id: page.url,
    structuredData: page.data.exports.structuredData,
  })),
});
```

**Option B — If `structuredData` is not available**, use the basic search API:

```typescript
import { source } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';

export const { GET } = createSearchAPI('advanced', {
  indexes: source.getPages().map((page) => ({
    title: page.data.title ?? '',
    description: page.data.description ?? '',
    url: page.url,
    id: page.url,
    content: '', // Fumadocs will index the page content from MDX
  })),
});
```

**Option C — If the above doesn't work**, check the Fumadocs documentation for the correct search setup. The key is that each page in the index needs either `structuredData` or `content` field.

Read the actual Fumadocs source/docs (`node_modules/fumadocs-core/dist/search/` or their online docs) to find the correct API. The error message tells you exactly what's missing.

**Verify:**
```bash
# Start docs
cd apps/docs && npm run dev

# Open http://localhost:3001 in browser
# Use the search bar: type "approval"
# Should return matching pages without error
```

---

## BUG-13: Onboarding UI Not Visible After Signup (Medium)

**Location:** `apps/dashboard/src/` — missing onboarding components

**Problem:** After signup, the user is redirected to `/dashboard?onboarding=true` but no onboarding UI renders. The onboarding components (API key dialog, checklist bar) were specified in the P5.3 prompt but apparently not implemented.

**Fix:** Create two components and wire them into the dashboard:

### 1. API Key Dialog (`apps/dashboard/src/components/onboarding/OnboardingKeyDialog.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function OnboardingKeyDialog() {
  const searchParams = useSearchParams();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if we just signed up and have a key to show
    if (searchParams.get('onboarding') === 'true') {
      // The API key should be stored temporarily after signup
      // Check sessionStorage (set by the signup flow)
      const key = sessionStorage.getItem('sidclaw_onboarding_api_key');
      if (key) {
        setApiKey(key);
        sessionStorage.removeItem('sidclaw_onboarding_api_key');
      }
    }
  }, [searchParams]);

  if (!apiKey || dismissed) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-lg border border-[--border-default] bg-[hsl(var(--surface-1))] p-6">
        <h2 className="text-lg font-medium text-[hsl(var(--text-primary))]">
          Your API Key
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
          Copy this key now. You won't be able to see it again.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 select-all rounded bg-[hsl(var(--surface-2))] px-4 py-3 font-mono text-sm text-[hsl(var(--text-primary))] break-all">
            {apiKey}
          </code>
          <button
            onClick={handleCopy}
            className="rounded bg-[hsl(var(--accent-blue))] px-4 py-3 text-sm font-medium text-white"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <p className="mt-3 text-xs text-[hsl(var(--accent-amber))]">
          This key will not be shown again. Store it securely.
        </p>

        <button
          onClick={() => {
            setDismissed(true);
            // Mark onboarding step as complete
            fetch('/api/v1/tenant/onboarding', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ copy_api_key: true }),
            }).catch(() => {});
          }}
          className="mt-4 w-full rounded bg-[hsl(var(--surface-2))] px-4 py-2 text-sm font-medium text-[hsl(var(--text-primary))]"
        >
          I've copied my key
        </button>
      </div>
    </div>
  );
}
```

### 2. Onboarding Checklist (`apps/dashboard/src/components/onboarding/OnboardingChecklist.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface OnboardingState {
  copy_api_key: boolean;
  register_agent: boolean;
  create_policy: boolean;
  run_evaluation: boolean;
  see_trace: boolean;
}

const STEPS = [
  { key: 'copy_api_key', label: 'Copy your API key', href: '/dashboard/settings/api-keys' },
  { key: 'register_agent', label: 'Register your first agent', href: '/dashboard/agents' },
  { key: 'create_policy', label: 'Create a policy', href: '/dashboard/policies' },
  { key: 'run_evaluation', label: 'Run your first evaluation', href: '/dashboard' },
  { key: 'see_trace', label: 'See your first trace', href: '/dashboard/audit' },
] as const;

export function OnboardingChecklist() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (searchParams.get('onboarding') !== 'true') {
      setLoading(false);
      return;
    }

    api.get<{ data: OnboardingState }>('/api/v1/tenant/onboarding')
      .then(res => setState(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading || !state || dismissed) return null;

  const completedCount = STEPS.filter(s => state[s.key]).length;
  if (completedCount === STEPS.length) return null;  // all done

  return (
    <div className="mx-6 mt-4 rounded-lg border border-[--border-default] bg-[hsl(var(--surface-1))] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[hsl(var(--text-primary))]">
          Getting Started ({completedCount}/{STEPS.length})
        </h3>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-secondary))]"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {STEPS.map(step => (
          <Link
            key={step.key}
            href={step.href}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs ${
              state[step.key]
                ? 'bg-[hsl(var(--accent-green))]/10 text-[hsl(var(--accent-green))]'
                : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
            }`}
          >
            {state[step.key] ? '✓' : '○'} {step.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

### 3. Wire Into Dashboard Layout

In `apps/dashboard/src/app/dashboard/layout.tsx` (or `page.tsx`), add both components:

```typescript
import { OnboardingKeyDialog } from '@/components/onboarding/OnboardingKeyDialog';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';

// Inside the layout, after the header and before the main content:
<OnboardingKeyDialog />
<OnboardingChecklist />
```

### 4. Store API Key in SessionStorage During Signup

In the signup flow (wherever the signup API response is handled — likely `apps/dashboard/src/app/signup/page.tsx` or the auth callback handler):

After a successful signup that returns an API key:

```typescript
// After successful signup response:
if (result.apiKey) {
  sessionStorage.setItem('sidclaw_onboarding_api_key', result.apiKey);
}
// Then redirect to /dashboard?onboarding=true
```

Find the signup handler in the dashboard code and add this line before the redirect.

### 5. Verify Onboarding API Exists

Check that `GET /api/v1/tenant/onboarding` and `PATCH /api/v1/tenant/onboarding` endpoints exist in the API. If not, create them:

```typescript
// GET /api/v1/tenant/onboarding
// Returns: { data: { copy_api_key: false, register_agent: false, ... } }
// Read from tenant.onboarding_state JSON field

// PATCH /api/v1/tenant/onboarding
// Request: { copy_api_key?: boolean, register_agent?: boolean, ... }
// Merges into tenant.onboarding_state
```

**Verify:** Sign up with a new email, verify the API key dialog appears, dismiss it, verify the checklist bar appears with 5 steps.

---

## BUG-14: SDK README Uses api.agentidentity.dev Domain (Low)

**Location:** `packages/sdk/README.md`

**Problem:** One code example uses `apiUrl: 'https://api.agentidentity.dev'` instead of `api.sidclaw.com`.

**Fix:** Search `packages/sdk/README.md` for `agentidentity` and replace all occurrences:

```
api.agentidentity.dev → api.sidclaw.com
agentidentity.dev → sidclaw.com
```

Also check `packages/sdk/src/` for any hardcoded references to `agentidentity.dev` in comments or default values.

**Verify:**
```bash
grep -r "agentidentity" packages/sdk/ --include="*.ts" --include="*.md"
# Should return zero results
```

---

## Verification After All Fixes

```bash
# 1. Run all tests
turbo test
# Expected: 589+ tests, 0 failures

# 2. Verify key rotation
cd apps/api && npm run dev
# Create a key via dashboard or API, then rotate it
# Old key → 401, new key → 200

# 3. Verify trace detail includes integrity_hash
curl -H "Authorization: Bearer <key>" http://localhost:4000/api/v1/traces/<id>
# Events should include integrity_hash

# 4. Verify docs search
cd apps/docs && npm run dev
# Open http://localhost:3001, use search bar: type "approval"
# Should return results

# 5. Verify onboarding
# Sign up with a new email at http://localhost:3000/signup
# API key dialog should appear
# After dismissing, checklist bar should appear
# Checklist steps should link to correct pages

# 6. Verify SDK README
grep "agentidentity" packages/sdk/README.md
# Should return zero results
```

## Acceptance Criteria

- [ ] API key rotation returns 200 with new key (BUG-8)
- [ ] Trace detail API includes `integrity_hash` in events (BUG-9)
- [ ] Documentation search works — returns matching pages (BUG-12)
- [ ] Onboarding API key dialog appears after signup (BUG-13)
- [ ] Onboarding checklist bar appears with 5 steps (BUG-13)
- [ ] SDK README uses `api.sidclaw.com` not `api.agentidentity.dev` (BUG-14)
- [ ] `turbo test` — all tests pass (zero failures)
- [ ] No remaining `agentidentity` references in SDK package
