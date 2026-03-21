'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { ApprovalListItem, ApprovalListMeta } from '@/lib/api-client';
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue';
import { ApprovalQueueFilters } from '@/components/approvals/ApprovalQueueFilters';
import type { SortOption } from '@/components/approvals/ApprovalQueueFilters';
import { ApprovalDetail } from '@/components/approvals/ApprovalDetail';

const PAGE_LIMIT = 20;
const POLL_INTERVAL = 5000;

function formatOldestPending(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function QueueSummaryHeader({ meta, total }: { meta: ApprovalListMeta; total: number }) {
  const { count_by_risk, oldest_pending_seconds } = meta;
  const oldestIsStale = oldest_pending_seconds !== null && oldest_pending_seconds >= 14400; // 240 minutes

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface-1 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {total} pending approval{total !== 1 ? 's' : ''}
        </span>
        {oldest_pending_seconds !== null && (
          <span className={`text-xs ${oldestIsStale ? 'text-accent-red' : 'text-text-muted'}`}>
            Oldest: {formatOldestPending(oldest_pending_seconds)}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-4 text-xs">
        <span className="text-accent-red">Critical: {count_by_risk.critical}</span>
        <span className="text-accent-amber">High: {count_by_risk.high}</span>
        <span className="text-accent-blue">Medium: {count_by_risk.medium}</span>
        <span className="text-text-muted">Low: {count_by_risk.low}</span>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_LIMIT, offset: 0 });
  const [meta, setMeta] = useState<ApprovalListMeta | null>(null);
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
      setMeta(result.meta);
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

      {meta && statusFilter === 'pending' && (
        <QueueSummaryHeader meta={meta} total={pagination.total} />
      )}

      <div className="mt-4">
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
