# Task: Interactive Demo 3 — MedAssist Health (AI Clinical Assistant)

## Context

You are working on the **Agent Identity & Approval Layer** project (brand: **SidClaw**). Read these files first:

1. `apps/demo/` — Demo 1 (Atlas Financial, chat interface). Study the governance panel (right side) and API route proxying pattern.
2. `apps/demo-devops/` — Demo 2 (Nexus DevOps, ops dashboard). Study the button-driven action pattern and activity log.
3. `research/stress-tests/demo-app-implementation-report.md` — lessons from Demo 1. Every issue must be avoided.
4. `apps/dashboard/src/app/globals.css` — design tokens.

Your job is to build a third interactive demo — **MedAssist Health** — featuring an AI clinical assistant that helps physicians review patients and recommend actions. The left side looks like an **Electronic Health Record (EHR) patient view**, not a chat or ops dashboard.

This targets **health tech companies, hospital IT, and HIPAA compliance teams**.

## Lessons From Demo 1 (MUST Follow)

Same 9 rules as Demo 2. In particular:

1. **SDK imports:** From built `dist/`, not source. Only `@sidclaw/shared` in `transpilePackages`.
2. **API key scopes:** Need `["*"]` or `["admin"]` scope via `DEMO_ADMIN_API_KEY`.
3. **CORS:** ALL browser-to-API calls through Next.js API routes. No direct client fetch.
4. **Session state:** Pass `agentId` and `apiKey` from client to server on every request.
5. **No LLM needed.** Same as Demo 2 — the "AI analysis" is pre-computed from mock patient data. No Anthropic API key required.
6. **Trace timeline:** Use improved design from Demo 1.
7. **ESLint config:** Include `eslint.config.mjs`.
8. **All config files** in scaffold.
9. **DB timezone** awareness.

## Architecture

Same as Demo 2 — button-driven left side + governance panel right side. No LLM.

```
apps/demo-healthcare/
  Left: EHR patient view with AI recommendations as action buttons
  Right: Governance panel (reused from Demo 1/2)
  API routes: proxy all calls to SidClaw API
```

## What To Do

### 1. Initialize Project

```bash
cp -r apps/demo-devops apps/demo-healthcare
```

Then replace all ops-related components with healthcare components. Keep the governance panel (right side), API routes (governance polling, approval action, agent action), and design tokens.

Port: **3005**

### 2. Directory Structure

```
apps/demo-healthcare/
  src/
    app/
      page.tsx
      layout.tsx
      globals.css
      api/
        setup/route.ts                # Creates demo agent + policies
        agent-action/route.ts         # Proxy: executes clinical actions via SidClaw API
        governance/route.ts           # Proxy: polls traces + approvals (from Demo 1)
        approval-action/route.ts      # Proxy: approve/deny (from Demo 1)
    components/
      DemoLayout.tsx
      DemoHeader.tsx
      DemoFooter.tsx

      # LEFT SIDE — EHR Patient View (NEW)
      PatientView.tsx                 # Main left-side container
      PatientHeader.tsx               # Patient name, DOB, MRN, photo placeholder
      VitalsPanel.tsx                 # Current vitals with abnormal indicators
      ConditionsList.tsx              # Active conditions/diagnoses
      MedicationsList.tsx             # Current medications
      RecentLabs.tsx                  # Recent lab results with out-of-range flags
      ClinicalNotes.tsx               # Last visit notes
      AIRecommendations.tsx           # AI-recommended clinical actions
      ClinicalActionButton.tsx        # Single action button (same pattern as Demo 2)
      RestrictedActions.tsx           # Actions blocked by policy (replaces DangerZone)
      ClinicalActivityLog.tsx         # Activity feed

      # RIGHT SIDE — Governance Panel (FROM DEMO 1/2)
      GovernancePanel.tsx
      GovernanceEvent.tsx
      ApprovalCard.tsx
      TraceTimeline.tsx

    lib/
      demo-tools.ts                   # Mock patient/clinical data
      demo-session.ts                 # Agent + policy setup
  package.json
  next.config.ts
  tailwind.config.ts
  tsconfig.json
  eslint.config.mjs
```

### 3. Mock Patient Data (`lib/demo-tools.ts`)

```typescript
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
```

### 4. Policies (`lib/demo-session.ts`)

