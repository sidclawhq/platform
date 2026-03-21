# P1.5 Dashboard: Approval Queue & Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approval queue page and approval detail slide-over panel in the governance dashboard, connecting to the existing API endpoints for listing, viewing, approving, and denying approval requests.

**Architecture:** The page at `/dashboard/approvals` fetches pending approvals via polling (5s interval) and renders them as a filterable, sortable vertical card list. Clicking a card opens a right-side slide-over panel that fetches full context from `GET /api/v1/approvals/:id` and displays 7 sections including reviewer action buttons. All components are client-side React (`'use client'`) using the existing `ApiClient` singleton. No new dependencies — uses existing `sonner` for toasts, `lucide-react` for the close icon, and design tokens from the "Institutional Calm" system in `globals.css`.

**Tech Stack:** Next.js 15 (App Router, client components), React 19, TypeScript, Tailwind CSS v4 (CSS-variable design tokens), `sonner` (toasts), `lucide-react` (icons), `@agent-identity/shared` (types/enums)

---

## File Structure

```
apps/dashboard/src/
  lib/
    format.ts                              # NEW — relativeTime() utility
    api-client.ts                          # MODIFY — add 4 approval API methods
  components/ui/
    SlideOverPanel.tsx                     # NEW — reusable slide-over panel
  components/approvals/
    ApprovalStatusBadge.tsx                # NEW — status/classification badge pill
    ApprovalQueueCard.tsx                  # NEW — single approval card in queue
    ApprovalQueueFilters.tsx               # NEW — filter bar (status, sort)
    ApprovalQueue.tsx                      # NEW — queue container with sorting, empty state, pagination
    ApprovalTraceEvents.tsx                # NEW — mini vertical timeline for trace events
    ApprovalDetailSections.tsx             # NEW — 7 sections of the detail view
    ApprovalReviewerAction.tsx             # NEW — approve/deny buttons + note textarea
    ApprovalDetail.tsx                     # NEW — slide-over detail panel (fetches + renders sections)
  app/dashboard/approvals/
    page.tsx                               # NEW — page component with polling + state management
```

**Responsibilities:**
- `format.ts` — Pure utility, no React. Relative time formatting.
- `api-client.ts` — 4 new methods wrapping existing `get`/`post` with typed responses.
- `SlideOverPanel.tsx` — Reusable UI shell: fixed position, backdrop, slide animation, close button. No domain logic.
- `ApprovalStatusBadge.tsx` — Tiny presentational component for status pills (pending/approved/denied) and data classification pills.
- `ApprovalQueueCard.tsx` — Single card rendering an approval list item. Receives data + callbacks, no fetching.
- `ApprovalQueueFilters.tsx` — Sort dropdown + status filter. Controlled component, parent owns state.
- `ApprovalQueue.tsx` — Maps data to cards, handles empty state, pagination controls.
- `ApprovalTraceEvents.tsx` — Renders `trace_events[]` as a mini vertical timeline. Presentational only.
- `ApprovalDetailSections.tsx` — All 7 sections of the detail view as a single component. Receives `ApprovalDetail` data.
- `ApprovalReviewerAction.tsx` — Approve/Deny buttons, note textarea, loading state, API calls, toast feedback.
- `ApprovalDetail.tsx` — Wraps `SlideOverPanel`, fetches detail data, composes `ApprovalDetailSections` + `ApprovalReviewerAction`.
- `page.tsx` — Page-level state: polling, selected ID, filter/sort state, refresh trigger.

---

## Type Definitions

The API returns these shapes. Define them in each file where used (no separate types file — YAGNI). Key shapes for reference:

