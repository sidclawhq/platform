import Link from 'next/link';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';
import type { AgentDetail } from '@/lib/api-client';

const outcomeBadgeStyles: Record<string, string> = {
  executed: 'bg-accent-green/10 text-accent-green',
  denied: 'bg-accent-red/10 text-accent-red',
  approval_required: 'bg-accent-amber/10 text-accent-amber',
  pending: 'bg-accent-amber/10 text-accent-amber',
  in_progress: 'bg-accent-blue/10 text-accent-blue',
};

const approvalStatusStyles: Record<string, string> = {
  pending: 'bg-accent-amber/10 text-accent-amber',
  approved: 'bg-accent-green/10 text-accent-green',
  denied: 'bg-accent-red/10 text-accent-red',
  expired: 'bg-surface-2 text-text-secondary',
};

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface AgentRecentActivityProps {
  agent: AgentDetail;
}

export function AgentRecentActivity({ agent }: AgentRecentActivityProps) {
  const { stats, recent_traces, recent_approvals } = agent;

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-4">
        Recent Activity
      </h2>

      {/* Stats */}
      <div className="flex items-center gap-6 mb-4">
        <div>
          <span className="text-xs text-text-muted">Traces (7 days)</span>
          <p className="text-lg font-medium text-foreground">{stats.traces_last_7_days}</p>
        </div>
        <div>
          <span className="text-xs text-text-muted">Pending Approvals</span>
          <p className={cn('text-lg font-medium', stats.pending_approvals > 0 ? 'text-accent-amber' : 'text-foreground')}>
            {stats.pending_approvals}
          </p>
        </div>
      </div>

      {/* Recent Traces */}
      {recent_traces.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs text-text-muted mb-2">Recent traces</h3>
          <div className="space-y-1.5">
            {recent_traces.slice(0, 5).map((trace) => (
              <Link
                key={trace.trace_id}
                href={`/dashboard/audit?trace=${trace.trace_id}`}
                className="flex items-center justify-between rounded px-2.5 py-1.5 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-foreground truncate">{trace.operation}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                      outcomeBadgeStyles[trace.final_outcome] ?? 'bg-surface-2 text-text-secondary',
                    )}
                  >
                    {formatLabel(trace.final_outcome)}
                  </span>
                  <span className="text-xs text-text-muted">{relativeTime(trace.started_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Approvals */}
      {recent_approvals.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs text-text-muted mb-2">Recent approvals</h3>
          <div className="space-y-1.5">
            {recent_approvals.slice(0, 3).map((approval) => (
              <Link
                key={approval.id}
                href="/dashboard/approvals"
                className="flex items-center justify-between rounded px-2.5 py-1.5 hover:bg-surface-2 transition-colors"
              >
                <span className="text-sm text-foreground truncate">{approval.operation}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                      approvalStatusStyles[approval.status] ?? 'bg-surface-2 text-text-secondary',
                    )}
                  >
                    {formatLabel(approval.status)}
                  </span>
                  <span className="text-xs text-text-muted">{relativeTime(approval.requested_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href={`/dashboard/audit?agent_id=${agent.id}`}
        className="inline-block text-sm text-foreground underline underline-offset-2 hover:text-text-secondary transition-colors"
      >
        View all traces &rarr;
      </Link>
    </div>
  );
}
