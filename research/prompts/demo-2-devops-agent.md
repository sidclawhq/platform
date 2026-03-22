# Task: Interactive Demo 2 — Nexus DevOps (AI Infrastructure Dashboard)

## Context

You are working on the **Agent Identity & Approval Layer** project (brand: **SidClaw**). Read these files first:

1. `apps/demo/` — the Atlas Financial demo app (Demo 1). Study the architecture, API routes, and governance panel. Your demo reuses the **right side** (governance panel) but has a **completely different left side**.
2. `research/stress-tests/demo-app-implementation-report.md` — lessons learned from Demo 1. **Read the entire report.** Every issue must be avoided.
3. `apps/dashboard/src/app/globals.css` — design tokens.

Your job is to build a second interactive demo — **Nexus DevOps** — featuring an AI infrastructure agent that monitors cloud services and recommends actions. **This is NOT a chat interface.** The left side is an **ops dashboard** where an AI agent has already analyzed the infrastructure and surfaces recommended actions as buttons. The right side is the same governance panel showing real-time policy decisions.

This targets **engineering leaders and platform teams**, not compliance buyers.

## Lessons From Demo 1 (MUST Follow)

The Demo 1 implementation report identified 9 issues. Your implementation MUST avoid all of them:

1. **SDK imports:** Import `@sidclaw/sdk` from its built `dist/` via workspace link. Do NOT add it to `transpilePackages`. Only `@sidclaw/shared` goes in `transpilePackages`.
2. **API key scopes:** The demo needs an API key with `["*"]` or `["admin"]` scope. Use `DEMO_ADMIN_API_KEY` env var.
3. **CORS — ALL browser-to-API calls through Next.js API routes.** Never direct `fetch()` from client to the SidClaw API.
4. **Session state — pass IDs from client to server on every request.** Don't rely on in-memory Map surviving HMR.
5. **Markdown rendering:** Not needed for this demo (no free-form LLM chat). But if any agent text includes markdown, render it.
6. **Trace timeline design:** Use the improved design from Demo 1 — vertical connecting line, color-coded nodes, event type badges.
7. **ESLint config:** Include `eslint.config.mjs` matching the dashboard.
8. **DB timezone:** Be aware of UTC mismatch for approval expiry.
9. **Project scaffold:** Include all config files (ESLint, .gitignore, tsconfig, tailwind config) in the initial setup.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Demo Page (apps/demo-devops)                                        │
│                                                                      │
│  ┌─────────────────────────────┐  ┌───────────────────────────────┐  │
│  │ Ops Dashboard (left)         │  │ Governance Panel (right)      │  │
│  │                              │  │                               │  │
│  │ Service status cards         │  │ Same component as Demo 1     │  │
│  │ Metrics visualization        │  │ Traces, approval cards,      │  │
│  │ AI-recommended action buttons│  │ policy decisions              │  │
│  │ Agent activity log           │  │                               │  │
│  └──────────┬───────────────────┘  └───────────────┬───────────────┘  │
│             │                                       │                  │
│             ▼                                       ▼                  │
│       Next.js API routes (proxy) ──→ SidClaw API (real governance)    │
└─────────────────────────────────────────────────────────────────────┘
```

## What To Do

### 1. Initialize Project

```bash
cp -r apps/demo apps/demo-devops
```

Then **remove** all chat-related components and replace the left side entirely. Keep:
- `GovernancePanel.tsx`, `GovernanceEvent.tsx`, `ApprovalCard.tsx`, `TraceTimeline.tsx` — right side, reuse as-is
- `DemoHeader.tsx`, `DemoFooter.tsx`, `DemoLayout.tsx` — update branding
- `app/api/governance/route.ts` — governance polling proxy, reuse as-is
- `app/api/approval-action/route.ts` — approve/deny proxy, reuse as-is
- `app/api/setup/route.ts` — session setup, update with new agent/policies
- `globals.css` — design tokens, reuse as-is
- `eslint.config.mjs` — reuse as-is

**Remove:** `ChatInterface.tsx`, `ChatInput.tsx`, `ChatMessage.tsx`, `SuggestedPrompts.tsx`, `app/api/chat/route.ts`

**Add:** New ops dashboard components (described below)

Port: **3004**

### 2. Directory Structure

```
apps/demo-devops/
  src/
    app/
      page.tsx                        # Split-screen: ops dashboard + governance panel
      layout.tsx                      # Root layout (dark theme, fonts)
      globals.css                     # Design tokens (from Demo 1)
      api/
        setup/route.ts                # Creates demo agent + policies
        agent-action/route.ts         # Proxy: executes agent actions via SidClaw API
        governance/route.ts           # Proxy: polls traces + approvals (from Demo 1)
        approval-action/route.ts      # Proxy: approve/deny (from Demo 1)
    components/
      DemoLayout.tsx                  # Split-screen container
      DemoHeader.tsx                  # Top bar: "Nexus Labs" + links
      DemoFooter.tsx                  # Bottom bar: CTAs

      # LEFT SIDE — Ops Dashboard (NEW)
      OpsDashboard.tsx                # Main left-side container
      ServiceList.tsx                 # List of 3 services with status indicators
      ServiceCard.tsx                 # Expanded service card with metrics
      MetricsBar.tsx                  # CPU/Memory progress bar component
      LogViewer.tsx                   # Recent logs panel (monospace, terminal-style)
      AgentRecommendations.tsx        # AI-recommended action buttons
      AgentActionButton.tsx           # Single action button with risk indicator
      DangerZone.tsx                  # Destructive action buttons (red zone)
      ActivityLog.tsx                 # Agent activity feed (terminal-style)

      # RIGHT SIDE — Governance Panel (FROM DEMO 1)
      GovernancePanel.tsx             # Live governance view
      GovernanceEvent.tsx             # Completed trace card
      ApprovalCard.tsx                # Approval card with Approve/Deny
      TraceTimeline.tsx               # Mini trace timeline

    lib/
      demo-tools.ts                   # Mock infrastructure data
      demo-session.ts                 # Agent + policy setup
  package.json
  next.config.ts
  tailwind.config.ts
  tsconfig.json
  eslint.config.mjs
