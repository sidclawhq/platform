import type { Service } from '@/lib/demo-tools';
import { MetricsBar } from './MetricsBar';

interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const statusColors: Record<string, string> = {
    healthy: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
    degraded: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
    down: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  };

  const borderColor = service.status === 'degraded' ? 'border-[#F59E0B]/30' : 'border-[#2A2A2E]';

  return (
    <div className={`rounded-lg border ${borderColor} bg-[#111113] p-4`}>
      {/* Alert banner */}
      {service.alert && (
        <div className="mb-3 rounded border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-3 py-2">
          <span className="text-xs text-[#F59E0B]">{service.alert}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#E4E4E7]">{service.name}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${statusColors[service.status]}`}>
            {service.status}
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#71717A]">{service.region}</span>
      </div>

      {/* Metrics */}
      <div className="space-y-2.5">
        <MetricsBar label="CPU" value={service.cpu} displayValue={`${service.cpu}%`} critical={service.cpu > 80} />
        <MetricsBar
          label="Memory"
          value={service.memory}
          displayValue={`${service.memoryUsed} / ${service.memoryTotal}`}
          critical={service.memory > 80}
        />
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-4 gap-3 border-t border-[#2A2A2E] pt-3">
        <div>
          <div className="text-[10px] text-[#71717A]">Error Rate</div>
          <div className={`font-mono text-xs ${service.errorRate > 1 ? 'text-[#EF4444]' : 'text-[#E4E4E7]'}`}>
            {service.errorRate}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717A]">Req/s</div>
          <div className="font-mono text-xs text-[#E4E4E7]">{service.requestsPerSecond.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717A]">Instances</div>
          <div className="font-mono text-xs text-[#E4E4E7]">{service.instances}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#71717A]">Version</div>
          <div className="font-mono text-xs text-[#E4E4E7]">{service.version}</div>
        </div>
      </div>

      {/* Uptime row */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-[#71717A]">
        <span>Uptime: {service.uptime}</span>
        <span>Last deploy: {new Date(service.lastDeploy).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
