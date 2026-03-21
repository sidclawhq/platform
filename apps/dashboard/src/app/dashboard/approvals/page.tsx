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