### List endpoint response (`GET /api/v1/approvals?status=...`)
```typescript
interface ApprovalListItem {
  id: string;
  tenant_id: string;
  trace_id: string;
  agent_id: string;
  policy_rule_id: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  risk_classification: string;
  authority_model: string;
  delegated_from: string | null;
  policy_effect: string;
  flag_reason: string;
  status: string;
  context_snapshot: Record<string, unknown> | null;
  alternatives: string[] | null;
  expires_at: string | null;
  requested_at: string;
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
  separation_of_duties_check: string;
  agent: { id: string; name: string; owner_name: string };
}

// Response wrapper:
{ data: ApprovalListItem[]; pagination: { total: number; limit: number; offset: number } }
```

### Detail endpoint response (`GET /api/v1/approvals/:id`)
```typescript
interface ApprovalDetail {
  // All ApprovalListItem fields, plus:
  agent: {
    id: string; name: string; owner_name: string; owner_role: string;
    team: string; authority_model: string; identity_mode: string;
    delegation_model: string; autonomy_tier: string;
  };
  policy_rule: {
    id: string; policy_name: string; rationale: string;
    policy_version: number; data_classification: string; policy_effect: string;
  };
  trace_events: Array<{
    id: string; event_type: string; actor_type: string;
    actor_name: string; description: string; status: string; timestamp: string;
  }>;
}
```

### Error shapes
- `409` → `ApiError` with `code: 'conflict'`
- `403` → `ApiError` with `code: 'separation_of_duties_violation'`

---

## Tasks

### Task 1: Relative Time Utility

**Files:**
- Create: `apps/dashboard/src/lib/format.ts`

- [ ] **Step 1: Create format.ts**

```typescript
export function relativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/lib/format.ts
git commit -m "feat(dashboard): add relativeTime utility"
```

---

### Task 2: API Client — Approval Methods

**Files:**
- Modify: `apps/dashboard/src/lib/api-client.ts`

The existing `ApiClient` class has `get<T>()` and `post<T>()` methods. Add 4 approval-specific methods.

- [ ] **Step 1: Add approval types and methods to api-client.ts**

Add these interfaces and methods to `api-client.ts`. The interfaces go **above** the `ApiClient` class. The methods go **inside** the class, after the existing `healthCheck()` method.

Interfaces to add above the class:

```typescript
export interface ApprovalListItem {
  id: string;
  tenant_id: string;
  trace_id: string;
  agent_id: string;
  policy_rule_id: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  risk_classification: string;
  authority_model: string;
  delegated_from: string | null;
  policy_effect: string;
  flag_reason: string;
  status: string;
  context_snapshot: Record<string, unknown> | null;
  alternatives: string[] | null;
  expires_at: string | null;
  requested_at: string;
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
  separation_of_duties_check: string;
  agent: { id: string; name: string; owner_name: string };
}

export interface ApprovalDetailResponse {
  id: string;
  tenant_id: string;
  trace_id: string;
  agent_id: string;
  policy_rule_id: string;
  requested_operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  risk_classification: string;
  authority_model: string;
  delegated_from: string | null;
  policy_effect: string;
  flag_reason: string;
  status: string;
  context_snapshot: Record<string, unknown> | null;
  alternatives: string[] | null;
  expires_at: string | null;
  requested_at: string;
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
  separation_of_duties_check: string;
  agent: {
    id: string;
    name: string;
    owner_name: string;
    owner_role: string;
    team: string;
    authority_model: string;
    identity_mode: string;
    delegation_model: string;
    autonomy_tier: string;
  };
  policy_rule: {
    id: string;
    policy_name: string;
    rationale: string;
    policy_version: number;
    data_classification: string;
    policy_effect: string;
  };
  trace_events: Array<{
    id: string;
    event_type: string;
    actor_type: string;
    actor_name: string;
    description: string;
    status: string;
    timestamp: string;
  }>;
}

export interface ApprovalListResponse {
  data: ApprovalListItem[];
  pagination: { total: number; limit: number; offset: number };
}
```

Methods to add inside `ApiClient` class (after `healthCheck()`):