```

### 3. Mock Data (`lib/demo-tools.ts`)

```typescript
export const SERVICES = {
  'api-gateway': {
    id: 'api-gateway',
    name: 'API Gateway',
    status: 'healthy' as const,
    cpu: 34,
    memory: 52,
    memoryUsed: '2.1 GB',
    memoryTotal: '4 GB',
    requestsPerSecond: 1247,
    errorRate: 0.02,
    instances: 4,
    version: 'v2.14.3',
    lastDeploy: '2026-03-21T14:30:00Z',
    region: 'us-east-1',
    uptime: '14d 6h',
  },
  'user-service': {
    id: 'user-service',
    name: 'User Service',
    status: 'degraded' as const,
    cpu: 78,
    memory: 89,
    memoryUsed: '3.6 GB',
    memoryTotal: '4 GB',
    requestsPerSecond: 892,
    errorRate: 1.4,
    instances: 3,
    version: 'v1.8.7',
    lastDeploy: '2026-03-20T09:15:00Z',
    region: 'us-east-1',
    uptime: '2d 23h',
    alert: 'Memory usage critical — approaching OOM threshold',
  },
  'payment-processor': {
    id: 'payment-processor',
    name: 'Payment Processor',
    status: 'healthy' as const,
    cpu: 22,
    memory: 45,
    memoryUsed: '1.8 GB',
    memoryTotal: '4 GB',
    requestsPerSecond: 456,
    errorRate: 0.001,
    instances: 6,
    version: 'v3.2.1',
    lastDeploy: '2026-03-19T16:45:00Z',
    region: 'us-east-1',
    uptime: '3d 15h',
  },
};

export type ServiceStatus = 'healthy' | 'degraded' | 'down';

export const LOGS = {
  'user-service': [
    { time: '08:14:23', level: 'WARN', msg: 'Memory usage at 89% — approaching OOM kill threshold' },
    { time: '08:14:22', level: 'ERROR', msg: 'Connection pool exhausted — 3 requests queued (pool size: 20)' },
    { time: '08:14:20', level: 'INFO', msg: 'GET /api/users/profile → 200 (234ms)' },
    { time: '08:14:18', level: 'WARN', msg: 'Slow query: SELECT * FROM users WHERE... (1.2s)' },
    { time: '08:14:15', level: 'INFO', msg: 'Health check: degraded (memory pressure)' },
    { time: '08:14:10', level: 'ERROR', msg: 'Timeout on downstream cache service call (5000ms)' },
    { time: '08:14:05', level: 'INFO', msg: 'POST /api/users/settings → 200 (89ms)' },
    { time: '08:13:58', level: 'WARN', msg: 'GC pause detected: 340ms (heap: 3.4GB)' },
  ],
};

