# Stress Test 1: New User Journey

**Date:** 2026-03-22
**Tester:** Claude Code (automated Playwright)
**Target:** Production environment (`sidclaw.com`, `app.sidclaw.com`, `docs.sidclaw.com`)

---

## Journey Timeline

| Step | Target | Duration | Result |
|------|--------|----------|--------|
| 1. Landing page | sidclaw.com | ~5s load | **Pass** — all 9 sections render correctly |
| 2. Sign up (email) | app.sidclaw.com/signup | Infinite hang | **FAIL** — form stuck on "Creating account..." |
| 2b. Sign up (Google OAuth) | app.sidclaw.com/signup | Immediate error | **FAIL** — redirects to localhost:4000 |
| 2c. Sign up (GitHub OAuth) | app.sidclaw.com/signup | Immediate error | **FAIL** — redirects to localhost:4000 |
| 3. Dashboard | app.sidclaw.com/dashboard | Pages load, data never loads | **Partial** — shell renders, all data stuck on "Loading..." |
| 4. Quickstart docs | docs.sidclaw.com/docs/quick-start | ~2s load | **Pass** — well-structured, clear instructions |
| 5. Create agent | app.sidclaw.com/dashboard/agents | Blocked | **FAIL** — no "Create Agent" button, data never loads |
| 6. Create policy | app.sidclaw.com/dashboard/policies | Blocked | **FAIL** — redirected to login page (session lost) |
| 7. Explore settings | app.sidclaw.com/dashboard/settings | Blocked | **FAIL** — "Admin Access Required" shown even without a user session |
| 8. Documentation | docs.sidclaw.com | ~2s load | **Pass** — comprehensive, search works, content is high quality |

## Critical Bugs

### BUG-1: `NEXT_PUBLIC_API_URL` hardcoded to `localhost:4000` in production build (P0 — BLOCKER)

**Root cause of all dashboard and auth failures.** The Next.js dashboard was deployed with the API URL baked as `http://localhost:4000` instead of `https://api.sidclaw.com`. Evidence:

- Searching all JS chunks: found `"http://localhost:4000"` twice in compiled bundles
- Google OAuth redirect goes to `http://localhost:4000/api/v1/auth/google?redirect_uri=...`
- GitHub OAuth redirect goes to `http://localhost:4000/api/v1/auth/github?redirect_uri=...`
- Email signup POST hangs (sending to localhost which the browser cannot reach)
- Dashboard data fetches fail silently (all pages show infinite loading spinners)

**Impact:** The entire product is non-functional for any user. Signup, login, and all dashboard data are broken.

**Fix:** Set `NEXT_PUBLIC_API_URL=https://api.sidclaw.com` in the Vercel deployment environment variables and redeploy.

### BUG-2: Email signup form has no timeout or error handling (P1)

When the email signup API call fails (or hangs), the form stays on "Creating account..." forever with no feedback. There is:
- No timeout
- No error toast
- No way to cancel
- The form fields become disabled with no way to retry

**Expected:** After 10-15 seconds, show an error message like "Something went wrong. Please try again." and re-enable the form.

### BUG-3: OAuth routes return 404 (P1)

Even when the API URL is corrected, the routes `GET /api/v1/auth/google` and `GET /api/v1/auth/github` return `{"message":"Route not found","error":"Not Found","statusCode":404}`. These routes may not be implemented yet, or the auth middleware may not be registered.

### BUG-4: No auth guard on dashboard routes (P2)

Navigating directly to `app.sidclaw.com/dashboard` renders the full dashboard shell (sidebar, page headers, filters) without any authentication. The user sees loading spinners instead of being redirected to login. Auth guard behavior is inconsistent — sometimes the dashboard renders, sometimes it redirects to `/login`.

### BUG-5: Missing favicon.ico (P3)

`app.sidclaw.com/favicon.ico` returns 404. Minor but shows up in browser console as an error.

## Friction Points

1. **Complete signup blocker** — A new user clicking "Get Started Free" lands on a signup form that doesn't work. All three paths (email, Google, GitHub) fail. This is the single biggest issue — the entire product is unreachable.