```typescript
  async listApprovals(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApprovalListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.get<ApprovalListResponse>(`/api/v1/approvals${qs ? `?${qs}` : ''}`);
  }

  async getApproval(id: string): Promise<ApprovalDetailResponse> {
    return this.get<ApprovalDetailResponse>(`/api/v1/approvals/${id}`);
  }

  async approveRequest(
    id: string,
    body: { approver_name: string; decision_note?: string },
  ): Promise<ApprovalDetailResponse> {
    return this.post<ApprovalDetailResponse>(`/api/v1/approvals/${id}/approve`, body);
  }

  async denyRequest(
    id: string,
    body: { approver_name: string; decision_note?: string },
  ): Promise<ApprovalDetailResponse> {
    return this.post<ApprovalDetailResponse>(`/api/v1/approvals/${id}/deny`, body);
  }
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/lib/api-client.ts
git commit -m "feat(dashboard): add approval API client methods"
```

---

### Task 3: SlideOverPanel Component

**Files:**
- Create: `apps/dashboard/src/components/ui/SlideOverPanel.tsx`

Reusable slide-over panel. No domain logic. Uses `X` close icon from `lucide-react`.

- [ ] **Step 1: Create SlideOverPanel.tsx**

```tsx
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function SlideOverPanel({ isOpen, onClose, title, children }: SlideOverPanelProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-[560px] border-l border-border bg-surface-0 shadow-xl transition-transform duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 57px)' }}>
          {children}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/ui/SlideOverPanel.tsx
git commit -m "feat(dashboard): add reusable SlideOverPanel component"
```

---

### Task 4: ApprovalStatusBadge Component

**Files:**
- Create: `apps/dashboard/src/components/approvals/ApprovalStatusBadge.tsx`

Renders two kinds of pills: approval status badges and data classification badges.

- [ ] **Step 1: Create ApprovalStatusBadge.tsx**

```tsx
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-accent-amber/20 text-accent-amber',
  approved: 'bg-accent-green/20 text-accent-green',
  denied: 'bg-accent-red/20 text-accent-red',
  expired: 'bg-surface-2 text-text-muted',
};

const classificationColors: Record<string, string> = {
  public: 'bg-surface-2 text-text-muted',
  internal: 'bg-accent-blue/20 text-accent-blue',
  confidential: 'bg-accent-amber/20 text-accent-amber',
  restricted: 'bg-accent-red/20 text-accent-red',
};

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ApprovalStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        statusColors[status] ?? 'bg-surface-2 text-text-muted',
      )}
    >
      {formatLabel(status)}
    </span>
  );
}

export function DataClassificationBadge({ classification }: { classification: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        classificationColors[classification] ?? 'bg-surface-2 text-text-muted',
      )}
    >
      {formatLabel(classification)}
    </span>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/approvals/ApprovalStatusBadge.tsx
git commit -m "feat(dashboard): add ApprovalStatusBadge and DataClassificationBadge"
```

---

### Task 5: ApprovalQueueCard Component

**Files:**
- Create: `apps/dashboard/src/components/approvals/ApprovalQueueCard.tsx`

A clickable card row showing one approval. Uses `ApprovalStatusBadge`, `DataClassificationBadge`, and `relativeTime`.

**Design tokens to use:**
- Background: `bg-surface-1` (`#111113`)
- Border: `border-border` (`#2A2A2E`), left accent `border-l-4 border-accent-amber` for pending
- Hover: `hover:bg-surface-2` with transition
- Selected: `bg-surface-2` with `border-l-4 border-accent-blue`
- Operation text: `font-mono text-sm` (JetBrains Mono)
- Flag reason: `text-sm text-text-secondary`, truncated
- Time: `text-xs text-text-muted`
- Agent name: `text-sm text-text-muted`, right-aligned

- [ ] **Step 1: Create ApprovalQueueCard.tsx**

