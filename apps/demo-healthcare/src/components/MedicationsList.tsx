import { MEDICATIONS } from '@/lib/demo-tools';

export function MedicationsList() {
  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-4">
      <h4 className="mb-3 text-sm font-medium uppercase tracking-wider text-[#71717A]">Current Medications</h4>
      <div className="space-y-3">
        {MEDICATIONS.map((med) => (
          <div key={med.name}>
            <div className="text-base font-medium text-[#E4E4E7]">
              {med.name} {med.dose} {med.frequency}
            </div>
            <div className="text-sm text-[#71717A]">
              → {med.purpose}
            </div>
          </div>
        ))}

        {/* Gap analysis */}
        <div className="border-t border-[#2A2A2E] pt-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-[#F59E0B]">
            <span>⚠</span>
            <span>No antihypertensive prescribed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
