'use client';

import { useState, useEffect, useCallback } from 'react';
import { PatientHeader } from './PatientHeader';
import { VitalsPanel } from './VitalsPanel';
import { ConditionsList } from './ConditionsList';
import { MedicationsList } from './MedicationsList';
import { RecentLabs } from './RecentLabs';
import { ClinicalNotes } from './ClinicalNotes';
import { AIRecommendations } from './AIRecommendations';
import { RestrictedActions } from './RestrictedActions';
import { ClinicalActivityLog } from './ClinicalActivityLog';
import type { ActivityEntry } from './ClinicalActivityLog';
import { PATIENT } from '@/lib/demo-tools';

interface PatientViewProps {
  agentId: string;
  apiKey: string;
}

interface ActionState {
  status: 'idle' | 'loading' | 'awaiting' | 'done' | 'blocked';
}

const ACTION_CONFIGS: Record<string, { operation: string; target_integration: string; resource_scope: string; data_classification: string; context: Record<string, unknown> }> = {
  'order-labs': {
    operation: 'order_labs',
    target_integration: 'lab_system',
    resource_scope: 'lab_orders',
    data_classification: 'confidential',
    context: {
      patient_mrn: PATIENT.mrn,
      patient_name: PATIENT.name,
      tests_requested: ['Comprehensive Metabolic Panel', 'HbA1c'],
      clinical_rationale: 'Follow-up labs due. Need updated A1c and kidney function to guide medication decisions.',
      ordering_physician: PATIENT.primaryPhysician,
      urgency: 'routine',
    },
  },
  'send-careplan': {
    operation: 'send_patient_message',
    target_integration: 'patient_portal',
    resource_scope: 'patient_communications',
    data_classification: 'confidential',
    context: {
      patient_mrn: PATIENT.mrn,
      patient_name: PATIENT.name,
      message_type: 'care_plan_update',
      content_preview: 'Updated BP targets (<130/80), dietary guidance (DASH diet), exercise recommendations, and next appointment details.',
      sending_physician: PATIENT.primaryPhysician,
    },
  },
  'prescribe-bp': {
    operation: 'prescribe_medication',
    target_integration: 'pharmacy_system',
    resource_scope: 'prescriptions',
    data_classification: 'restricted',
    context: {
      patient_mrn: PATIENT.mrn,
      medication: 'Lisinopril 10mg daily',
      indication: 'Hypertension with Type 2 Diabetes',
      guideline: 'ADA/AHA first-line recommendation',
    },
  },
  'modify-treatment': {
    operation: 'modify_treatment',
    target_integration: 'ehr_system',
    resource_scope: 'treatment_plans',
    data_classification: 'restricted',
    context: {
      patient_mrn: PATIENT.mrn,
      modification: 'Increase Metformin from 500mg to 1000mg BID',
      rationale: 'A1c above target at 7.2%',
      guideline: 'ADA Standards of Care',
    },
  },
};

const INITIAL_ACTIVITY: ActivityEntry[] = [
  { time: '09:14:00', icon: '\u2713', message: `Retrieved patient chart: ${PATIENT.name} (${PATIENT.mrn})`, type: 'success' },
  { time: '09:14:01', icon: '\u2713', message: 'Reviewed vitals: BP elevated (142/88), other vitals normal', type: 'success' },
  { time: '09:14:01', icon: '\u2713', message: 'Reviewed medications: 2 active, no antihypertensive prescribed', type: 'success' },
  { time: '09:14:02', icon: '\u2713', message: 'Reviewed labs: A1c 7.2% (above target), LDL 138 (high), glucose 142 (high)', type: 'success' },
  { time: '09:14:03', icon: '\u25B2', message: 'Clinical finding: Uncontrolled hypertension + above-target A1c in diabetic patient', type: 'warning' },
  { time: '09:14:03', icon: '\u2192', message: 'Generating recommendations: labs, care plan, medication adjustment', type: 'action' },
];

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

const COMPLETION_MESSAGES: Record<string, string> = {
  'order-labs': '\u2713 Lab order approved by Dr. Liu. Sent to Quest Diagnostics.',
  'send-careplan': '\u2713 Care plan approved and sent to patient via portal.',
};

