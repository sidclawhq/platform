# Phase 3 Bugfixes — Auth Redirect & Demo Script

## BUG-6: Dev-login redirect goes to API port

**File:** `apps/dashboard/src/app/login/page.tsx`

**Fix:** Change the SSO button's redirect URL to include the full dashboard origin:

```typescript
// Before (broken):
window.location.href = `${API_URL}/api/v1/auth/login?redirect_uri=/dashboard`;

// After (fixed):
window.location.href = `${API_URL}/api/v1/auth/login?redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard')}`;
```

Also check `apps/api/src/routes/auth.ts` — the dev-login redirect should use the `redirect_uri` query param as-is (it will now be a full URL like `http://localhost:3000/dashboard`). If the API is stripping the protocol or treating it as relative, fix that too.

## BUG-7: Demo script uses removed X-Dev-Bypass header

**File:** `scripts/demo.ts`

**Fix:** Replace all instances of `'X-Dev-Bypass': 'true'` with `'Authorization': \`Bearer ${API_KEY}\``.

There should be exactly 2 places:
1. `printTraceTimeline()` — fetching trace details
2. Auto-approve POST — approving the approval request

## Verification

1. Start services (db, api, dashboard)
2. Open `http://localhost:3000/dashboard` → should redirect to login → click "Sign in with SSO" → should complete login and land on dashboard (not 404)
3. Run `AGENT_IDENTITY_API_KEY=<key> npx tsx scripts/demo.ts` → all 3 scenarios complete with trace timelines printed