export const PENDING_DEPLOY = {
  service: 'user-service',
  currentVersion: 'v1.8.7',
  newVersion: 'v1.8.8',
  changes: [
    'Fix: connection pool memory leak (closes #847)',
    'Fix: add request timeout to cache calls (30s → 5s)',
    'Chore: update dependencies',
  ],
  author: 'alex@nexuslabs.io',
  ciStatus: 'passed',
  testsRun: 142,
  testsPassed: 142,
  stagingResult: 'Memory usage improved 32%. Error rate dropped to 0.1%.',
  rollbackPlan: 'Automatic rollback if error rate exceeds 1% within 5 minutes',
};

export const NAMESPACES = [
  { name: 'production', services: 12, pods: 48, status: 'active' },
  { name: 'staging', services: 12, pods: 24, status: 'active' },
  { name: 'dev-feature-auth-v2', services: 4, pods: 8, status: 'active' },
  { name: 'load-test-march', services: 6, pods: 30, status: 'idle', note: 'Last used 12 days ago' },
];
```

### 4. Ops Dashboard — Left Side (`components/OpsDashboard.tsx`)

This is the main left-side component. It shows a monitoring dashboard where an AI agent has already analyzed the infrastructure.

**Layout (top to bottom):**

```
┌─────────────────────────────────────────────────────┐
│  Infrastructure Overview                             │
│                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ ● API   │  │ ▲ User  │  │ ● Paymt │             │
│  │ Gateway │  │ Service │  │ Proc.   │             │
│  │ healthy │  │ degraded│  │ healthy │             │
│  └─────────┘  └─────────┘  └─────────┘             │
│                                                      │
│  ┌─ User Service (degraded) ────────────────────────┐│
│  │  CPU  ████████░░░░░░  78%                         ││
│  │  MEM  █████████░░░░░  89%  ⚠ CRITICAL            ││
│  │  ERR  1.4%    REQ/s  892    Inst: 3               ││
│  │  Version: v1.8.7    Deploy: 2d ago                ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌─ Recent Logs ────────────────────────────────────┐│
│  │  08:14 WARN  Memory at 89% — approaching OOM    ││
│  │  08:14 ERROR Pool exhausted — 3 requests queued  ││
│  │  08:14 WARN  Slow query detected (1.2s)          ││
│  │  08:14 ERROR Timeout on cache service (5000ms)   ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌─ AI Agent Recommendations ───────────────────────┐│
│  │                                                   ││
│  │  Agent detected: user-service is under memory     ││
│  │  pressure. v1.8.8 fixes the connection pool leak. ││
│  │                                                   ││
│  │  [⚡ Scale to 6 replicas]  [🚀 Deploy v1.8.8]    ││
│  │        immediate relief         permanent fix     ││
│  │                                                   ││
│  │  [📋 Deploy v1.8.8 to staging first]              ││
│  │                                                   ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌─ Danger Zone ────────────────────────────────────┐│
│  │                                                   ││
│  │  These actions are blocked by policy:             ││
│  │                                                   ││
│  │  [🗑 Delete load-test-march namespace]            ││
│  │  [🔑 Rotate payment-processor secrets]            ││
│  │                                                   ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ── Agent Activity ──────────────────────────────────│
│  ✓ 08:14:24  Checked api-gateway health              │
│  ✓ 08:14:24  Checked user-service health             │
│  ✓ 08:14:24  Checked payment-processor health        │
│  ▲ 08:14:25  Detected: user-service degraded (89% mem│
│  → 08:14:25  Analyzing: v1.8.8 available (mem fix)   │
│  → 08:14:25  Recommending: scale + deploy            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5. Service List (`components/ServiceList.tsx`)

Three clickable service cards in a horizontal row:

```tsx
interface ServiceCardMiniProps {
  service: typeof SERVICES['api-gateway'];
  selected: boolean;
  onClick: () => void;
}

// Design:
// Healthy: left border green (#22C55E), green dot
// Degraded: left border amber (#F59E0B), amber triangle
// Down: left border red (#EF4444), red circle

// Card: bg-surface-1, border-default, rounded-lg, p-3
// Selected: bg-surface-2, border-accent-blue
// Shows: status dot, name, key metric (req/s or error rate)
```

Clicking a service card expands its detail below (or the detail is always showing the degraded service by default).

### 6. Service Detail Card (`components/ServiceCard.tsx`)

Expanded view of the selected (or degraded) service:

```tsx
// bg-surface-1, border-default (border-accent-amber if degraded), rounded-lg, p-5
// Title: service name + status badge
// Metrics row: CPU bar, Memory bar (with alert if >80%), Error rate, Req/s, Instances
// Version + last deploy time
// If alert: amber banner at top with alert message
```

### 7. Metrics Bar (`components/MetricsBar.tsx`)

```tsx
interface MetricsBarProps {
  label: string;        // "CPU" or "MEM"
  value: number;        // 0-100
  displayValue: string; // "78%" or "3.6 GB / 4 GB"
  critical?: boolean;   // >80% triggers amber/red styling
}

// Visual:
// bg-surface-2 rounded-full h-2 w-full
// Fill: bg-accent-green if <60%, bg-accent-amber if 60-80%, bg-accent-red if >80%
// Label on left, value on right
// If critical: pulse animation on the bar
```

### 8. Log Viewer (`components/LogViewer.tsx`)

Terminal-style log display:

```tsx
// bg-[#0C0C0E] (darker than surface-0), rounded-lg, p-4
// font-mono text-xs
// Each line:
//   Time: text-muted
//   Level: ERROR=text-accent-red, WARN=text-accent-amber, INFO=text-muted
//   Message: text-secondary
// Max height: 200px, overflow-y-auto
// Slight scanline/terminal feel — subtle horizontal lines every 4 rows
```

### 9. Agent Recommendations (`components/AgentRecommendations.tsx`)

The AI has analyzed the situation and recommends specific actions:

```tsx
// bg-surface-1, border-default, rounded-lg, p-5
// Header: "AI Agent Recommendations" with a blue dot indicator
// Subtitle: "Agent detected: user-service is under memory pressure. v1.8.8 fixes the connection pool leak."
// text-sm text-secondary

// Action buttons in a grid:
```

### 10. Action Button (`components/AgentActionButton.tsx`)

```tsx
interface AgentActionButtonProps {
  icon: string;           // emoji or lucide icon
  label: string;          // "Scale to 6 replicas"
  sublabel: string;       // "immediate relief"
  risk: 'low' | 'medium' | 'high';
  loading: boolean;
  onClick: () => void;
}

// Design:
// bg-surface-2, border-default, rounded-lg, p-4
// hover: border-accent-blue/50
// Active/loading: opacity-50, spinner
// Icon on the left (text-lg)
// Label: text-sm font-medium text-primary
// Sublabel: text-xs text-muted
// Risk indicator: small colored dot (green/amber/red) in top-right corner
```

When clicked, the button:
1. Shows loading state
2. Calls `/api/agent-action` (server-side proxy)
3. The proxy calls `client.evaluate()` on the SidClaw API
4. If `allow` → executes mock action, adds to activity log, trace appears on right
5. If `approval_required` → approval card appears on right, button shows "Awaiting approval" state
6. If `deny` → button shows brief red flash "Blocked by policy", trace appears on right

### 11. Danger Zone (`components/DangerZone.tsx`)

```tsx
// bg-surface-1, border border-accent-red/20, rounded-lg, p-5
// Header: "Danger Zone" in text-accent-red text-sm font-medium
// Subtitle: "These actions are blocked by governance policy" in text-xs text-muted
// Red-outlined buttons for destructive actions
// Button style: border border-accent-red/30, text-accent-red, hover: bg-accent-red/10
// When clicked: immediately shows BLOCKED state, red flash, trace on right
```

### 12. Activity Log (`components/ActivityLog.tsx`)

Terminal-style feed of what the agent has done:

```tsx
interface ActivityEntry {
  time: string;
  icon: '✓' | '▲' | '→' | '✗' | '⏳';
  message: string;
  type: 'success' | 'warning' | 'action' | 'blocked' | 'pending';
}

// Design:
// No card wrapper — just a bordered-top section at the bottom
// font-mono text-xs
// Each entry: icon + time + message
// Colors: success=text-accent-green, warning=text-accent-amber, action=text-accent-blue, blocked=text-accent-red, pending=text-muted
// New entries animate in (slide down from top)
// Max 10 entries visible, scrollable
```

**Auto-populated on page load with health check results:**

```typescript
const INITIAL_ACTIVITY: ActivityEntry[] = [
  { time: '08:14:24', icon: '✓', message: 'Health check: api-gateway → healthy (34% CPU, 0.02% errors)', type: 'success' },
  { time: '08:14:24', icon: '✓', message: 'Health check: payment-processor → healthy (22% CPU, 0.001% errors)', type: 'success' },
  { time: '08:14:24', icon: '▲', message: 'Health check: user-service → DEGRADED (78% CPU, 89% memory, 1.4% errors)', type: 'warning' },
  { time: '08:14:25', icon: '→', message: 'Analysis: user-service memory leak detected. v1.8.8 available with fix.', type: 'action' },
  { time: '08:14:25', icon: '→', message: 'Recommendation: Scale to 6 replicas (immediate) + deploy v1.8.8 (permanent fix)', type: 'action' },
];
```

When buttons are clicked, new entries are added:

```typescript
// On scale button click:
{ time: now, icon: '⏳', message: 'Requesting: Scale user-service 3 → 6 replicas. Awaiting engineer approval.', type: 'pending' }

// After approval:
{ time: now, icon: '✓', message: 'Approved: Scale user-service to 6 replicas. New instances launching.', type: 'success' }

// On delete namespace click:
{ time: now, icon: '✗', message: 'BLOCKED: Delete namespace "load-test-march" — destructive actions require manual change request', type: 'blocked' }
```

### 13. Agent Action API Route (`app/api/agent-action/route.ts`)

Server-side proxy that executes governance evaluation and returns the result:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AgentIdentityClient } from '@sidclaw/sdk';

