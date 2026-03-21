import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-accent-amber/20 text-accent-amber',
  approved: 'bg-accent-green/20 text-accent-green',
  denied: 'bg-accent-red/20 text-accent-red',
  expired: 'bg-surface-2 text-text-muted',
};

const classificationColors: Record<string, string> = {
  public: 'bg-surface-2 text-text-muted',
  internal: 'bg-accent-blue/20 text-accent-blue',
  confidential: 'bg-accent-amber/20 text-accent-amber',
  restricted: 'bg-accent-red/20 text-accent-red',
};

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ApprovalStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        statusColors[status] ?? 'bg-surface-2 text-text-muted',
      )}
    >
      {formatLabel(status)}
    </span>
  );
}

export function DataClassificationBadge({ classification }: { classification: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        classificationColors[classification] ?? 'bg-surface-2 text-text-muted',
      )}
    >
      {formatLabel(classification)}
    </span>
  );
}