```typescript
const policies = [
  {
    policy_name: 'Allow patient chart access',
    operation: 'view_chart',
    target_integration: 'ehr_system',
    resource_scope: 'patient_records',
    data_classification: 'confidential',
    policy_effect: 'allow',
    rationale: 'Clinical AI assistant has authorized read access to patient charts under the supervising physician\'s credentials. Access is logged for HIPAA compliance and limited to the minimum necessary data for the current clinical context.',
    priority: 100,
  },
  {
    policy_name: 'Allow medical literature search',
    operation: 'search_literature',
    target_integration: 'clinical_knowledge',
    resource_scope: 'medical_references',
    data_classification: 'public',
    policy_effect: 'allow',
    rationale: 'Searching published medical literature and clinical guidelines is a read-only operation on public data. No patient information is transmitted to external systems.',
    priority: 100,
  },
  {
    policy_name: 'Require approval for lab orders',
    operation: 'order_labs',
    target_integration: 'lab_system',
    resource_scope: 'lab_orders',
    data_classification: 'confidential',
    policy_effect: 'approval_required',
    rationale: 'Lab orders incur costs, require patient consent, and affect clinical decision-making. A licensed physician must review and confirm all lab orders before submission to the laboratory system.',
    priority: 100,
    max_session_ttl: 600,
  },
  {
    policy_name: 'Require approval for patient communications',
    operation: 'send_patient_message',
    target_integration: 'patient_portal',
    resource_scope: 'patient_communications',
    data_classification: 'confidential',
    policy_effect: 'approval_required',
    rationale: 'Patient-facing communications must be reviewed by a clinician for medical accuracy, appropriate tone, and HIPAA compliance before delivery. Incorrect medical guidance in patient communications creates liability risk.',
    priority: 100,
    max_session_ttl: 600,
  },
  {
    policy_name: 'Block AI medication prescriptions',
    operation: 'prescribe_medication',
    target_integration: 'pharmacy_system',
    resource_scope: 'prescriptions',
    data_classification: 'restricted',
    policy_effect: 'deny',
    rationale: 'Medication prescriptions require a licensed physician\'s clinical judgment, DEA authorization, and direct order entry. AI systems cannot prescribe medications under federal and state medical practice regulations. The AI may recommend, but a physician must independently evaluate and order.',
    priority: 200,
  },
  {
    policy_name: 'Block AI treatment plan modifications',
    operation: 'modify_treatment',
    target_integration: 'ehr_system',
    resource_scope: 'treatment_plans',
    data_classification: 'restricted',
    policy_effect: 'deny',
    rationale: 'Treatment plan modifications directly affect patient care outcomes and require physician clinical judgment. AI-generated treatment changes must be reviewed and entered by the treating physician. Automated modifications are prohibited under clinical governance policy.',
    priority: 200,
  },
];
```

### 5. Agent Configuration

```typescript
{
  name: `MedAssist Clinical AI (demo-${sessionId.substring(0, 8)})`,
  description: 'AI clinical decision support assistant — reviews patient data, recommends diagnostic and treatment actions under physician supervision',
  owner_name: 'Dr. James Liu',
  owner_role: 'Supervising Physician',
  team: 'MedAssist Health — Clinical AI',
  environment: 'prod',
  authority_model: 'delegated',
  identity_mode: 'delegated_identity',
  delegation_model: 'on_behalf_of_owner',
  autonomy_tier: 'medium',
  authorized_integrations: [
    { name: 'EHR System', resource_scope: 'patient_records', data_classification: 'confidential', allowed_operations: ['read'] },
    { name: 'Clinical Knowledge', resource_scope: 'medical_references', data_classification: 'public', allowed_operations: ['search'] },
    { name: 'Lab System', resource_scope: 'lab_orders', data_classification: 'confidential', allowed_operations: ['order'] },
    { name: 'Patient Portal', resource_scope: 'patient_communications', data_classification: 'confidential', allowed_operations: ['send'] },
  ],
  created_by: 'demo-setup',
}
```

### 6. Patient Header (`components/PatientHeader.tsx`)

```
┌──────────────────────────────────────────────────────────┐
│  👤  Sarah Martinez                                       │
│      DOB: Apr 12, 1978 (47y)    MRN: 847291              │
│      Allergies: Penicillin, Sulfa drugs                   │
│      PCP: Dr. James Liu    Insurance: Blue Cross Premium  │
│      Last visit: Mar 15, 2026    Next: Apr 10, 2026       │
└──────────────────────────────────────────────────────────┘
```

