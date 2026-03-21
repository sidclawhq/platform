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
