import type { Service, ServiceStatus } from '@/lib/demo-tools';

interface ServiceListProps {
  services: Record<string, Service>;
  selectedId: string;
  onSelect: (id: string) => void;
}

const STATUS_STYLES: Record<ServiceStatus, { dot: string; border: string; label: string }> = {
  healthy: { dot: 'bg-[#22C55E]', border: 'border-l-[#22C55E]', label: 'Healthy' },
  degraded: { dot: 'bg-[#F59E0B]', border: 'border-l-[#F59E0B]', label: 'Degraded' },
  down: { dot: 'bg-[#EF4444]', border: 'border-l-[#EF4444]', label: 'Down' },
};

export function ServiceList({ services, selectedId, onSelect }: ServiceListProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Object.values(services).map((svc) => {
        const style = STATUS_STYLES[svc.status];
        const isSelected = svc.id === selectedId;

        return (
          <button
            key={svc.id}
            onClick={() => onSelect(svc.id)}
            className={`rounded-lg border-l-2 ${style.border} px-3 py-3 text-left transition-colors ${
              isSelected
                ? 'bg-[#1A1A1D] border border-[#3B82F6]/40 border-l-2'
                : 'bg-[#111113] border border-[#2A2A2E] border-l-2 hover:border-[#3B82F6]/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${style.dot} ${svc.status === 'degraded' ? 'animate-pulse' : ''}`} />
              <span className="text-xs font-medium text-[#E4E4E7] truncate">{svc.name}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-[#71717A]">{svc.requestsPerSecond} req/s</span>
              <span className={`text-[10px] ${svc.errorRate > 1 ? 'text-[#EF4444]' : 'text-[#71717A]'}`}>
                {svc.errorRate}% err
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
