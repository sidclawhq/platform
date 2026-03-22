import { RECENT_LABS } from '@/lib/demo-tools';
import type { LabStatus } from '@/lib/demo-tools';

const STATUS_COLOR: Record<LabStatus, string> = {
  normal: 'text-[#22C55E]',
  high: 'text-[#F59E0B]',
  low: 'text-[#3B82F6]',
  critical: 'text-[#EF4444]',
  above_target: 'text-[#F59E0B]',
};

const STATUS_ICON: Record<LabStatus, string> = {
  normal: '\u2713',
  high: '\u25B2',
  low: '\u25BC',
  critical: '\u25B2\u25B2',
  above_target: '\u25B2',
};

const STATUS_LABEL: Record<LabStatus, string> = {
  normal: 'normal',
  high: 'high',
  low: 'low',
  critical: 'critical',
  above_target: 'above',
};

const ROW_BG: Record<LabStatus, string> = {
  normal: '',
  high: 'bg-[#F59E0B]/5',
  low: 'bg-[#3B82F6]/5',
  critical: 'bg-[#EF4444]/5',
  above_target: 'bg-[#F59E0B]/5',
};

const TREND_ICON: Record<string, string> = {
  increasing: '\u2191',
  decreasing: '\u2193',
  stable: '\u2192',
};

export function RecentLabs() {
  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-4">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#71717A]">
        Recent Lab Results (Mar 1, 2026)
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#2A2A2E]">
              <th className="pb-2 text-left font-medium text-[#71717A]">Test</th>
              <th className="pb-2 text-left font-medium text-[#71717A]">Result</th>
              <th className="pb-2 text-left font-medium text-[#71717A]">Reference</th>
              <th className="pb-2 text-left font-medium text-[#71717A]">Status</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_LABS.map((lab) => (
              <tr key={lab.name} className={`border-b border-[#2A2A2E]/50 ${ROW_BG[lab.status]}`}>
                <td className="py-2 text-[#E4E4E7]">{lab.name}</td>
                <td className="py-2 font-mono text-[#E4E4E7]">
                  {lab.value}
                  <span className="ml-1 text-[#71717A]">{TREND_ICON[lab.trend] ?? ''}</span>
                </td>
                <td className="py-2 text-[#71717A]">{lab.reference}</td>
                <td className={`py-2 font-medium ${STATUS_COLOR[lab.status]}`}>
                  {STATUS_ICON[lab.status]} {STATUS_LABEL[lab.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
