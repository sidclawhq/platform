'use client';

import { AI_ANALYSIS } from '@/lib/demo-tools';
import { ClinicalActionButton } from './ClinicalActionButton';

interface ActionState {
  status: 'idle' | 'loading' | 'awaiting' | 'done' | 'blocked';
}

interface AIRecommendationsProps {
  actionStates: Record<string, ActionState>;
  onAction: (actionId: string) => void;
}

export function AIRecommendations({ actionStates, onAction }: AIRecommendationsProps) {
  const approvalActions = AI_ANALYSIS.recommendations.filter(
    (r) => r.id === 'order-labs' || r.id === 'send-careplan'
  );

  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3B82F6] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3B82F6]" />
        </span>
        <h4 className="text-sm font-medium uppercase tracking-wider text-[#71717A]">AI Clinical Assistant</h4>
      </div>

      <p className="mb-4 text-base text-[#A1A1AA]">{AI_ANALYSIS.summary}</p>

      {/* Approval-required actions */}
      <div className="grid grid-cols-2 gap-3">
        {approvalActions.map((rec) => (
          <ClinicalActionButton
            key={rec.id}
            icon={rec.id === 'order-labs' ? '\uD83D\uDCCB' : '\uD83D\uDCE8'}
            label={rec.action}
            sublabel={rec.rationale}
            variant="approval"
            loading={actionStates[rec.id]?.status === 'loading'}
            status={actionStates[rec.id]?.status}
            onClick={() => onAction(rec.id)}
          />
        ))}
      </div>
    </div>
  );
}
