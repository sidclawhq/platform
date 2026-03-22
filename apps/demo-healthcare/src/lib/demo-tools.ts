export const PATIENT = {
  name: 'Sarah Martinez',
  dob: '1978-04-12',
  age: 47,
  mrn: 'MRN-847291',
  gender: 'Female',
  allergies: ['Penicillin', 'Sulfa drugs'],
  insuranceProvider: 'Blue Cross Premium',
  primaryPhysician: 'Dr. James Liu',
  lastVisit: '2026-03-15',
  nextAppointment: '2026-04-10',
};

export const VITALS = {
  bloodPressure: { systolic: 142, diastolic: 88, status: 'elevated' as const },
  heartRate: { value: 78, status: 'normal' as const },
  temperature: { value: 98.6, unit: '°F', status: 'normal' as const },
  spO2: { value: 97, unit: '%', status: 'normal' as const },
  bmi: { value: 28.4, status: 'overweight' as const },
  respiratoryRate: { value: 16, status: 'normal' as const },
};

export type VitalStatus = 'normal' | 'elevated' | 'low' | 'critical' | 'overweight';

export const CONDITIONS = [
  { name: 'Essential Hypertension', icd10: 'I10', status: 'active', since: '2022-08' },
  { name: 'Type 2 Diabetes Mellitus', icd10: 'E11.9', status: 'active', since: '2023-01' },
  { name: 'Hyperlipidemia', icd10: 'E78.5', status: 'active', since: '2023-06' },
];

export const MEDICATIONS = [
  { name: 'Metformin', dose: '500mg', frequency: 'BID', prescriber: 'Dr. Liu', startDate: '2023-01-15', purpose: 'Type 2 Diabetes' },
  { name: 'Atorvastatin', dose: '20mg', frequency: 'Daily', prescriber: 'Dr. Liu', startDate: '2023-06-10', purpose: 'Hyperlipidemia' },
];

export const RECENT_LABS = [
  {
    name: 'HbA1c',
    value: '7.2%',
    reference: '< 5.7% normal, < 7.0% target',
    status: 'above_target' as const,
    date: '2026-03-01',
    trend: 'stable',
  },
  {
    name: 'LDL Cholesterol',
    value: '138 mg/dL',
    reference: '< 100 mg/dL optimal',
    status: 'high' as const,
    date: '2026-03-01',
    trend: 'decreasing',
  },
  {
    name: 'Fasting Glucose',
    value: '142 mg/dL',
    reference: '70-100 mg/dL',
    status: 'high' as const,
    date: '2026-03-01',
    trend: 'stable',
  },
  {
    name: 'Creatinine',
    value: '0.9 mg/dL',
    reference: '0.6-1.2 mg/dL',
    status: 'normal' as const,
    date: '2026-03-01',
    trend: 'stable',
  },
  {
    name: 'Blood Pressure (office)',
    value: '142/88 mmHg',
    reference: '< 130/80 mmHg target',
    status: 'high' as const,
    date: '2026-03-22',
    trend: 'increasing',
  },
];

export type LabStatus = 'normal' | 'high' | 'low' | 'critical' | 'above_target';

export const CLINICAL_NOTES = {
  date: '2026-03-15',
  author: 'Dr. James Liu',
  content: 'Patient presents for routine follow-up. Reports good medication adherence. Diet and exercise compliance improving but BP remains elevated. A1c stable at 7.2% — consider medication adjustment if no improvement by next visit. Discussed lifestyle modifications. Follow-up in 4 weeks with repeat labs.',
};

export const AI_ANALYSIS = {
  summary: 'Blood pressure elevated at 142/88 (target: <130/80). A1c above target at 7.2%. Current medication regimen may need augmentation for hypertension management.',
  recommendations: [
    {
      id: 'order-labs',
      action: 'Order comprehensive metabolic panel + HbA1c',
      rationale: 'Follow-up labs due. Need updated A1c and kidney function to guide medication decisions.',
      urgency: 'routine',
    },
    {
      id: 'send-careplan',
      action: 'Send updated care plan to patient',
      rationale: 'Patient should receive updated BP targets and dietary guidance before next appointment.',
      urgency: 'routine',
    },
    {
      id: 'prescribe-bp',
      action: 'Prescribe Lisinopril 10mg daily',
      rationale: 'ACE inhibitor indicated for hypertension with diabetes. First-line per ADA/AHA guidelines.',
      urgency: 'recommended',
    },
    {
      id: 'modify-treatment',
      action: 'Increase Metformin to 1000mg BID',
      rationale: 'A1c above target at 7.2%. Dose escalation recommended per ADA Standards of Care.',
      urgency: 'recommended',
    },
  ],
};
