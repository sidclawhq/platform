/**
 * Route → required-scope map for API-key (Bearer) authentication.
 *
 * Keys are `${METHOD} ${fastify route pattern}` — the pattern, not the raw
 * URL. The previous implementation prefix-matched raw URLs, which was unsound
 * in both directions: `POST /api/v1/policies` would have swallowed
 * `POST /api/v1/policies/test`, and four entries were already unreachable for
 * exactly that reason. Matching the route pattern exactly removes the ordering
 * sensitivity entirely.
 *
 * IMPORTANT: absence from this map means the route requires `admin`. That
 * default lives in auth.ts and is deliberately fail-closed — a route added
 * without a scope entry is locked down, not exposed. ADMIN_ONLY_ROUTES below
 * therefore grants nothing; it exists so a drift test can distinguish
 * "deliberately admin-only" from "someone forgot".
 */

export type RouteScopeKey = string;

export const ROUTE_SCOPES: Record<RouteScopeKey, string> = {
  // --- Core evaluation ---------------------------------------------------
  'POST /api/v1/evaluate': 'evaluate',

  // --- Agents ------------------------------------------------------------
  'GET /api/v1/agents': 'agents:read',
  'GET /api/v1/agents/:id': 'agents:read',
  'POST /api/v1/agents': 'agents:write',
  'PATCH /api/v1/agents/:id': 'agents:write',

  // Lifecycle is separate from agents:write: policy-engine denies every action
  // for a non-active agent, so revoke is the kill switch and reactivate undoes
  // it. Creating an agent should not imply being able to un-revoke one.
  'POST /api/v1/agents/:id/suspend': 'agents:lifecycle',
  'POST /api/v1/agents/:id/revoke': 'agents:lifecycle',
  'POST /api/v1/agents/:id/reactivate': 'agents:lifecycle',

  // --- Policies ----------------------------------------------------------
  'GET /api/v1/policies': 'policies:read',
  'GET /api/v1/policies/:id': 'policies:read',
  'GET /api/v1/policies/:id/versions': 'policies:read',
  // Dry-run evaluation. Side-effect free, so it reads rather than writes.
  'POST /api/v1/policies/test': 'policies:read',
  'POST /api/v1/policies': 'policies:write',
  'PATCH /api/v1/policies/:id': 'policies:write',
  'DELETE /api/v1/policies/:id': 'policies:write',

  // --- Traces ------------------------------------------------------------
  'GET /api/v1/traces': 'traces:read',
  'GET /api/v1/traces/:id': 'traces:read',
  'GET /api/v1/traces/export': 'traces:read',
  'GET /api/v1/traces/:traceId/export': 'traces:read',
  'GET /api/v1/traces/:traceId/verify': 'traces:read',
  'POST /api/v1/traces/:traceId/outcome': 'traces:write',
  // Previously absent, so it required admin — which broke cost attribution for
  // the SDK, the Claude Code Stop hook and the OpenClaw plugin alike.
  'PATCH /api/v1/traces/:traceId/telemetry': 'traces:write',

  // --- Approvals ---------------------------------------------------------
  'GET /api/v1/approvals': 'approvals:read',
  'GET /api/v1/approvals/count': 'approvals:read',
  'GET /api/v1/approvals/:id': 'approvals:read',
  'GET /api/v1/approvals/:id/status': 'approvals:read',
  'POST /api/v1/approvals/:id/approve': 'approvals:write',
  'POST /api/v1/approvals/:id/deny': 'approvals:write',
};

/**
 * Routes that intentionally require `admin` for API-key auth — tenant
 * administration, credential management, billing and dashboard aggregates.
 *
 * This list is documentation and a test fixture. It confers no permission:
 * auth.ts already falls through to `admin` for anything absent from
 * ROUTE_SCOPES. Its purpose is to let a drift test assert that every
 * registered route is *deliberately* one or the other.
 */
export const ADMIN_ONLY_ROUTES: readonly RouteScopeKey[] = [
  // Credential management — an agent key must never mint or rotate keys.
  'GET /api/v1/api-keys',
  'POST /api/v1/api-keys',
  'DELETE /api/v1/api-keys/:id',
  'POST /api/v1/api-keys/:id/rotate',
  // User administration.
  'GET /api/v1/users',
  'PATCH /api/v1/users/:id',
  'DELETE /api/v1/users/:id',
  // Webhook endpoints — outbound data destinations.
  'GET /api/v1/webhooks',
  'POST /api/v1/webhooks',
  'GET /api/v1/webhooks/:id',
  'PATCH /api/v1/webhooks/:id',
  'DELETE /api/v1/webhooks/:id',
  'GET /api/v1/webhooks/:id/deliveries',
  'POST /api/v1/webhooks/:id/test',
  // Billing.
  'GET /api/v1/billing/status',
  'POST /api/v1/billing/checkout',
  'POST /api/v1/billing/portal',
  // Tenant configuration, including chat-integration secrets.
  'GET /api/v1/tenant/info',
  'GET /api/v1/tenant/settings',
  'PATCH /api/v1/tenant/settings',
  'GET /api/v1/tenant/onboarding',
  'PATCH /api/v1/tenant/onboarding',
  'GET /api/v1/tenant/integrations',
  'PATCH /api/v1/tenant/integrations',
  'POST /api/v1/tenant/integrations/:provider/test',
  // Dashboard aggregates and cross-entity search.
  'GET /api/v1/dashboard/overview',
  'GET /api/v1/search',
  // Bulk audit export — deliberately NOT traces:read. Kept admin-only to
  // preserve today's behaviour; it was never reachable by a traces:read key.
  'GET /api/v1/audit/export',
  // Platform-wide usage, super-admin key auth.
  'GET /api/v1/admin/usage',
];

/**
 * Routes that never see API-key auth: unauthenticated, session-only, or
 * verified by a provider signature instead. Listed so the drift test can
 * exclude them rather than silently ignoring unmatched routes.
 */
export const NON_API_KEY_ROUTES: readonly RouteScopeKey[] = [
  'GET /health',
  'GET /health/live',
  'GET /api/v1/auth/me',
  'GET /api/v1/auth/login',
  'GET /api/v1/auth/login/github',
  'GET /api/v1/auth/login/google',
  'GET /api/v1/auth/callback',
  'GET /api/v1/auth/callback/github',
  'GET /api/v1/auth/callback/google',
  'GET /api/v1/auth/dev-login',
  'GET /api/v1/auth/onboarding-key',
  'POST /api/v1/auth/login/email',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/signup',
  // Signature-verified provider callbacks.
  'POST /api/v1/billing/webhook',
  'POST /api/v1/integrations/github/webhook',
  'POST /api/v1/integrations/slack/actions',
  'POST /api/v1/integrations/teams/callback',
  'POST /api/v1/integrations/telegram/webhook',
];
