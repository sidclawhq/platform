import { PATIENT } from '@/lib/demo-tools';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PatientHeader() {
  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-4">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#1A1A1D] text-sm font-medium text-[#A1A1AA]">
          SM
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium text-[#E4E4E7]">{PATIENT.name}</h3>
            <span className="font-mono text-xs text-[#71717A]">{PATIENT.mrn}</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div className="text-[#A1A1AA]">
              DOB: {formatDate(PATIENT.dob)} ({PATIENT.age}y) &bull; {PATIENT.gender}
            </div>
            <div className="text-[#A1A1AA]">
              PCP: {PATIENT.primaryPhysician}
            </div>
            <div className="text-[#A1A1AA]">
              Insurance: {PATIENT.insuranceProvider}
            </div>
            <div className="text-[#A1A1AA]">
              Last visit: {formatDate(PATIENT.lastVisit)} &bull; Next: {formatDate(PATIENT.nextAppointment)}
            </div>
          </div>

          {/* Allergies — always visible, red */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-[#EF4444]">Allergies:</span>
            <span className="text-xs font-medium text-[#EF4444]">
              {PATIENT.allergies.join(', ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