```tsx
'use client';

import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';
import { ApprovalStatusBadge, DataClassificationBadge } from './ApprovalStatusBadge';
import type { ApprovalListItem } from '@/lib/api-client';

interface ApprovalQueueCardProps {
  approval: ApprovalListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function ApprovalQueueCard({ approval, isSelected, onSelect }: ApprovalQueueCardProps) {
  const isPending = approval.status === 'pending';
  const truncatedReason =
    approval.flag_reason.length > 80
      ? approval.flag_reason.slice(0, 80) + '...'
      : approval.flag_reason;

  return (
    <button
      type="button"
      onClick={() => onSelect(approval.id)}
      className={cn(
        'w-full rounded-lg border bg-surface-1 p-4 text-left transition-colors',
        isPending && !isSelected && 'border-l-4 border-l-accent-amber border-y-border border-r-border',
        isSelected && 'border-l-4 border-l-accent-blue border-y-border border-r-border bg-surface-2',
        !isPending && !isSelected && 'border-border',
        !isSelected && 'hover:bg-surface-2',
      )}
    >
      {/* Row 1: Status badge + Classification badge */}
      <div className="flex items-center justify-between">
        <ApprovalStatusBadge status={approval.status} />
        <DataClassificationBadge classification={approval.data_classification} />
      </div>

      {/* Row 2: Operation → Target + Agent name */}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-sm text-foreground">
            {approval.requested_operation}
          </span>
          <span className="font-mono text-sm text-text-muted">
            {' → '}
          </span>
          <span className="font-mono text-sm text-foreground">
            {approval.target_integration}
          </span>
        </div>
        <span className="shrink-0 text-sm text-text-muted">
          {approval.agent.name}
        </span>
      </div>

      {/* Row 3: Resource scope */}
      <div className="mt-0.5">
        <span className="font-mono text-xs text-text-muted">
          {approval.resource_scope}
        </span>
      </div>

      {/* Row 4: Flag reason + Time pending */}
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="min-w-0 text-sm text-text-secondary">
          {truncatedReason}
        </p>
        <span className="shrink-0 text-xs text-text-muted">
          {relativeTime(approval.requested_at)}
        </span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/approvals/ApprovalQueueCard.tsx
git commit -m "feat(dashboard): add ApprovalQueueCard component"
```

---

### Task 6: ApprovalQueueFilters Component

**Files:**
- Create: `apps/dashboard/src/components/approvals/ApprovalQueueFilters.tsx`

Sort and status filter controls at the top of the queue.

- [ ] **Step 1: Create ApprovalQueueFilters.tsx**

```tsx
'use client';

export type SortOption = 'oldest' | 'agent' | 'classification';

interface ApprovalQueueFiltersProps {
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function ApprovalQueueFilters({
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
}: ApprovalQueueFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="h-8 rounded border border-border bg-surface-1 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="pending">Pending</option>
        <option value="">All Statuses</option>
        <option value="approved">Approved</option>
        <option value="denied">Denied</option>
      </select>

      {/* Sort */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="h-8 rounded border border-border bg-surface-1 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="oldest">Oldest first</option>
        <option value="agent">Agent name</option>
        <option value="classification">Classification</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/approvals/ApprovalQueueFilters.tsx
git commit -m "feat(dashboard): add ApprovalQueueFilters component"
```

---

### Task 7: ApprovalQueue Component

**Files:**
- Create: `apps/dashboard/src/components/approvals/ApprovalQueue.tsx`

Container that maps approval data to cards. Handles sorting (client-side), empty state, and pagination.

- [ ] **Step 1: Create ApprovalQueue.tsx**

