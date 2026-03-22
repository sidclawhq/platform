'use client';

import { cn } from '@/lib/utils';

const effectStyles: Record<string, string> = {
  allow: 'bg-accent-green/10 text-accent-green',
  approval_required: 'bg-accent-amber/10 text-accent-amber',
  deny: 'bg-accent-red/10 text-accent-red',
};

const effectLabels: Record<string, string> = {
  allow: 'Allow',
  approval_required: 'Approval Required',
  deny: 'Deny',
};

export function PolicyEffectBadge({ effect }: { effect: string }) {
  return (
    <span
      data-testid="effect-badge"
      className={cn(
        'inline-flex items-center text-xs px-2 py-0.5 rounded',
        effectStyles[effect] ?? 'bg-surface-2 text-text-muted',
      )}
    >
      {effectLabels[effect] ?? effect}
    </span>
  );
}