export function PatientView({ agentId, apiKey }: PatientViewProps) {
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [activity, setActivity] = useState<ActivityEntry[]>(INITIAL_ACTIVITY);
  const [autoRunDone, setAutoRunDone] = useState(false);
  const [pendingTraces, setPendingTraces] = useState<Record<string, string>>({}); // actionId → traceId

  const addActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev]);
  }, []);

  // Poll for pending trace resolution
  useEffect(() => {
    const pendingEntries = Object.entries(pendingTraces);
    if (pendingEntries.length === 0) return;

    const checkTraces = async () => {
      try {
        const res = await fetch(`/api/governance?agentId=${agentId}&apiKey=${apiKey}`);
        if (!res.ok) return;
        const data = await res.json();
        const traces: Array<{ id: string; final_outcome: string }> = data.traces ?? [];

        for (const [actionId, traceId] of pendingEntries) {
          const trace = traces.find((t) => t.id === traceId);
          if (trace && trace.final_outcome !== 'in_progress' && trace.final_outcome !== 'pending') {
            // Trace resolved — update button state
            setActionStates((prev) => ({ ...prev, [actionId]: { status: 'done' } }));
            setPendingTraces((prev) => {
              const next = { ...prev };
              delete next[actionId];
              return next;
            });
            const msg = COMPLETION_MESSAGES[actionId] ?? `Action ${actionId} completed.`;
            addActivity({ time: nowTime(), icon: '\u2713', message: msg, type: 'success' });
          }
        }
      } catch {
        // Silent fail
      }
    };

    const interval = setInterval(checkTraces, 2000);
    return () => clearInterval(interval);
  }, [pendingTraces, agentId, apiKey, addActivity]);

  // Auto-run chart review evaluations on page load
  useEffect(() => {
    if (!agentId || !apiKey || autoRunDone) return;
    setAutoRunDone(true);

    const runChartReview = async () => {
      // 1. Evaluate: view_chart (allowed)
      await fetch('/api/agent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          agentId,
          action: {
            operation: 'view_chart',
            target_integration: 'ehr_system',
            resource_scope: 'patient_records',
            data_classification: 'confidential',
            context: { patient_mrn: PATIENT.mrn, patient_name: PATIENT.name, access_reason: 'Clinical review — routine follow-up' },
          },
        }),
      });

      // 2. Evaluate: search_literature (allowed)
      await fetch('/api/agent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          agentId,
          action: {
            operation: 'search_literature',
            target_integration: 'clinical_knowledge',
            resource_scope: 'medical_references',
            data_classification: 'public',
            context: { query: 'Hypertension management in Type 2 Diabetes — ADA/AHA guidelines 2026', purpose: 'Clinical decision support' },
          },
        }),
      });
    };

    runChartReview();
  }, [agentId, apiKey, autoRunDone]);

  const handleAction = async (actionId: string) => {
    const config = ACTION_CONFIGS[actionId];
    if (!config) return;

    setActionStates((prev) => ({ ...prev, [actionId]: { status: 'loading' } }));

    try {
      const res = await fetch('/api/agent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, agentId, action: config }),
      });

      const data = await res.json();

      if (data.decision === 'allow') {
        setActionStates((prev) => ({ ...prev, [actionId]: { status: 'done' } }));
        addActivity({ time: nowTime(), icon: '\u2713', message: `Allowed: ${config.operation} on ${config.target_integration}`, type: 'success' });
      } else if (data.decision === 'approval_required') {
        setActionStates((prev) => ({ ...prev, [actionId]: { status: 'awaiting' } }));
        if (data.trace_id) {
          setPendingTraces((prev) => ({ ...prev, [actionId]: data.trace_id }));
        }
        if (actionId === 'order-labs') {
          addActivity({ time: nowTime(), icon: '\u23F3', message: `Lab order pending physician approval: CMP + HbA1c for ${PATIENT.mrn}`, type: 'pending' });
        } else if (actionId === 'send-careplan') {
          addActivity({ time: nowTime(), icon: '\u23F3', message: 'Patient communication pending review: care plan update', type: 'pending' });
        } else {
          addActivity({ time: nowTime(), icon: '\u23F3', message: `Awaiting approval: ${config.operation}. Check governance panel \u2192`, type: 'pending' });
        }
      } else if (data.decision === 'deny') {
        setActionStates((prev) => ({ ...prev, [actionId]: { status: 'blocked' } }));
        if (actionId === 'prescribe-bp') {
          addActivity({ time: nowTime(), icon: '\u2717', message: 'BLOCKED: AI cannot prescribe medications. Physician must evaluate and order via EHR.', type: 'blocked' });
        } else if (actionId === 'modify-treatment') {
          addActivity({ time: nowTime(), icon: '\u2717', message: 'BLOCKED: Treatment plan modifications require physician clinical judgment.', type: 'blocked' });
        } else {
          addActivity({ time: nowTime(), icon: '\u2717', message: `BLOCKED: ${config.operation} — ${data.reason}`, type: 'blocked' });
        }
        // Reset after 3 seconds
        setTimeout(() => {
          setActionStates((prev) => ({ ...prev, [actionId]: { status: 'idle' } }));
        }, 3000);
      }
    } catch {
      setActionStates((prev) => ({ ...prev, [actionId]: { status: 'idle' } }));
      addActivity({ time: nowTime(), icon: '\u2717', message: `Error executing ${config.operation}`, type: 'blocked' });
    }
  };

  return (
    <div className="flex w-1/2 flex-col border-r border-[#2A2A2E]">
      {/* Header */}
      <div className="border-b border-[#2A2A2E] px-5 py-4">
        <h2 className="text-base font-medium text-[#E4E4E7]">Patient Chart — AI Clinical Assistant</h2>
        <p className="mt-1 text-sm text-[#71717A]">AI assistant has reviewed this patient&apos;s chart and generated recommendations.</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <PatientHeader />
        <VitalsPanel />

        {/* Conditions + Medications side by side */}
        <div className="grid grid-cols-2 gap-4">
          <ConditionsList />
          <MedicationsList />
        </div>

        <RecentLabs />
        <ClinicalNotes />
        <AIRecommendations actionStates={actionStates} onAction={handleAction} />
        <RestrictedActions actionStates={actionStates} onAction={handleAction} />
        <ClinicalActivityLog entries={activity} />
      </div>
    </div>
  );
}
