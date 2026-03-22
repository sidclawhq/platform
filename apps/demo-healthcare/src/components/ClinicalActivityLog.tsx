'use client';

export interface ActivityEntry {
  time: string;
  icon: string;
  message: string;
  type: 'success' | 'warning' | 'action' | 'blocked' | 'pending';
}

interface ClinicalActivityLogProps {
  entries: ActivityEntry[];
}

const TYPE_COLORS: Record<string, string> = {
  success: 'text-[#22C55E]',
  warning: 'text-[#F59E0B]',
  action: 'text-[#3B82F6]',
  blocked: 'text-[#EF4444]',
  pending: 'text-[#71717A]',
};

export function ClinicalActivityLog({ entries }: ClinicalActivityLogProps) {
  return (
    <div className="border-t border-[#2A2A2E] pt-3">
      <div className="mb-2 text-xs font-medium text-[#71717A] uppercase tracking-wider">Clinical Activity</div>
      <div className="max-h-[160px] overflow-y-auto space-y-1 font-mono text-[11px]">
        {entries.map((entry, i) => (
          <div key={i} className={`flex gap-2 leading-relaxed animate-in ${TYPE_COLORS[entry.type]}`}>
            <span className="flex-shrink-0 w-3">{entry.icon}</span>
            <span className="text-[#52525B] flex-shrink-0">{entry.time}</span>
            <span className={TYPE_COLORS[entry.type]}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
