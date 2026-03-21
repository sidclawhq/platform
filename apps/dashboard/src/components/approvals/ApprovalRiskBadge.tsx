import { cn } from '@/lib/utils';

interface ApprovalRiskBadgeProps {
  risk: 'low' | 'medium' | 'high' | 'critical' | null;
}

const riskColors: Record<string, string> = {
  low: 'bg-text-muted/10 text-text-muted',
  medium: 'bg-accent-blue/10 text-accent-blue',
  high: 'bg-accent-amber/10 text-accent-amber',
  critical: 'bg-accent-red/10 text-accent-red',
};

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ApprovalRiskBadge({ risk }: ApprovalRiskBadgeProps) {
  if (!risk) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase',
        riskColors[risk] ?? 'bg-text-muted/10 text-text-muted',
      )}
    >
      {formatLabel(risk)}
    </span>
  );
}
