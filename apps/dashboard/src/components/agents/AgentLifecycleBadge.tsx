import { cn } from '@/lib/utils';

const lifecycleConfig: Record<string, { label: string; dot: string; badge: string }> = {
  active: {
    label: 'Active',
    dot: 'bg-accent-green',
    badge: 'bg-accent-green/10 text-accent-green',
  },
  suspended: {
    label: 'Suspended',
    dot: 'bg-accent-amber',
    badge: 'bg-accent-amber/10 text-accent-amber',
  },
  revoked: {
    label: 'Revoked',
    dot: 'bg-accent-red',
    badge: 'bg-accent-red/10 text-accent-red',
  },
};

export function AgentLifecycleBadge({ state }: { state: string }) {
  const config = lifecycleConfig[state] ?? lifecycleConfig.active!;
  const { label, dot, badge } = config!;

  return (
    <span
      data-testid="lifecycle-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        badge,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}
