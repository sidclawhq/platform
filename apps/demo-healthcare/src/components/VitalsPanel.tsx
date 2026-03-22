import { VITALS } from '@/lib/demo-tools';
import type { VitalStatus } from '@/lib/demo-tools';

const STATUS_COLOR: Record<VitalStatus, string> = {
  normal: 'text-[#22C55E]',
  elevated: 'text-[#F59E0B]',
  low: 'text-[#3B82F6]',
  critical: 'text-[#EF4444]',
  overweight: 'text-[#F59E0B]',
};

const STATUS_BG: Record<VitalStatus, string> = {
  normal: '',
  elevated: 'bg-[#F59E0B]/5',
  low: 'bg-[#3B82F6]/5',
  critical: 'bg-[#EF4444]/5',
  overweight: 'bg-[#F59E0B]/5',
};

const STATUS_ARROW: Record<VitalStatus, string> = {
  normal: '',
  elevated: ' \u25B2',
  low: ' \u25BC',
  critical: ' \u25B2\u25B2',
  overweight: '',
};

interface VitalItem {
  label: string;
  value: string;
  status: VitalStatus;
}

const vitals: VitalItem[] = [
  { label: 'BP', value: `${VITALS.bloodPressure.systolic}/${VITALS.bloodPressure.diastolic}`, status: VITALS.bloodPressure.status },
  { label: 'HR', value: `${VITALS.heartRate.value}`, status: VITALS.heartRate.status },
  { label: 'Temp', value: `${VITALS.temperature.value}${VITALS.temperature.unit}`, status: VITALS.temperature.status },
  { label: 'SpO2', value: `${VITALS.spO2.value}${VITALS.spO2.unit}`, status: VITALS.spO2.status },
  { label: 'RR', value: `${VITALS.respiratoryRate.value}`, status: VITALS.respiratoryRate.status },
  { label: 'BMI', value: `${VITALS.bmi.value}`, status: VITALS.bmi.status },
];

export function VitalsPanel() {
  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-4">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#71717A]">Current Vitals</h4>
      <div className="grid grid-cols-6 gap-3">
        {vitals.map((vital) => (
          <div
            key={vital.label}
            className={`rounded-md px-3 py-2 text-center ${STATUS_BG[vital.status]}`}
          >
            <div className={`font-mono text-lg font-medium ${STATUS_COLOR[vital.status]}`}>
              {vital.value}
              <span className="text-xs">{STATUS_ARROW[vital.status]}</span>
            </div>
            <div className="mt-0.5 text-xs text-[#71717A]">{vital.label}</div>
            <div className={`text-[10px] ${STATUS_COLOR[vital.status]}`}>{vital.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
