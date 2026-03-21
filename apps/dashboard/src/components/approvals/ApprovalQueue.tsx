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
