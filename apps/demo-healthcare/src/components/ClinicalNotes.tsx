import { CLINICAL_NOTES } from '@/lib/demo-tools';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ClinicalNotes() {
  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-4">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#71717A]">
        Last Visit Notes
      </h4>
      <div className="mb-2 flex items-center gap-2 text-xs text-[#71717A]">
        <span>{formatDate(CLINICAL_NOTES.date)}</span>
        <span>&bull;</span>
        <span>{CLINICAL_NOTES.author}</span>
      </div>
      <p className="text-sm leading-relaxed text-[#A1A1AA]">
        {CLINICAL_NOTES.content}
      </p>
    </div>
  );
}
