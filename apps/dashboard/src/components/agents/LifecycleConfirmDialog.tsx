'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type LifecycleAction = 'suspend' | 'revoke' | 'reactivate';

const actionConfig: Record<LifecycleAction, {
  title: (name: string) => string;
  description: string;
  confirmLabel: string;
  confirmStyle: string;
}> = {
  suspend: {
    title: (name) => `Suspend ${name}?`,
    description:
      'All pending evaluations will be denied. The agent can be reactivated later.',
    confirmLabel: 'Suspend',
    confirmStyle: 'bg-accent-amber text-white hover:bg-accent-amber/90',
  },
  revoke: {
    title: (name) => `Revoke ${name}?`,
    description:
      'This is permanent — the agent cannot be reactivated. All pending evaluations will be denied.',
    confirmLabel: 'Revoke',
    confirmStyle: 'bg-accent-red text-white hover:bg-accent-red/90',
  },
  reactivate: {
    title: (name) => `Reactivate ${name}?`,
    description:
      'The agent will resume normal policy evaluation.',
    confirmLabel: 'Reactivate',
    confirmStyle: 'bg-accent-green text-white hover:bg-accent-green/90',
  },
};

interface LifecycleConfirmDialogProps {
  open: boolean;
  action: LifecycleAction;
  agentName: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LifecycleConfirmDialog({
  open,
  action,
  agentName,
  loading,
  onConfirm,
  onCancel,
}: LifecycleConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const config = actionConfig[action];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md bg-surface-1 border border-border rounded-lg p-6"
      >
        <h3 className="text-base font-medium text-foreground">
          {config.title(agentName)}
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          {config.description}
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded px-4 py-1.5 text-sm font-medium bg-surface-2 text-text-secondary hover:bg-surface-2/80 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              'rounded px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
              config.confirmStyle,
            )}
          >
            {loading ? 'Processing…' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
