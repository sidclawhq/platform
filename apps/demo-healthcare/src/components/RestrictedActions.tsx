'use client';

import { AI_ANALYSIS } from '@/lib/demo-tools';
import { ClinicalActionButton } from './ClinicalActionButton';

interface ActionState {
  status: 'idle' | 'loading' | 'awaiting' | 'done' | 'blocked';
}

interface RestrictedActionsProps {
  actionStates: Record<string, ActionState>;
  onAction: (actionId: string) => void;
}

export function RestrictedActions({ actionStates, onAction }: RestrictedActionsProps) {
  const deniedActions = AI_ANALYSIS.recommendations.filter(
    (r) => r.id === 'prescribe-bp' || r.id === 'modify-treatment'
  );

  return (
    <div className="rounded-lg border border-[#EF4444]/10 bg-[#111113] p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[#EF4444]">
        Requires Physician Action (blocked for AI)
      </div>

      <div className="grid grid-cols-2 gap-3">
        {deniedActions.map((rec) => (
          <ClinicalActionButton
            key={rec.id}
            icon={rec.id === 'prescribe-bp' ? '\uD83D\uDC8A' : '\uD83D\uDCDD'}
            label={rec.action}
            sublabel={rec.rationale}
            variant="denied"
            loading={actionStates[rec.id]?.status === 'loading'}
            status={actionStates[rec.id]?.status}
            onClick={() => onAction(rec.id)}
          />
        ))}
      </div>
    </div>
  );
}
