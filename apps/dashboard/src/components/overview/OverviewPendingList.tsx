'use client';

import Link from 'next/link';
import { ApprovalRiskBadge } from '@/components/approvals/ApprovalRiskBadge';

interface PendingApproval {
  id: string;
  agent_name: string;
  operation: string;
  risk_classification: string | null;
  requested_at: string;
  time_pending_seconds: number;
}

interface OverviewPendingListProps {
  approvals: PendingApproval[];
}

function formatRelativeTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function OverviewPendingList({ approvals }: OverviewPendingListProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-5">
      <h3 className="mb-3 text-[13px] font-medium text-foreground">
        Pending Approvals
      </h3>

      {approvals.length === 0 ? (
        <p className="text-xs text-text-muted">No pending approvals</p>
      ) : (
        <div className="space-y-1">
          {approvals.map((approval) => (
            <Link
              key={approval.id}
              href="/dashboard/approvals"
              className="flex items-center justify-between rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-surface-2/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-text-secondary">
                  {approval.operation}
                </span>
                <ApprovalRiskBadge
                  risk={
                    approval.risk_classification as
                      | 'low'
                      | 'medium'
                      | 'high'
                      | 'critical'
                      | null
                  }
                />
              </div>
              <span className="text-xs text-text-muted">
                {formatRelativeTime(approval.time_pending_seconds)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <Link
          href="/dashboard/approvals"
          className="text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          View all approvals →
        </Link>
      </div>
    </div>
  );
}
