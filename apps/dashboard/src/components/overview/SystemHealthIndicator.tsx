'use client';

import { cn } from '@/lib/utils';

interface SystemHealthIndicatorProps {
  health: {
    api: 'healthy' | 'degraded';
    database: 'healthy' | 'degraded' | 'unreachable';
    background_jobs: 'healthy' | 'stale';
  };
}

const statusConfig: Record<string, { color: string; label: string }> = {
  healthy: { color: 'bg-accent-green', label: 'Healthy' },
  degraded: { color: 'bg-accent-amber', label: 'Degraded' },
  unreachable: { color: 'bg-accent-red', label: 'Unreachable' },
  stale: { color: 'bg-accent-amber', label: 'Stale' },
};

function HealthDot({ status, label }: { status: string; label: string }) {
  const config = statusConfig[status] ?? statusConfig.healthy!;
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', config.color)} />
      <span className="text-xs text-text-secondary">{label}:</span>
      <span className="text-xs text-text-muted">{config.label}</span>
    </div>
  );
}

export function SystemHealthIndicator({ health }: SystemHealthIndicatorProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <h3 className="mb-3 text-[13px] font-medium text-foreground">
        System Health
      </h3>
      <div className="flex items-center gap-6">
        <HealthDot status={health.api} label="API" />
        <HealthDot status={health.database} label="Database" />
        <HealthDot status={health.background_jobs} label="Jobs" />
      </div>
    </div>
  );
}
