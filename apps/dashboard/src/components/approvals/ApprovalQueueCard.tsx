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