2. **No error feedback** — When things fail, the user gets no explanation. The signup button says "Creating account..." forever. Dashboard pages show loading spinners forever. No timeouts, no error states, no retry buttons.

3. **Settings access** — Even if auth worked, the Settings page shows "Admin Access Required" which would confuse a new user who just signed up and should be the admin of their own tenant.

4. **No "Create Agent" button** — The Agents page has filters but no visible way to create a new agent. A new user would not know how to get started from the dashboard alone.

5. **Quickstart gap** — The Quick Start docs reference `Settings > API Keys > Create Key` but the Settings page blocks access. The docs also reference `localhost:3000` in Step 5 without clarifying this is for self-hosted only.

## UX Assessment

### Was the signup-to-first-agent flow smooth?
**No.** The flow is completely broken. A developer cannot sign up, cannot log in, and cannot create an agent. The journey ends at Step 2 (signup).

### Did you understand what to do at each step?
**Partially.** The landing page clearly communicates the value proposition and directs users to sign up. The documentation is excellent and would guide a developer well. But the dashboard itself provides no onboarding — no first-run wizard, no API key dialog, no checklist, no empty state guidance.

### What was missing?
- **Working authentication** — the fundamental blocker
- **Onboarding flow** — after signup, what's the first thing a user should do?
- **Empty state guidance** — when there are no agents/policies, show "Create your first agent" with a CTA
- **API key visibility** — a new user needs their API key immediately; the quickstart says go to Settings but Settings blocks access
- **Create buttons** — Agents and Policies pages need visible "Create" actions
- **Error states** — every loading state needs a timeout and error fallback

## First Impression

As a developer evaluating this product:

**The landing page is excellent.** Professional, clear value proposition, good comparison table, relevant stats with citations, clear pricing. It communicates "this is a serious product" effectively.

**The documentation is surprisingly good.** Comprehensive SDK reference, clear quickstart, integration guides for major frameworks (MCP, LangChain, OpenAI, CrewAI, Vercel AI SDK), compliance mapping. This is better documentation than many production products.

**The dashboard is non-functional.** The `localhost:4000` API URL means literally nothing works. A developer who signs up will immediately bounce — the signup form hangs, OAuth fails with a JSON error, and if they somehow reach the dashboard, everything shows infinite spinners.

**Would I keep using this product?** Not in its current state. The product would lose me at signup. But the quality of the landing page and documentation suggests the underlying platform is well-built — this feels like a deployment configuration issue, not a product quality issue. If signup worked and the dashboard loaded data, the experience would likely be significantly better.

**Verdict:** Fix BUG-1 (API URL configuration) and BUG-2 (error handling) and the product becomes testable. The architecture page and documentation suggest a thoughtful product — the deployment just isn't wired up correctly.

## Screenshots

All screenshots saved to `research/screenshots/stress-tests/`:

| File | Description |
|------|-------------|
| `step1-hero-*.png` | Landing page hero section |
| `step1-comparison-table-*.png` | Feature comparison table |
| `step1-pricing-*.png` | Pricing section |
| `step1-cta-destination-*.png` | Signup page after clicking "Get Started Free" |
| `step2-signup-filled-*.png` | Signup form with test credentials filled |
| `step2-signup-stuck-*.png` | Signup form stuck on "Creating account..." |
| `step2-google-oauth-localhost-*.png` | Google OAuth redirecting to localhost:4000 |
| `step3-dashboard-loading-stuck-*.png` | Dashboard overview stuck on "Loading..." |
| `step3-agents-empty-*.png` | Agents page with filters but no data |
| `step3-settings-no-access-*.png` | Settings showing "Admin Access Required" |
| `step4-docs-home-*.png` | Documentation home page |
| `step4-quickstart-*.png` | Quick Start documentation page |
| `step5-agents-no-create-button-*.png` | Agents page with no create button visible |
| `step6-signin-required-*.png` | Login page (session expired/lost) |
| `step8-finra-404-*.png` | FINRA page at wrong URL returns 404 |
| `step8-finra-2026-*.png` | FINRA 2026 compliance page (correct URL) |
| `step8-search-dialog-*.png` | Docs search dialog |
| `step8-search-results-*.png` | Docs search results for "approval" |
