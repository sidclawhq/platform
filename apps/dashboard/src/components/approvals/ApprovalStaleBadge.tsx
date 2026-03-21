'use client';

import { relativeTime } from '@/lib/format';

type StaleLevel = 'fresh' | 'aging' | 'stale' | 'critical';

function getStaleLevel(requestedAt: string | Date): StaleLevel {
  const minutesPending = (Date.now() - new Date(requestedAt).getTime()) / 60000;
  if (minutesPending < 15) return 'fresh';
  if (minutesPending < 60) return 'aging';
  if (minutesPending < 240) return 'stale';
  return 'critical';
}

function formatPendingDuration(requestedAt: string | Date): string {
  const minutes = Math.floor((Date.now() - new Date(requestedAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m pending`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h pending`;
  return `${Math.floor(hours / 24)}d pending`;
}

interface ApprovalStaleBadgeProps {
  requestedAt: string | Date;
}

export function ApprovalStaleBadge({ requestedAt }: ApprovalStaleBadgeProps) {
  const level = getStaleLevel(requestedAt);

  switch (level) {
    case 'fresh':
      return (
        <span className="text-xs text-text-muted">
          {relativeTime(requestedAt)}
        </span>
      );
    case 'aging':
      return (
        <span className="text-xs text-text-secondary">
          {relativeTime(requestedAt)}
        </span>
      );
    case 'stale':
      return (
        <span className="rounded bg-accent-amber/10 px-1.5 py-0.5 text-xs text-accent-amber">
          {formatPendingDuration(requestedAt)}
        </span>
      );
    case 'critical':
      return (
        <span className="rounded bg-accent-red/10 px-1.5 py-0.5 text-xs text-accent-red">
          {formatPendingDuration(requestedAt)}
        </span>
      );
  }
}
