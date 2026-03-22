'use client';

interface AgentActionButtonProps {
  icon: string;
  label: string;
  sublabel: string;
  risk: 'low' | 'medium' | 'high';
  loading: boolean;
  disabled?: boolean;
  status?: 'idle' | 'loading' | 'awaiting' | 'done' | 'blocked';
  onClick: () => void;
}

const RISK_DOT: Record<string, string> = {
  low: 'bg-[#22C55E]',
  medium: 'bg-[#F59E0B]',
  high: 'bg-[#EF4444]',
};

export function AgentActionButton({ icon, label, sublabel, risk, loading, disabled, status = 'idle', onClick }: AgentActionButtonProps) {
  const isBlocked = status === 'blocked';
  const isAwaiting = status === 'awaiting';
  const isDone = status === 'done';

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled || isAwaiting || isDone}
      className={`relative rounded-lg border p-3 text-left transition-all ${
        isBlocked
          ? 'border-[#EF4444]/30 bg-[#EF4444]/5 animate-pulse'
          : isAwaiting
          ? 'border-[#F59E0B]/30 bg-[#F59E0B]/5'
          : isDone
          ? 'border-[#22C55E]/30 bg-[#22C55E]/5'
          : 'border-[#2A2A2E] bg-[#1A1A1D] hover:border-[#3B82F6]/40'
      } disabled:opacity-60`}
    >
      {/* Risk dot */}
      <div className={`absolute top-2 right-2 h-1.5 w-1.5 rounded-full ${RISK_DOT[risk]}`} />

      <div className="flex items-start gap-2.5">
        <span className="text-base flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#E4E4E7]">
            {loading ? 'Evaluating...' : isAwaiting ? 'Awaiting approval...' : isDone ? 'Completed' : isBlocked ? 'Blocked by policy' : label}
          </div>
          <div className="text-xs text-[#71717A] mt-0.5">{sublabel}</div>
        </div>
      </div>
    </button>
  );
}