**Design:**
- Avatar placeholder: `bg-surface-2 w-12 h-12 rounded-full` with initials "SM"
- Patient name: `text-lg font-medium text-primary`
- Details: `text-xs text-secondary` in a 2-column grid
- Allergies: `text-accent-red text-xs font-medium` (always visible — critical safety info)
- Card: `bg-surface-1 border-default rounded-lg p-4`

### 7. Vitals Panel (`components/VitalsPanel.tsx`)

```
┌─ Current Vitals ─────────────────────────────────────────┐
│                                                           │
│  BP        HR       Temp      SpO2     RR       BMI      │
│  142/88 ▲  78       98.6°F    97%      16       28.4     │
│  elevated  normal   normal    normal   normal   overwt   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Design:**
- 6 vital signs in a horizontal grid
- Each vital: value on top (`text-lg font-mono font-medium`), label below (`text-xs text-muted`)
- Status color: normal = `text-accent-green`, elevated/high = `text-accent-amber`, critical = `text-accent-red`
- Abnormal vitals have a subtle colored background: `bg-accent-amber/5` for elevated BP
- `▲` arrow for elevated, `▼` for low

### 8. Conditions & Medications Lists

```
┌─ Active Conditions ───────────────┐  ┌─ Current Medications ──────────┐
│                                    │  │                                 │
│  • Essential Hypertension (I10)    │  │  Metformin 500mg BID            │
│    Active since Aug 2022           │  │  → Type 2 Diabetes              │
│  • Type 2 Diabetes (E11.9)        │  │                                 │
│    Active since Jan 2023           │  │  Atorvastatin 20mg daily        │
│  • Hyperlipidemia (E78.5)         │  │  → Hyperlipidemia               │
│    Active since Jun 2023           │  │                                 │
│                                    │  │  No antihypertensive — ⚠        │
│                                    │  │                                 │
└────────────────────────────────────┘  └─────────────────────────────────┘
```

**Design:**
- Two cards side by side (2-column grid)
- Conditions: bullet list, ICD-10 code in `font-mono text-muted`, "since" date
- Medications: drug name `font-medium`, dose + frequency, purpose in `text-muted`
- "No antihypertensive" warning in `text-accent-amber` (the AI noticed a gap)

### 9. Recent Labs (`components/RecentLabs.tsx`)

```
┌─ Recent Lab Results (Mar 1, 2026) ───────────────────────┐
│                                                           │
│  Test              Result        Reference    Status      │
│  ─────────────     ──────        ──────────   ──────      │
│  HbA1c             7.2%          < 7.0%       ▲ above    │
│  LDL Cholesterol   138 mg/dL     < 100        ▲ high     │
│  Fasting Glucose   142 mg/dL     70-100       ▲ high     │
│  Creatinine        0.9 mg/dL     0.6-1.2      ✓ normal   │
│  Blood Pressure    142/88        < 130/80     ▲ high     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Design:**
- Table: `font-mono text-xs` for values
- Status column: normal = `text-accent-green` with ✓, high/above = `text-accent-amber` with ▲, critical = `text-accent-red` with ▲▲
- Out-of-range rows have subtle amber background: `bg-accent-amber/5`
- Trend indicators: ↑ increasing, ↓ decreasing, → stable (shown next to value)

### 10. AI Recommendations (`components/AIRecommendations.tsx`)

