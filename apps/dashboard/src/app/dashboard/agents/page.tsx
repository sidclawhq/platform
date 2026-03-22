'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import type { AgentSummary } from '@/lib/api-client';
import { AgentFilters } from '@/components/agents/AgentFilters';
import type { AgentFilterValues } from '@/components/agents/AgentFilters';
import { AgentTable } from '@/components/agents/AgentTable';
import { AgentCreateModal } from '@/components/agents/AgentCreateModal';
import { usePermissions } from '@/lib/permissions';

const PAGE_LIMIT = 20;

const defaultFilters: AgentFilterValues = {
  environment: '',
  lifecycle_state: '',
  authority_model: '',
  autonomy_tier: '',
  search: '',
};

export default function AgentsPage() {
  const router = useRouter();
  const { canManageAgents } = usePermissions();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_LIMIT, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AgentFilterValues>(defaultFilters);
  const [offset, setOffset] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const result = await api.listAgents({
        environment: filters.environment || undefined,
        lifecycle_state: filters.lifecycle_state || undefined,
        authority_model: filters.authority_model || undefined,
        autonomy_tier: filters.autonomy_tier || undefined,
        search: filters.search || undefined,
        limit: PAGE_LIMIT,
        offset,
      });
      setAgents(result.data);
      setPagination(result.pagination);
    } catch {
      // Silently fail — data stays stale
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    setLoading(true);
    fetchAgents();
  }, [fetchAgents]);

  const handleFiltersChange = (next: AgentFilterValues) => {
    setFilters(next);
    setOffset(0);
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  const start = pagination.offset + 1;
  const end = Math.min(pagination.offset + pagination.limit, pagination.total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_LIMIT < pagination.total;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">Agent Registry</h1>
          <p className="mt-1 text-sm text-text-secondary">
            View and manage registered agents across all environments.
          </p>
        </div>
        {canManageAgents && (
          <button
            data-testid="create-agent"
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90 transition-colors"
          >
            Register Agent
          </button>
        )}
      </div>

      {showCreateModal && (
        <AgentCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(agentId) => {
            setShowCreateModal(false);
            router.push(`/dashboard/agents/${agentId}`);
          }}
        />
      )}

      <div className="mt-6">
        <AgentFilters filters={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </div>
        ) : agents.length === 0 ? (
          <div data-testid="empty-state" className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-0 py-20">
            <p className="text-sm font-medium text-text-muted">No agents found</p>
            <p className="mt-1 text-sm text-text-muted">
              Try adjusting your filters or search query.
            </p>
          </div>
        ) : (
          <>
            <AgentTable agents={agents} />

            {/* Pagination */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-text-muted">
                Showing {start}–{end} of {pagination.total} agents
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => handlePageChange(offset - PAGE_LIMIT)}
                  className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => handlePageChange(offset + PAGE_LIMIT)}
                  className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