```tsx
'use client';

import { useMemo } from 'react';
import { ApprovalQueueCard } from './ApprovalQueueCard';
import type { ApprovalListItem } from '@/lib/api-client';
import type { SortOption } from './ApprovalQueueFilters';

interface ApprovalQueueProps {
  approvals: ApprovalListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (approvalId: string) => void;
  sortBy: SortOption;
  pagination: { total: number; limit: number; offset: number };
  onPageChange: (offset: number) => void;
}

const classificationOrder: Record<string, number> = {
  restricted: 0,
  confidential: 1,
  internal: 2,
  public: 3,
};

export function ApprovalQueue({
  approvals,
  loading,
  selectedId,
  onSelect,
  sortBy,
  pagination,
  onPageChange,
}: ApprovalQueueProps) {
  const sorted = useMemo(() => {
    const items = [...approvals];
    switch (sortBy) {
      case 'oldest':
        items.sort(
          (a, b) =>
            new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime(),
        );
        break;
      case 'agent':
        items.sort((a, b) => a.agent.name.localeCompare(b.agent.name));
        break;
      case 'classification':
        items.sort(
          (a, b) =>
            (classificationOrder[a.data_classification] ?? 99) -
            (classificationOrder[b.data_classification] ?? 99),
        );
        break;
    }
    return items;
  }, [approvals, sortBy]);

  if (!loading && approvals.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-text-secondary">
          No pending approvals
        </p>
        <p className="mt-1 text-xs text-text-muted">
          When agents request operations that require approval, they will appear here.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div>
      <div className="flex flex-col gap-2">
        {sorted.map((approval) => (
          <ApprovalQueueCard
            key={approval.id}
            approval={approval}
            isSelected={approval.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Loading indicator */}
      {loading && approvals.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-text-muted">Loading approvals...</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {pagination.total} total — page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.offset === 0}
              onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
              className="rounded border border-border bg-surface-1 px-3 py-1 text-xs text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={pagination.offset + pagination.limit >= pagination.total}
              onClick={() => onPageChange(pagination.offset + pagination.limit)}
              className="rounded border border-border bg-surface-1 px-3 py-1 text-xs text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/approvals/ApprovalQueue.tsx
git commit -m "feat(dashboard): add ApprovalQueue container component"
```

---

### Task 8: ApprovalTraceEvents Component

**Files:**
- Create: `apps/dashboard/src/components/approvals/ApprovalTraceEvents.tsx`

Mini vertical timeline showing trace events. Color-coded by event type category.

- [ ] **Step 1: Create ApprovalTraceEvents.tsx**

```tsx
import { cn } from '@/lib/utils';

interface TraceEvent {
  id: string;
  event_type: string;
  actor_type: string;
  actor_name: string;
  description: string;
  status: string;
  timestamp: string;
}

const eventTypeColors: Record<string, string> = {
  // Policy events — blue
  policy_evaluated: 'bg-accent-blue',
  sensitive_operation_detected: 'bg-accent-blue',
  // Approval events — amber
  approval_required: 'bg-accent-amber',
  approval_requested: 'bg-accent-amber',
  // Execution/success events — green
  approval_granted: 'bg-accent-green',
  operation_executed: 'bg-accent-green',
  trace_initiated: 'bg-accent-green',
  identity_resolved: 'bg-accent-green',
  delegation_resolved: 'bg-accent-green',
  trace_closed: 'bg-accent-green',
  // Denial events — red
  approval_denied: 'bg-accent-red',
  operation_blocked: 'bg-accent-red',
};

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function ApprovalTraceEvents({ events }: { events: TraceEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-text-muted">No trace events recorded.</p>
    );
  }

  return (
    <div className="relative pl-4">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />

      <div className="flex flex-col gap-3">
        {events.map((event) => (
          <div key={event.id} className="relative flex items-start gap-3">
            {/* Dot */}
            <div
              className={cn(
                'relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                eventTypeColors[event.event_type] ?? 'bg-surface-2',
              )}
            />

            {/* Content */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-muted">
                  {formatTimestamp(event.timestamp)}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {formatEventType(event.event_type)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                {event.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/approvals/ApprovalTraceEvents.tsx
git commit -m "feat(dashboard): add ApprovalTraceEvents timeline component"
```

