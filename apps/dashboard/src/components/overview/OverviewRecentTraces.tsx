'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface RecentTrace {
  trace_id: string;
  agent_name: string;
  operation: string;
  final_outcome: string;
  started_at: string;
}

interface OverviewRecentTracesProps {
  traces: RecentTrace[];
}

const outcomeColors: Record<string, string> = {
  executed: 'bg-accent-green/10 text-accent-green',
  completed_with_approval: 'bg-accent-green/10 text-accent-green',
  blocked: 'bg-accent-red/10 text-accent-red',
  denied: 'bg-accent-red/10 text-accent-red',
  expired: 'bg-accent-amber/10 text-accent-amber',
  pending: 'bg-accent-blue/10 text-accent-blue',
  in_progress: 'bg-accent-blue/10 text-accent-blue',
};

function formatOutcome(outcome: string): string {
  return outcome.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function OverviewRecentTraces({ traces }: OverviewRecentTracesProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-5">
      <h3 className="mb-3 text-[13px] font-medium text-foreground">
        Recent Traces
      </h3>

      {traces.length === 0 ? (
        <p className="text-xs text-text-muted">No recent traces</p>
      ) : (
        <div className="space-y-1">
          {traces.map((trace) => (
            <Link
              key={trace.trace_id}
              href="/dashboard/audit"
              className="flex items-center justify-between rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-surface-2/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-text-secondary">{trace.operation}</span>
                <span
                  className={cn(
                    'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
                    outcomeColors[trace.final_outcome] ??
                      'bg-text-muted/10 text-text-muted',
                  )}
                >
                  {formatOutcome(trace.final_outcome)}
                </span>
              </div>
              <span className="text-xs text-text-muted">
                {formatRelativeTime(trace.started_at)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <Link
          href="/dashboard/audit"
          className="text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          View all traces →
        </Link>
      </div>
    </div>
  );
}
