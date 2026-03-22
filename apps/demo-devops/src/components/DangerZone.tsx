'use client';

interface DangerZoneProps {
  actionStates: Record<string, { status: string }>;
  onAction: (actionId: string) => void;
}

export function DangerZone({ actionStates, onAction }: DangerZoneProps) {
  const getStatus = (id: string) => actionStates[id]?.status ?? 'idle';

  return (
    <div className="rounded-lg border border-[#EF4444]/20 bg-[#111113] p-4">
      <div className="mb-1 text-sm font-medium text-[#EF4444]">Danger Zone</div>
      <p className="text-xs text-[#71717A] mb-3">These actions are blocked by governance policy</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onAction('delete-namespace')}
          disabled={getStatus('delete-namespace') === 'loading'}
          className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
            getStatus('delete-namespace') === 'blocked'
              ? 'border-[#EF4444]/40 bg-[#EF4444]/10'
              : 'border-[#EF4444]/20 hover:bg-[#EF4444]/5'
          }`}
        >
          <div className="text-sm text-[#EF4444]">🗑 Delete load-test-march</div>
          <div className="text-xs text-[#71717A] mt-0.5">Namespace • 6 services, 30 pods</div>
        </button>
        <button
          onClick={() => onAction('rotate-secrets')}
          disabled={getStatus('rotate-secrets') === 'loading'}
          className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
            getStatus('rotate-secrets') === 'blocked'
              ? 'border-[#EF4444]/40 bg-[#EF4444]/10'
              : 'border-[#EF4444]/20 hover:bg-[#EF4444]/5'
          }`}
        >
          <div className="text-sm text-[#EF4444]">🔑 Rotate payment-processor secrets</div>
          <div className="text-xs text-[#71717A] mt-0.5">Credential rotation • production</div>
        </button>
      </div>
    </div>
  );
}