---

### Task 9: ApprovalDetailSections Component

**Files:**
- Create: `apps/dashboard/src/components/approvals/ApprovalDetailSections.tsx`

All 7 sections of the detail view. Receives the full `ApprovalDetailResponse` and renders sections 1-5 and 7 (section 6 — reviewer action — is a separate component).

- [ ] **Step 1: Create ApprovalDetailSections.tsx**

```tsx
import { relativeTime } from '@/lib/format';
import { ApprovalStatusBadge, DataClassificationBadge } from './ApprovalStatusBadge';
import { ApprovalTraceEvents } from './ApprovalTraceEvents';
import type { ApprovalDetailResponse } from '@/lib/api-client';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function SodBadge({ check }: { check: string }) {
  const colors: Record<string, string> = {
    pass: 'bg-accent-green/20 text-accent-green',
    fail: 'bg-accent-red/20 text-accent-red',
    not_applicable: 'bg-surface-2 text-text-muted',
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[check] ?? colors.not_applicable}`}>
      {formatLabel(check)}
    </span>
  );
}

export function ApprovalDetailSections({ data }: { data: ApprovalDetailResponse }) {
  return (
    <div className="flex flex-col gap-0">
      {/* Section 1: Request Summary */}
      <section className="border-b border-border px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Request Summary
        </h3>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-foreground">
              {data.requested_operation}
            </span>
            <span className="text-sm text-text-muted">→</span>
            <span className="font-mono text-sm text-foreground">
              {data.target_integration}
            </span>
          </div>
          <div className="font-mono text-xs text-text-muted">
            {data.resource_scope}
          </div>
          <div className="flex items-center gap-2">
            <ApprovalStatusBadge status={data.status} />
            <DataClassificationBadge classification={data.data_classification} />
          </div>
          <div className="text-xs text-text-muted">
            Requested {relativeTime(data.requested_at)}
          </div>
        </div>
      </section>

      {/* Section 2: Authority Context */}
      <section className="border-b border-border px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Authority Context
        </h3>
        <div className="mt-3 space-y-1.5">
          <div className="text-sm text-foreground">
            {data.agent.owner_name}{' '}
            <span className="text-text-secondary">({data.agent.owner_role})</span>
          </div>
          <div className="text-sm text-text-secondary">
            Authority: {formatLabel(data.agent.authority_model)} — Delegation: {formatLabel(data.agent.delegation_model)}
          </div>
          {data.delegated_from && (
            <div className="text-sm text-text-secondary">
              Acting on behalf of {data.delegated_from}
            </div>
          )}
          <div className="text-xs text-text-muted">
            Team: {data.agent.team}
          </div>
        </div>
      </section>

      {/* Section 3: Why This Was Flagged (VISUAL ANCHOR) */}
      <section className="border-b border-border border-l-4 border-l-accent-amber bg-surface-2 px-6 py-5">
        <h3 className="text-base font-medium text-foreground">
          Why This Was Flagged
        </h3>
        <div className="mt-3 space-y-2">
          <div className="text-sm font-medium text-foreground">
            {data.policy_rule.policy_name}
          </div>
          <p className="text-sm text-text-secondary">
            {data.policy_rule.rationale}
          </p>
          <div className="font-mono text-xs text-text-muted">
            Policy v{data.policy_rule.policy_version}
          </div>
        </div>
      </section>

      {/* Section 4: Context Snapshot */}
      <section className="border-b border-border px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Context Snapshot
        </h3>
        <div className="mt-3">
          {data.context_snapshot ? (
            <pre className="overflow-x-auto rounded bg-surface-1 p-3 font-mono text-xs text-text-secondary">
              {JSON.stringify(data.context_snapshot, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-text-muted">
              No context provided by the agent
            </p>
          )}
        </div>
      </section>

      {/* Section 5: Trace So Far */}
      <section className="border-b border-border px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Trace So Far
        </h3>
        <div className="mt-3">
          <ApprovalTraceEvents events={data.trace_events} />
        </div>
      </section>

      {/* Section 7: Governance Metadata */}
      <section className="px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Governance Metadata
        </h3>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Trace ID:</span>
            <span className="font-mono text-xs text-text-secondary">{data.trace_id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Policy version:</span>
            <span className="font-mono text-xs text-text-secondary">
              v{data.policy_rule.policy_version}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Requested at:</span>
            <span className="font-mono text-xs text-text-secondary">
              {data.requested_at}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Separation of duties:</span>
            <SodBadge check={data.separation_of_duties_check} />
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/approvals/ApprovalDetailSections.tsx
git commit -m "feat(dashboard): add ApprovalDetailSections with all 7 detail sections"
```

---

### Task 10: ApprovalReviewerAction Component

**Files:**
- Create: `apps/dashboard/src/components/approvals/ApprovalReviewerAction.tsx`

Approve/Deny buttons with optional note textarea. Calls API, shows toast on success, handles 409 and 403 errors.

- [ ] **Step 1: Create ApprovalReviewerAction.tsx**

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';

interface ApprovalReviewerActionProps {
  approvalId: string;
  status: string;
  onComplete: () => void;
}

export function ApprovalReviewerAction({
  approvalId,
  status,
  onComplete,
}: ApprovalReviewerActionProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null);

  if (status !== 'pending') {
    return null;
  }

  const handleAction = async (action: 'approve' | 'deny') => {
    setLoading(action);
    try {
      const body: { approver_name: string; decision_note?: string } = {
        // TODO(P3.4): Use actual authenticated user name
        approver_name: 'Dashboard User',
      };
      if (note.trim()) {
        body.decision_note = note.trim();
      }

      if (action === 'approve') {
        await api.approveRequest(approvalId, body);
        toast.success('Approved');
      } else {
        await api.denyRequest(approvalId, body);
        toast.success('Denied');
      }

      onComplete();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error('This approval has already been decided');
          onComplete();
        } else if (err.status === 403) {
          toast.error('Agent owner cannot self-approve');
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="border-t border-border px-6 py-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
        Reviewer Action
      </h3>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        rows={3}
        className="mt-3 w-full resize-none rounded border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="mt-3 flex gap-3">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading !== null}
          className="rounded bg-accent-green/80 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={() => handleAction('deny')}
          disabled={loading !== null}
          className="rounded bg-accent-red/80 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-red disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'deny' ? 'Denying...' : 'Deny'}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/approvals/ApprovalReviewerAction.tsx
git commit -m "feat(dashboard): add ApprovalReviewerAction with approve/deny and error handling"
```

---

### Task 11: ApprovalDetail Component

**Files:**
- Create: `apps/dashboard/src/components/approvals/ApprovalDetail.tsx`

Wraps `SlideOverPanel`. When opened, fetches `GET /api/v1/approvals/:id`. Renders `ApprovalDetailSections` + `ApprovalReviewerAction`.

- [ ] **Step 1: Create ApprovalDetail.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { SlideOverPanel } from '@/components/ui/SlideOverPanel';
import { ApprovalDetailSections } from './ApprovalDetailSections';
import { ApprovalReviewerAction } from './ApprovalReviewerAction';
import { api } from '@/lib/api-client';
import type { ApprovalDetailResponse } from '@/lib/api-client';

interface ApprovalDetailProps {
  approvalId: string | null;
  onClose: () => void;
  onActionComplete: () => void;
}

export function ApprovalDetail({
  approvalId,
  onClose,
  onActionComplete,
}: ApprovalDetailProps) {
  const [data, setData] = useState<ApprovalDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!approvalId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    api
      .getApproval(approvalId)
      .then((result) => {
        setData(result);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load approval');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [approvalId]);

  const handleComplete = () => {
    onClose();
    onActionComplete();
  };

  return (
    <SlideOverPanel
      isOpen={approvalId !== null}
      onClose={onClose}
      title="Approval Detail"
    >
      {loading && (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-text-muted">Loading approval details...</p>
        </div>
      )}

      {error && (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-accent-red">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          <ApprovalDetailSections data={data} />
          <ApprovalReviewerAction
            approvalId={data.id}
            status={data.status}
            onComplete={handleComplete}
          />
        </>
      )}
    </SlideOverPanel>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/approvals/ApprovalDetail.tsx
git commit -m "feat(dashboard): add ApprovalDetail slide-over panel"
```

---

### Task 12: Approvals Page

**Files:**
- Create: `apps/dashboard/src/app/dashboard/approvals/page.tsx`

Page-level component. Manages state for: approvals list, polling, selected ID, filters, and sort. Composes all components.

- [ ] **Step 1: Create page.tsx**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { ApprovalListItem } from '@/lib/api-client';
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue';
import { ApprovalQueueFilters } from '@/components/approvals/ApprovalQueueFilters';
import type { SortOption } from '@/components/approvals/ApprovalQueueFilters';
import { ApprovalDetail } from '@/components/approvals/ApprovalDetail';

const PAGE_LIMIT = 20;
const POLL_INTERVAL = 5000;

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_LIMIT, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sortBy, setSortBy] = useState<SortOption>('oldest');
  const [offset, setOffset] = useState(0);

  const fetchApprovals = useCallback(async () => {
    try {
      const result = await api.listApprovals({
        status: statusFilter || undefined,
        limit: PAGE_LIMIT,
        offset,
      });
      setApprovals(result.data);
      setPagination(result.pagination);
    } catch {
      // Silently fail on poll errors — data stays stale until next poll
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset]);

  // Fetch on mount and on filter/offset change
  useEffect(() => {
    setLoading(true);
    fetchApprovals();
  }, [fetchApprovals]);

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchApprovals, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const handleActionComplete = () => {
    setSelectedId(null);
    fetchApprovals();
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setOffset(0);
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">Approvals</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Review and decide on pending agent approval requests.
          </p>
        </div>
        <ApprovalQueueFilters
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </div>

      <div className="mt-6">
        <ApprovalQueue
          approvals={approvals}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          sortBy={sortBy}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      </div>

      <ApprovalDetail
        approvalId={selectedId}
        onClose={() => setSelectedId(null)}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify dev server starts**

Run: `cd apps/dashboard && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors. The page at `/dashboard/approvals` should be compiled.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/app/dashboard/approvals/page.tsx
git commit -m "feat(dashboard): add approvals page with queue, detail panel, and polling"
```

---

## Verification Checklist

After all tasks are complete, verify against the acceptance criteria:

1. **Build passes:** `cd apps/dashboard && npx next build` — no errors
2. **No hydration risks:** All components that use browser APIs (`useEffect`, `useState`, event handlers) are marked `'use client'`
3. **Design tokens:** Grep for raw Tailwind colors (`text-gray-`, `bg-zinc-`, `text-red-500` etc.) — should find zero matches in new files. All colors use design token classes (`text-foreground`, `bg-surface-1`, `text-accent-amber`, etc.)
4. **Monospace font:** Trace IDs, timestamps, technical data all use `font-mono`
5. **File naming:** Components in PascalCase (matching existing `DashboardSidebar.tsx` convention), utility in kebab-case

Run these verification commands:
```bash
cd apps/dashboard && npx next build
grep -rn 'text-gray-\|bg-gray-\|text-red-[0-9]\|bg-blue-[0-9]\|text-green-' src/components/approvals/ src/app/dashboard/approvals/ || echo "OK: no raw Tailwind colors"
grep -rn 'font-mono' src/components/approvals/ | head -20
```
