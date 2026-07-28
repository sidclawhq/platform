/**
 * API-key scope catalog — the single source of truth.
 *
 * This vocabulary previously existed in five hand-maintained copies that had
 * drifted apart: packages/shared/src/enums, apps/api's api-key-service
 * (VALID_SCOPES, which was dead code), the api-keys route's inline z.enum,
 * auth.ts's ROUTE_SCOPES, and the dashboard's picker. The enforce side
 * required `approvals:write` while no mint side could produce it, so the CLI
 * could never approve anything. Everything now derives from here.
 *
 * Kept free of imports from ../enums to avoid a cycle: ../enums re-exports
 * the catalog from this module, not the other way round.
 */

import { z } from 'zod';

export const ApiKeyScopeValues = [
  'evaluate',
  'agents:read',
  'agents:write',
  // Separate from agents:write on purpose. policy-engine denies every action
  // for a non-active agent, which makes revoke the kill switch — and
  // POST /agents/:id/reactivate undoes it. A scope that can create an agent
  // should not be able to un-revoke one.
  'agents:lifecycle',
  'policies:read',
  'policies:write',
  'traces:read',
  'traces:write',
  'approvals:read',
  'approvals:write',
  'admin',
] as const;

export type ApiKeyScope = (typeof ApiKeyScopeValues)[number];

export const ApiKeyScopeSchema = z.enum(ApiKeyScopeValues);

/** Human-readable descriptions, rendered by the dashboard picker. */
export const SCOPE_METADATA: Record<ApiKeyScope, { label: string; description: string; danger?: boolean }> = {
  evaluate: {
    label: 'Evaluate',
    description: 'Submit actions for policy evaluation. The core runtime permission an agent needs.',
  },
  'agents:read': { label: 'Read agents', description: 'List and view registered agents.' },
  'agents:write': {
    label: 'Create & edit agents',
    description: 'Register new agents and edit their metadata.',
    danger: true,
  },
  'agents:lifecycle': {
    label: 'Suspend / revoke / reactivate agents',
    description:
      'Change an agent lifecycle state. Reactivating a revoked agent restores its ability to act — grant sparingly.',
    danger: true,
  },
  'policies:read': { label: 'Read policies', description: 'List and view policy rules and their version history.' },
  'policies:write': {
    label: 'Create & edit policies',
    description: 'Create, edit and delete policy rules. This can change what any agent is allowed to do.',
    danger: true,
  },
  'traces:read': { label: 'Read traces', description: 'List, view, verify and export audit traces.' },
  'traces:write': {
    label: 'Write trace outcomes',
    description: 'Record execution outcomes and telemetry against a trace.',
  },
  'approvals:read': { label: 'Read approvals', description: 'List and view pending approval requests.' },
  'approvals:write': {
    label: 'Approve / deny',
    description: 'Decide approval requests. Required by the SidClaw CLI and any custom approver.',
    danger: true,
  },
  admin: {
    label: 'Admin (full access)',
    description: 'Unrestricted access, including API keys, users, billing and webhooks. Avoid for agent runtime keys.',
    danger: true,
  },
};

/**
 * Presets offered in the dashboard. Each exists because a real flow needs it.
 */
export const SCOPE_PRESETS: Record<string, { label: string; description: string; scopes: ApiKeyScope[] }> = {
  agent_runtime: {
    label: 'Agent runtime',
    description: 'What a governed agent process needs at run time. Cannot change any governance rule.',
    scopes: ['evaluate', 'traces:read', 'traces:write', 'approvals:read', 'policies:read'],
  },
  approver: {
    label: 'Approval client',
    description: 'For the SidClaw CLI or a custom approver. Can decide approvals, nothing else.',
    scopes: ['approvals:read', 'approvals:write'],
  },
  project_setup: {
    label: 'Project setup (short-lived)',
    description:
      'For create-sidclaw-app and seed scripts: registers agents and policies. Set an expiry and delete when done.',
    scopes: ['agents:write', 'policies:write', 'policies:read', 'agents:read'],
  },
  read_only: {
    label: 'Read only',
    description: 'Observability and reporting. Cannot change anything.',
    scopes: ['agents:read', 'policies:read', 'traces:read', 'approvals:read'],
  },
};

/**
 * Scopes granted to the key auto-provisioned at signup.
 *
 * Deliberately runtime-only: this key is written into every generated
 * project's .env by create-sidclaw-app, so it is the credential most likely to
 * leak. It must not be able to create agents, rewrite policies, change agent
 * lifecycle, or decide approvals — each of those defeats governance rather
 * than exercising it. Scaffolding uses a separate, user-minted, expiring key.
 */
export const DEFAULT_SIGNUP_KEY_SCOPES: ApiKeyScope[] = [
  'evaluate',
  'traces:read',
  'traces:write',
  'approvals:read',
  'policies:read',
];