```
┌─ AI Clinical Assistant ──────────────────────────────────┐
│                                                           │
│  Based on elevated BP (142/88) and A1c above target       │
│  (7.2%), the clinical AI recommends:                      │
│                                                           │
│  ┌────────────────────────────┐ ┌────────────────────────┐│
│  │ 📋 Order CMP + HbA1c      │ │ 📨 Send care plan      ││
│  │ Follow-up labs due         │ │ BP targets + diet      ││
│  │ Routine                    │ │ Routine                ││
│  └────────────────────────────┘ └────────────────────────┘│
│                                                           │
│  ── Requires Physician Action (blocked for AI) ─────────  │
│                                                           │
│  ┌────────────────────────────┐ ┌────────────────────────┐│
│  │ 💊 Prescribe Lisinopril   │ │ 📝 Increase Metformin  ││
│  │ 10mg daily — ACE inhibitor│ │ 500mg → 1000mg BID     ││
│  │ Per ADA/AHA guidelines    │ │ Per ADA Standards      ││
│  └────────────────────────────┘ └────────────────────────┘│
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Design:**
- Header: AI analysis summary in `text-sm text-secondary`
- Top row: actions that will trigger `approval_required` (blue-tinted buttons)
- Divider: "Requires Physician Action (blocked for AI)" in `text-xs text-accent-red uppercase tracking-wider`
- Bottom row: actions that will be `denied` (red-outlined buttons)
- Button design matches Demo 2's `AgentActionButton`:
  - Approval actions: `bg-surface-2 border-default hover:border-accent-blue/50`
  - Denied actions: `bg-surface-2 border-accent-red/20 hover:border-accent-red/40`
  - Each has: icon, action label (`font-medium`), rationale snippet (`text-xs text-muted`), urgency tag

### 11. Clinical Action Buttons

When clicked:

**"Order CMP + HbA1c" (approval_required):**
- Calls `/api/agent-action` with `operation: 'order_labs'`
- Governance evaluates → approval card appears on right
- Approval card context shows: patient MRN, tests requested, clinical rationale, ordering physician
- Activity log: `⏳ Lab order pending physician approval: CMP + HbA1c for MRN-847291`
- After approval: `✓ Lab order approved by Dr. Liu. Sent to Quest Diagnostics.`

**"Send care plan" (approval_required):**
- Calls `/api/agent-action` with `operation: 'send_patient_message'`
- Approval card context: patient name, message type, content preview
- Activity log: `⏳ Patient communication pending review: care plan update`

**"Prescribe Lisinopril" (deny):**
- Calls `/api/agent-action` with `operation: 'prescribe_medication'`
- Immediately blocked → BLOCKED trace on right
- Button shows red flash: "Physician must order directly"
- Activity log: `✗ BLOCKED: AI cannot prescribe medications. Physician must evaluate and order via EHR.`

**"Increase Metformin" (deny):**
- Same deny pattern
- Activity log: `✗ BLOCKED: Treatment plan modifications require physician clinical judgment.`

### 12. Activity Log (`components/ClinicalActivityLog.tsx`)

Same pattern as Demo 2 but with clinical language:

```typescript
const INITIAL_ACTIVITY = [
  { time: '09:14:00', icon: '✓', message: 'Retrieved patient chart: Sarah Martinez (MRN-847291)', type: 'success' },
  { time: '09:14:01', icon: '✓', message: 'Reviewed vitals: BP elevated (142/88), other vitals normal', type: 'success' },
  { time: '09:14:01', icon: '✓', message: 'Reviewed medications: 2 active, no antihypertensive prescribed', type: 'success' },
  { time: '09:14:02', icon: '✓', message: 'Reviewed labs: A1c 7.2% (above target), LDL 138 (high), glucose 142 (high)', type: 'success' },
  { time: '09:14:03', icon: '▲', message: 'Clinical finding: Uncontrolled hypertension + above-target A1c in diabetic patient', type: 'warning' },
  { time: '09:14:03', icon: '→', message: 'Generating recommendations: labs, care plan, medication adjustment', type: 'action' },
];
```

### 13. Auto-Run Chart Review on Page Load

Like Demo 2's health checks, automatically run 2 governance evaluations on load:

```typescript
// On setup completion:
// 1. Evaluate: view_chart (allowed) → "Retrieved patient chart"
// 2. Evaluate: search_literature (allowed) → "Searched clinical guidelines for hypertension + diabetes management"

// These show 2 ALLOWED traces on the right before the prospect clicks anything.
```

### 14. Branding

| Element | Value |
|---------|-------|
| Header title | "MedAssist Health" |
| Header badge | "Interactive Demo — Clinical AI" |
| Left header | "Patient Chart — AI Clinical Assistant" |
| Left subtitle | "AI assistant has reviewed this patient's chart and generated recommendations." |
| Footer company | "MedAssist Health — Demo Environment" |
| Footer note | "This demo uses real SidClaw governance. Patient data is simulated — no real PHI. The governance decisions (allow, require approval, deny) are 100% authentic." |
| Footer disclaimer | "⚕ For demonstration purposes only. Not for clinical use." |

### 15. Additional Design Details

**EHR aesthetic:**
- The left side should feel clinical — clean, data-dense, structured
- Use more white/gray tones in the data display (lab values, vitals) on the dark background
- ICD-10 codes and medical abbreviations in `font-mono`
- Vital signs with colored status indicators
- The overall feel: "a doctor's EHR screen, rendered in the Institutional Calm dark theme"

**Color coding for clinical data:**
- Normal values: `text-accent-green`
- Elevated/above target: `text-accent-amber`
- Critical/out of range: `text-accent-red`
- Reference ranges: `text-muted`

**HIPAA notice:**
- Small footer text: "Demo uses simulated patient data. No real PHI is stored or transmitted."

### 16. Package Config

```json
{
  "name": "@sidclaw/demo-healthcare",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3005",
    "build": "next build",
    "start": "next start --port 3005"
  }
}
```

### 17. Environment Variables

`apps/demo-healthcare/.env.local`:

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<admin-scoped key — must have ["*"] scope>
NEXT_PUBLIC_SIDCLAW_API_URL=http://localhost:4000
```

