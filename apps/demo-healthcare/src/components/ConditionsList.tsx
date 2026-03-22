import { CONDITIONS } from '@/lib/demo-tools';

function formatSince(since: string): string {
  const [year, month] = since.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function ConditionsList() {
  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-4">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#71717A]">Active Conditions</h4>
      <div className="space-y-2.5">
        {CONDITIONS.map((condition) => (
          <div key={condition.icd10} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#A1A1AA]" />
            <div>
              <div className="text-sm text-[#E4E4E7]">
                {condition.name}{' '}
                <span className="font-mono text-xs text-[#71717A]">({condition.icd10})</span>
              </div>
              <div className="text-xs text-[#71717A]">
                Active since {formatSince(condition.since)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