const SIDCLAW_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  const { apiKey, agentId, action } = await request.json();

  // action shape: { operation, target_integration, resource_scope, data_classification, context }

  const client = new AgentIdentityClient({
    apiKey,
    apiUrl: SIDCLAW_API_URL,
    agentId,
  });

  try {
    const decision = await client.evaluate({
      operation: action.operation,
      target_integration: action.target_integration,
      resource_scope: action.resource_scope,
      data_classification: action.data_classification,
      context: action.context ?? {},
    });

    // If allowed, record outcome (mock execution)
    if (decision.decision === 'allow') {
      await client.recordOutcome(decision.trace_id, {
        status: 'success',
        metadata: action.context,
      });
    }

    // If denied, record the denial
    if (decision.decision === 'deny') {
      // Trace already finalized by the API
    }

    return NextResponse.json({
      decision: decision.decision,
      trace_id: decision.trace_id,
      approval_request_id: decision.approval_request_id,
      reason: decision.reason,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Action failed', message: String(error) },
      { status: 500 }
    );
  }
}
```

### 14. Auto-Run Health Checks on Page Load

When the demo page loads and the setup completes, automatically execute 3 health check evaluations (one per service). These are `allow` policy, so they execute instantly. The traces appear on the right side immediately, showing the prospect that governance is active from the start.

```typescript
// In OpsDashboard.tsx, after setup:
useEffect(() => {
  if (!agentId || !apiKey) return;

  const runHealthChecks = async () => {
    for (const serviceId of Object.keys(SERVICES)) {
      await fetch('/api/agent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          agentId,
          action: {
            operation: 'check_health',
            target_integration: 'infrastructure_monitor',
            resource_scope: 'service_metrics',
            data_classification: 'internal',
            context: { service: serviceId },
          },
        }),
      });
    }
  };

  runHealthChecks();
}, [agentId, apiKey]);
```

This means the governance panel already has 3 ALLOWED traces before the prospect clicks anything. First impression: "the agent is already working and being governed."

### 15. Demo Session Setup (`lib/demo-session.ts`)

Same pattern as Demo 1 but with Nexus DevOps agent and 7 policies:

```typescript
// Agent config:
{
  name: `Nexus Ops Agent (demo-${sessionId.substring(0, 8)})`,
  description: 'AI infrastructure agent for Nexus Labs — monitors services, manages deployments, recommends operational actions',
  owner_name: 'Jordan Park',
  owner_role: 'VP Infrastructure',
  team: 'Platform Engineering',
  environment: 'prod',
  authority_model: 'delegated',
  identity_mode: 'delegated_identity',
  delegation_model: 'on_behalf_of_owner',
  autonomy_tier: 'high',
  authorized_integrations: [
    { name: 'Infrastructure Monitor', resource_scope: 'service_metrics', data_classification: 'internal', allowed_operations: ['check_health'] },
    { name: 'Log Aggregator', resource_scope: 'service_logs', data_classification: 'internal', allowed_operations: ['read'] },
    { name: 'Container Orchestrator', resource_scope: 'service_replicas', data_classification: 'confidential', allowed_operations: ['scale'] },
    { name: 'Deployment Pipeline', resource_scope: 'production_environment', data_classification: 'confidential', allowed_operations: ['deploy'] },
  ],
  created_by: 'demo-setup',
}

