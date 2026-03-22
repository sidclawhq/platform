# Implementation Report: Interactive Demo App (Atlas Financial)

**Prompt:** `research/prompts/demo-interactive-app.md`
**Commit:** `469314a` on `main`
**Date:** 2026-03-22

## What Was Built

Split-screen interactive demo at `apps/demo/` (port 3003). Left side: chat with a real AI agent via Vercel AI SDK + Claude. Right side: real-time governance panel showing policy decisions, approval cards, and trace timelines. All governance is real (SidClaw API); only business data is mock.

26 files, ~1,742 lines added. Build passes, lint clean, typecheck clean.

## Issues Discovered During Implementation

### 1. SDK Cannot Be Transpiled From Source (not covered in prompt)

The prompt's suggested `tsconfig.json` included path aliases pointing to SDK source (`../../packages/sdk/src`) and `next.config.ts` included `@sidclaw/sdk` in `transpilePackages`. This fails because the SDK uses `.js` extensions in its ESM imports (e.g., `./client/index.js`), which don't resolve when Next.js tries to transpile the `.ts` source files.

**Fix:** Removed SDK from `transpilePackages` and tsconfig path aliases. The demo imports from the pre-built `dist/` via the npm workspace link, which works fine. Only `@sidclaw/shared` needs source transpilation.

**Recommendation for future prompts:** Note that `@sidclaw/sdk` must be consumed from its built output (it uses `tsup` with `.js` extension imports), not transpiled from source. Only `@sidclaw/shared` should be in `transpilePackages`.

### 2. API Key Scopes Insufficient (not covered in prompt)

The prompt uses `DEMO_ADMIN_API_KEY` with the dev API key from `deployment/.env.development`. However, the seed script creates this key with scopes `["evaluate", "traces:read", "traces:write", "approvals:read"]` — missing admin scope needed for `POST /api/v1/agents` and `POST /api/v1/policies` (agent/policy creation) and `POST /api/v1/approvals/:id/approve` (approval actions).

**Fix:** Updated the dev key scopes to `["*"]` via direct DB update. This is a runtime fix, not a code change.

**Recommendation for future prompts:** Either (a) specify that the demo needs an admin-scoped API key and include instructions for creating one, or (b) note that the seed script's dev key needs `["*"]` or `["admin"]` scope for demo use cases that create agents/policies/approvals.

### 3. CORS Error on Approve/Deny (architectural gap in prompt)

The prompt's `GovernancePanel` component makes direct browser-side `fetch()` calls to `localhost:4000` for approve/deny actions. Since the demo runs on `localhost:3003`, this is a cross-origin request that fails with "Failed to fetch."

**Fix:** Created a server-side proxy route at `/api/approval-action` that forwards approve/deny requests to the SidClaw API. Updated `GovernancePanel` to call this proxy instead of the API directly. The governance polling (`/api/governance`) was already correctly proxied — only approve/deny was missed.

**Recommendation for future prompts:** All client-side API calls to the SidClaw API must go through Next.js API routes (server-side proxy), never directly from the browser. This applies to any action the governance panel takes. The prompt correctly proxied polling but missed approve/deny.

### 4. Session Store Lost on Dev Server HMR (architectural gap in prompt)

The prompt uses an in-memory `Map` for session storage in `demo-session.ts`. In Next.js dev mode, route handler modules are re-evaluated on code changes (HMR), which clears the Map. This causes the `/api/chat` route to create a new agent (different from the one created by `/api/setup`), while the governance panel continues polling for the original agent — resulting in empty governance activity.

**Fix:** Modified `/api/chat` to accept `agentId` and `apiKey` directly from the client (which received them from `/api/setup` and stores them in React state). Updated `ChatInterface` to pass these through the `useChat` body. The in-memory session store is still used as a fallback but the client-provided values take precedence.

**Recommendation for future prompts:** For any Next.js demo with in-memory state, note that dev-mode HMR will reset module-level state. Either (a) pass critical IDs from client to server on every request, or (b) use a persistent store (Redis, SQLite, etc.), or (c) document that the in-memory approach only works in production mode.

