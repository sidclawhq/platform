import type { LogEntry } from '@/lib/demo-tools';

interface LogViewerProps {
  logs: LogEntry[];
}

const LEVEL_COLORS: Record<string, string> = {
  ERROR: 'text-[#EF4444]',
  WARN: 'text-[#F59E0B]',
  INFO: 'text-[#71717A]',
};

export function LogViewer({ logs }: LogViewerProps) {
  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#0C0C0E] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[#71717A]">Recent Logs — user-service</span>
        <span className="text-xs text-[#52525B]">live</span>
      </div>
      <div className="max-h-[180px] overflow-y-auto space-y-0.5 font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 leading-relaxed">
            <span className="text-[#52525B] flex-shrink-0">{log.time}</span>
            <span className={`flex-shrink-0 w-[38px] ${LEVEL_COLORS[log.level]}`}>{log.level}</span>
            <span className="text-[#A1A1AA] truncate">{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
