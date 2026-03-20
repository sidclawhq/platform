import type { ApprovalRequest } from '@/lib/types';

export const SEED_APPROVALS: ApprovalRequest[] = [
  {
    id: 'apr-001',
    trace_id: 'TR-2048',
    agent_id: 'agent-001',
    requested_operation: 'Send outbound policy change notification',
    target_integration: 'Communications Service',
    resource_scope: 'Outbound customer communications',
    data_classification: 'confidential',
    authority_model: 'hybrid',
    delegated_from: 'Sarah Chen',
    policy_effect: 'approval_required',
    flag_reason:
      'This operation would send regulated customer-facing communication using confidential context. Policy requires human approval before release.',
    status: 'pending',
    requested_at: '2026-03-19T14:42:00Z',
    decided_at: null,
    approver_name: null,
    decision_note: null,
    separation_of_duties_check: 'pass',
  },
  {
    id: 'apr-002',
    trace_id: 'TR-2051',
    agent_id: 'agent-003',
    requested_operation: 'Close case #4892 with financial impact',
    target_integration: 'Case Management System',
    resource_scope: 'Cases with financial impact above threshold',
    data_classification: 'confidential',
    authority_model: 'delegated',
    delegated_from: 'Priya Sharma',
    policy_effect: 'approval_required',
    flag_reason:
      'Closing a case with financial impact above threshold requires human review under operational risk policy. Agent operates under delegated authority from the operations manager.',
    status: 'pending',
    requested_at: '2026-03-19T15:18:00Z',
    decided_at: null,
    approver_name: null,
    decision_note: null,
    separation_of_duties_check: 'pass',
  },
];