No `ANTHROPIC_API_KEY` needed — no LLM chat, all clinical analysis is pre-computed.

### 18. Reuse From Demo 2

Copy directly from `apps/demo-devops/`:
- `GovernancePanel.tsx`, `GovernanceEvent.tsx`, `ApprovalCard.tsx`, `TraceTimeline.tsx` — right side, identical
- `app/api/governance/route.ts` — governance polling proxy, identical
- `app/api/approval-action/route.ts` — approve/deny proxy, identical
- `app/api/agent-action/route.ts` — action execution proxy, identical (different payloads from client)
- `DemoLayout.tsx` — identical
- `globals.css` — identical
- `eslint.config.mjs` — identical
- `ActivityLog.tsx` — same component, different initial data

### 19. What's Unique to Demo 3

- `PatientHeader.tsx` — patient demographics, allergies, physician
- `VitalsPanel.tsx` — vital signs grid with status indicators
- `ConditionsList.tsx` — active conditions with ICD-10 codes
- `MedicationsList.tsx` — current medications with gap analysis
- `RecentLabs.tsx` — lab results table with out-of-range highlighting
- `ClinicalNotes.tsx` — last visit notes
- `AIRecommendations.tsx` — clinical action buttons (different from ops buttons)
- `RestrictedActions.tsx` — prescribe/modify treatment (replaces DangerZone)
- `ClinicalActivityLog.tsx` — clinical activity feed
- `lib/demo-tools.ts` — all patient/clinical mock data
- `lib/demo-session.ts` — clinical agent config + 6 policies

### 20. Three Demos Comparison

| Aspect | Demo 1 | Demo 2 | Demo 3 |
|--------|--------|--------|--------|
| Left side | Chat | Ops dashboard | EHR patient view |
| Looks like | Intercom | Datadog | Epic/Cerner |
| Target buyer | CISO / compliance | VP Engineering | Health tech / HIPAA |
| Language | "customers", "FINRA" | "replicas", "deploy" | "patient", "prescribe", "HIPAA" |
| LLM needed | Yes | No | No |
| Actions | Type free-form | Click ops buttons | Click clinical buttons |
| Allow example | Search knowledge base | Check service health | View patient chart |
| Approval example | Send customer email | Deploy to production | Order lab tests |
| Deny example | Export PII | Delete namespace | Prescribe medication |

## Acceptance Criteria

- [ ] Demo loads at `localhost:3005` with split-screen: EHR view (left) + governance panel (right)
- [ ] Patient header shows: name, DOB, age, MRN, allergies (red), physician, insurance
- [ ] Vitals panel shows 6 vitals with color-coded status (BP elevated = amber)
- [ ] Conditions list shows 3 active conditions with ICD-10 codes
- [ ] Medications list shows 2 current meds + "no antihypertensive" warning
- [ ] Lab results table shows 5 labs with out-of-range highlighting
- [ ] On load: 2 auto-evaluations (view chart, search literature) → 2 ALLOWED traces on right
- [ ] "Order CMP + HbA1c" → APPROVAL REQUIRED card with patient context, test names, clinical rationale
- [ ] "Send care plan" → APPROVAL REQUIRED card with message preview
- [ ] "Prescribe Lisinopril" → immediately BLOCKED, clinical activity shows "Physician must order directly"
- [ ] "Increase Metformin" → immediately BLOCKED
- [ ] Approving lab order → activity log updates, APPROVED trace on right
- [ ] Activity log shows clinical actions with timestamps
- [ ] HIPAA disclaimer visible in footer
- [ ] No CORS errors, no LLM calls
- [ ] "Institutional Calm" aesthetic with clinical data presentation
- [ ] ESLint config present, `turbo build` succeeds

## Constraints

- Do NOT modify the SidClaw API, SDK, or dashboard
- Do NOT modify Demo 1 or Demo 2
- Do NOT use real patient data or PHI — all data is clearly fictional
- Do NOT require an LLM API key — all clinical analysis is pre-computed
- Reuse governance panel components from Demo 1/2
- Follow code style: files in `kebab-case.tsx`, components in `PascalCase`