// 7 policies as described in the original prompt — allow health checks/logs,
// require approval for scaling/deploying, deny namespace deletion/secret rotation
```

### 16. Branding

| Element | Value |
|---------|-------|
| Header title | "Nexus Labs" |
| Header badge | "Interactive Demo — Infrastructure" |
| Left side header | "Infrastructure Overview" |
| Left side subtitle | "AI agent is monitoring 3 services. Governance decisions in real-time." |
| Footer company | "Nexus Labs — Demo Environment" |
| Footer note | "This demo uses real SidClaw governance — policy evaluation, approvals, and traces are authentic. Infrastructure data is simulated." |

### 17. Package Config

```json
{
  "name": "@sidclaw/demo-devops",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3004",
    "build": "next build",
    "start": "next start --port 3004"
  }
}
```

### 18. Environment Variables

`apps/demo-devops/.env.local`:

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<admin-scoped key — must have ["*"] scope>
NEXT_PUBLIC_SIDCLAW_API_URL=http://localhost:4000
```

Note: This demo does NOT need `ANTHROPIC_API_KEY` — there's no LLM chat. The AI "analysis" is pre-computed from the mock data. The governance decisions are real.

### 19. What's Different From Demo 1

| Aspect | Demo 1 (Atlas Financial) | Demo 2 (Nexus DevOps) |
|--------|-------------------------|----------------------|
| Left side | Chat interface | Ops monitoring dashboard |
| Interaction | Type free-form messages | Click action buttons |
| LLM required | Yes (Claude for chat) | No (pre-computed analysis) |
| Target buyer | CISO / compliance | VP Engineering / platform lead |
| Language | "customers", "FINRA", "emails" | "replicas", "deploy", "namespaces" |
| Feeling | Talking to a support bot | Operating an infrastructure dashboard |
| Time to "wow" | 30 seconds (type a prompt) | 0 seconds (health checks run on load) |

