'use client';

interface ClinicalActionButtonProps {
  icon: string;
  label: string;
  sublabel: string;
  variant: 'approval' | 'denied';
  loading: boolean;
  disabled?: boolean;
  status?: 'idle' | 'loading' | 'awaiting' | 'done' | 'blocked';
  onClick: () => void;
}

export function ClinicalActionButton({ icon, label, sublabel, variant, loading, disabled, status = 'idle', onClick }: ClinicalActionButtonProps) {
  const isBlocked = status === 'blocked';
  const isAwaiting = status === 'awaiting';
  const isDone = status === 'done';

  const baseClass = variant === 'denied'
    ? 'border-[#EF4444]/20 hover:border-[#EF4444]/40'
    : 'border-[#2A2A2E] hover:border-[#3B82F6]/50';

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled || isAwaiting || isDone}
      className={`relative rounded-lg border p-3 text-left transition-all bg-[#1A1A1D] ${
        isBlocked
          ? 'border-[#EF4444]/30 bg-[#EF4444]/5 animate-pulse'
          : isAwaiting
          ? 'border-[#F59E0B]/30 bg-[#F59E0B]/5'
          : isDone
          ? 'border-[#22C55E]/30 bg-[#22C55E]/5'
          : baseClass
      } disabled:opacity-60`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#E4E4E7]">
            {loading ? 'Evaluating...' : isAwaiting ? 'Awaiting approval...' : isDone ? 'Completed' : isBlocked ? 'Physician must order directly' : label}
          </div>
          <div className="text-xs text-[#71717A] mt-0.5">{sublabel}</div>
        </div>
      </div>
    </button>
  );
}
