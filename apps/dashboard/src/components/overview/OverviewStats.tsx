'use client';

import { cn } from '@/lib/utils';

interface OverviewStatsProps {
  stats: {
    total_agents: number;
    active_agents: number;
    total_policies: number;
    pending_approvals: number;
    traces_today: number;
    traces_this_week: number;
    avg_approval_time_minutes: number | null;
  };
}

interface StatCardProps {
  label: string;
  value: number | string;
  highlight?: boolean;
}

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <div
        className={cn(
          'text-2xl font-semibold',
          highlight ? 'text-accent-amber' : 'text-foreground',
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-text-muted">
        {label}
      </div>
    </div>
  );
}

export function OverviewStats({ stats }: OverviewStatsProps) {
  return (
    <div className="grid grid-cols-7 gap-4">
      <StatCard label="Agents" value={stats.total_agents} />
      <StatCard label="Active" value={stats.active_agents} />
      <StatCard label="Policies" value={stats.total_policies} />
      <StatCard
        label="Pending"
        value={stats.pending_approvals}
        highlight={stats.pending_approvals > 0}
      />
      <StatCard label="Today" value={stats.traces_today} />
      <StatCard label="This Week" value={stats.traces_this_week} />
      <StatCard
        label="Avg Approval"
        value={
          stats.avg_approval_time_minutes !== null
            ? `${stats.avg_approval_time_minutes} min`
            : '—'
        }
      />
    </div>
  );
}