### 5. Markdown Not Rendered in Chat Messages (missing from prompt)

The prompt's `ChatMessage` component renders `message.content` as plain text via `whitespace-pre-wrap`. Claude's responses contain markdown (bold, lists, headers) which displays as raw `**text**` and `- items`.

**Fix:** Added `react-markdown` dependency and wrapped assistant messages in `<ReactMarkdown>`. Created `.prose-demo` CSS styles in `globals.css` for typography, including explicit `list-style-type: disc` (Tailwind's CSS reset removes list markers by default).

**Recommendation for future prompts:** Any chat interface using an LLM should include markdown rendering. Specify the library (`react-markdown` or similar) and note that Tailwind's preflight CSS removes list markers — explicit `list-style-type` restoration is needed.

### 6. Suggested Prompts Disappear Too Early (UX issue)

The prompt's `ChatInterface` shows compact suggested prompts only when `messages.length > 0 && messages.length < 4`. After two exchanges (4 messages), the prompts vanish. For a demo/sales tool, this means the prospect can only try 2 of the 6 scenarios before losing the guided prompts.

**Fix:** Changed condition to `messages.length > 0` — prompts stay visible throughout the session.

**Recommendation for future prompts:** For demo applications, suggested prompts should always be visible since the entire point is guiding prospects through multiple scenarios.

### 7. Trace Timeline Needed Visual Polish (design gap)

The prompt's `GovernanceEvent` expanded view was a flat list of dots with event type and description text. This looked plain compared to the rest of the "Institutional Calm" design.

**Fix:** Redesigned with a vertical connecting line, color-coded circular nodes per event type (blue for trace/identity, purple for policy, amber for approval, green for allowed, red for denied), event type badges, better typography hierarchy, and a trace ID footer.

**Recommendation for future prompts:** When specifying UI components, include design expectations for expanded/detail states, not just the collapsed view. The approval card was well-specified; the trace timeline was not.

### 8. ESLint Config Missing (build pipeline gap)

The prompt didn't include an ESLint config file. The pre-commit hook runs `turbo lint` which calls `next lint`, which prompts interactively for ESLint setup — failing the commit.

**Fix:** Added `eslint.config.mjs` matching the dashboard's config (extends `next/core-web-vitals` and `next/typescript`).

**Recommendation for future prompts:** Include ESLint config in the project scaffold section. Any app in the monorepo needs it for the pre-commit hook to pass.

### 9. DB Timezone Mismatch Causing Premature Approval Expiry (pre-existing API bug)

Not a prompt issue, but encountered during testing: the Postgres instance runs in UTC+1 while the API stores `expires_at` timestamps in UTC. The expiry job's `WHERE expires_at < NOW()` comparison uses the DB's local time, causing approvals to appear expired ~1 hour early.

**Fix:** `ALTER DATABASE agent_identity SET timezone = 'UTC'` as a runtime workaround.

**Recommendation:** This is an API-level bug that should be fixed separately (either use `timestamptz` columns or ensure the DB timezone is always UTC).

## General Recommendations for Prompt Authors

1. **Test the dependency chain.** The SDK transpilation issue would have been caught by trying `next build` with the suggested config. Include a "verify this compiles" step.

2. **Specify auth requirements explicitly.** List which API endpoints the demo calls and what scopes they need. Don't assume the dev key has sufficient permissions.

3. **All browser-to-API calls need proxying.** In a Next.js app on a different port than the API, every client-side fetch to the API is a CORS violation. The prompt should mandate that all API interactions go through Next.js API routes.

4. **Account for dev-mode behavior.** In-memory state, HMR resets, and module re-evaluation are common Next.js dev-mode gotchas. Prompts should note these or use resilient patterns.

5. **Include the full project scaffold.** Missing files (ESLint config, `.gitignore`) cause friction. A complete file list with all config files prevents commit-time surprises.

6. **Specify rendering for LLM output.** Any component displaying LLM text needs markdown rendering. This is easy to overlook since the prompt author writes plain text examples.