## Acceptance Criteria

- [ ] Demo loads at `localhost:3004` with split-screen: ops dashboard (left) + governance panel (right)
- [ ] On load: 3 health checks auto-execute, 3 ALLOWED traces appear on the right
- [ ] Service cards show: api-gateway (green/healthy), user-service (amber/degraded), payment-processor (green/healthy)
- [ ] User-service detail shows: CPU 78%, Memory 89% (red/critical), error rate 1.4%
- [ ] Log viewer shows terminal-style logs with color-coded severity
- [ ] "Scale to 6 replicas" button → APPROVAL REQUIRED card on right with context (current: 3, target: 6, reason)
- [ ] "Deploy v1.8.8" button → APPROVAL REQUIRED card with CI status, changes, rollback plan
- [ ] Approving scaling → activity log shows "Approved", governance panel shows APPROVED trace
- [ ] "Delete namespace" button → immediately BLOCKED, red flash on button, BLOCKED trace on right
- [ ] "Rotate secrets" button → immediately BLOCKED
- [ ] Activity log updates in real-time as actions are taken
- [ ] Governance panel polls every 2 seconds (same as Demo 1)
- [ ] No CORS errors (all API calls proxied through Next.js routes)
- [ ] No LLM/Anthropic API key needed (no chat — all analysis is pre-computed)
- [ ] "Institutional Calm" aesthetic throughout
- [ ] ESLint config present, `turbo build` succeeds

## Constraints

- Do NOT modify the SidClaw API, SDK, or dashboard
- Do NOT modify Demo 1 (`apps/demo/`)
- Reuse Demo 1's governance panel components (right side)
- All infrastructure data is mock — governance is real SidClaw API
- No LLM needed — the "AI analysis" is deterministic from mock data
- Follow code style: files in `kebab-case.tsx`, components in `PascalCase`
