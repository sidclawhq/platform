'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';
import type { AgentSummary } from '@/lib/api-client';
import { AgentLifecycleBadge } from './AgentLifecycleBadge';

type SortKey = 'name' | 'owner_name' | 'environment' | 'lifecycle_state' | 'updated_at';
type SortDir = 'asc' | 'desc';

const envBadgeStyles: Record<string, string> = {
  dev: 'bg-surface-2 text-text-secondary',
  test: 'bg-accent-blue/10 text-accent-blue',
  prod: 'bg-accent-amber/10 text-accent-amber',
};

interface Column {
  key: string;
  label: string;
  sortable: boolean;
  width: string;
}

const columns: Column[] = [
  { key: 'name', label: 'Name', sortable: true, width: 'flex-1' },
  { key: 'owner_name', label: 'Owner', sortable: true, width: 'w-[160px]' },
  { key: 'environment', label: 'Environment', sortable: true, width: 'w-[100px]' },
  { key: 'authority_model', label: 'Authority', sortable: false, width: 'w-[120px]' },
  { key: 'lifecycle_state', label: 'Lifecycle', sortable: true, width: 'w-[110px]' },
  { key: 'autonomy_tier', label: 'Autonomy', sortable: false, width: 'w-[100px]' },
  { key: 'updated_at', label: 'Last Activity', sortable: true, width: 'w-[130px]' },
];

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface AgentTableProps {
  agents: AgentSummary[];
}

export function AgentTable({ agents }: AgentTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortable) return;
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    const copy = [...agents];
    copy.sort((a, b) => {
      const aVal = (a[sortKey as keyof AgentSummary] as string) ?? '';
      const bVal = (b[sortKey as keyof AgentSummary] as string) ?? '';
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [agents, sortKey, sortDir]);

  return (
    <div data-testid="agent-table" className="overflow-hidden rounded-lg border border-border bg-surface-0">
      {/* Header */}
      <div className="flex items-center border-b border-border px-4 py-2.5">
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn(
              'text-xs font-medium uppercase tracking-wider text-text-muted',
              col.width,
              col.sortable && 'cursor-pointer select-none hover:text-text-secondary',
            )}
            onClick={() => handleSort(col.key)}
          >
            <span className="inline-flex items-center gap-1">
              {col.label}
              {col.sortable && sortKey === col.key && (
                sortDir === 'asc' ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      {sorted.map((agent, i) => (
        <button
          key={agent.id}
          data-testid="agent-row"
          type="button"
          onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
          className={cn(
            'flex w-full items-center px-4 py-3 text-left transition-colors hover:bg-surface-2',
            i % 2 === 1 && 'bg-surface-1/50',
          )}
        >
          {/* Name */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground truncate block">
              {agent.name}
            </span>
          </div>

          {/* Owner */}
          <div className="w-[160px]">
            <span className="text-sm text-text-primary truncate block">{agent.owner_name}</span>
          </div>

          {/* Environment */}
          <div className="w-[100px]">
            <span
              className={cn(
                'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                envBadgeStyles[agent.environment] ?? envBadgeStyles.dev,
              )}
            >
              {agent.environment}
            </span>
          </div>

          {/* Authority */}
          <div className="w-[120px]">
            <span className="text-sm text-text-primary">{formatLabel(agent.authority_model)}</span>
          </div>

          {/* Lifecycle */}
          <div className="w-[110px]">
            <AgentLifecycleBadge state={agent.lifecycle_state} />
          </div>

          {/* Autonomy */}
          <div className="w-[100px]">
            <span className="text-sm text-text-primary">{formatLabel(agent.autonomy_tier)}</span>
          </div>

          {/* Last Activity */}
          <div className="w-[130px]">
            <span className="text-sm text-text-muted">
              {agent.updated_at ? relativeTime(agent.updated_at) : '—'}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
