interface MetricsBarProps {
  label: string;
  value: number;
  displayValue: string;
  critical?: boolean;
}

export function MetricsBar({ label, value, displayValue, critical }: MetricsBarProps) {
  const barColor = value > 80 ? 'bg-[#EF4444]' : value > 60 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#A1A1AA]">{label}</span>
        <span className={`text-xs font-mono ${critical ? 'text-[#EF4444] font-medium' : 'text-[#71717A]'}`}>
          {displayValue}
          {critical && <span className="ml-1.5 text-[10px] text-[#EF4444] animate-pulse">CRITICAL</span>}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#1A1A1D]">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor} ${critical ? 'animate-pulse' : ''}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
