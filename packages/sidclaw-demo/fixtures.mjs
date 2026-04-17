// Pre-loaded governance scenarios for the `npx sidclaw-demo` landing page.
// Each scenario is an approval record with enough context to render an
// Institutional-Calm approval card — policy, risk score, flag reason, agent
// reasoning, data classification, and the raw action payload.
//
// License: MIT

export const scenarios = [
  {
    id: 'scn-claude-code-rm-rf',
    status: 'pending',
    risk_classification: 'critical',
    risk_score: 95,
    agent: {
      id: 'claude-code',
      name: 'Claude Code',
      owner: 'You',
      environment: 'local',
    },
    action: {
      operation: 'bash.destructive',
      target_integration: 'claude_code',
      resource_scope: 'rm -rf ./data/',
      data_classification: 'restricted',
      declared_goal: 'Clean up stale migration artifacts per user request',
      raw_payload: {
        command: 'rm -rf ./data/',
        tool_name: 'Bash',
      },
    },
    policy: {
      id: 'pol-bash-destructive',
      name: 'Destructive bash requires approval',
      rationale:
        'Irreversible filesystem operations (rm -rf, shred, dd, mkfs, DROP TABLE) must be reviewed by a human before execution.',
      effect: 'approval_required',
      priority: 10,
    },
    flag_reason:
      'Irreversible delete of the ./data/ directory. The classifier detected `rm -rf` + `reversible=false`.',
    requested_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 28 * 60 * 1000).toISOString(),
    trace_events: [
      { type: 'trace_initiated', actor: 'Claude Code', status: 'started', offset_ms: 0 },
      { type: 'identity_resolved', actor: 'Policy Engine', status: 'ok', offset_ms: 4 },
      { type: 'policy_evaluated', actor: 'Policy Engine', status: 'matched', offset_ms: 12 },
      { type: 'sensitive_operation_detected', actor: 'Risk Classifier', status: 'flagged', offset_ms: 18 },
      { type: 'approval_requested', actor: 'Approval Service', status: 'pending', offset_ms: 22 },
    ],
    interactive: true,
  },
  {
    id: 'scn-fintech-trade',
    status: 'pending',
    risk_classification: 'high',
    risk_score: 85,
    agent: {
      id: 'portfolio-rebalancer',
      name: 'Portfolio Rebalancer',
      owner: 'Sarah Chen · Capital Markets',
      environment: 'production',
    },
    action: {
      operation: 'execute_trade',
      target_integration: 'trading_api',
      resource_scope: 'equities.us',
      data_classification: 'confidential',
      declared_goal:
        'Rebalance the Q2 tech-heavy portfolio, reducing AAPL exposure to meet allocation bands.',
      raw_payload: {
        symbol: 'AAPL',
        quantity: 500,
        side: 'sell',
        estimated_value_usd: 107500,
      },
    },
    policy: {
      id: 'pol-finra-trade-threshold',
      name: 'FINRA 2026 — trades over $10K require human approval',
      rationale:
        'FINRA Rule 3110 requires supervisory review of AI-initiated trades above the desk discretion threshold.',
      effect: 'approval_required',
      priority: 5,
    },
    flag_reason: 'Estimated value ($107,500) exceeds the $10K desk discretion threshold.',
    requested_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    trace_events: [
      { type: 'trace_initiated', actor: 'Portfolio Rebalancer', status: 'started', offset_ms: 0 },
      { type: 'policy_evaluated', actor: 'Policy Engine', status: 'matched', offset_ms: 9 },
      { type: 'approval_requested', actor: 'Approval Service', status: 'pending', offset_ms: 14 },
    ],
    interactive: true,
  },
  {
    id: 'scn-devops-scale-zero',
    status: 'approved',
    risk_classification: 'high',
    risk_score: 90,
    agent: {
      id: 'infra-bot',
      name: 'Nexus Infra Bot',
      owner: 'Marcus Webb · Platform Engineering',
      environment: 'production',
    },
    action: {
      operation: 'kubectl_scale',
      target_integration: 'kubernetes',
      resource_scope: 'deployment.api-server',
      data_classification: 'confidential',
      declared_goal: 'Drain production API for scheduled maintenance window at 03:00 UTC.',
      raw_payload: {
        deployment: 'api-server',
        namespace: 'prod',
        replicas: 0,
      },
    },
    policy: {
      id: 'pol-k8s-scale-zero',
      name: 'Scaling production to zero requires approval',
      rationale: 'Taking production to zero replicas risks customer-facing downtime.',
      effect: 'approval_required',
      priority: 20,
    },
    flag_reason: 'replicas=0 on a production deployment.',
    decision: {
      status: 'approved',
      approver_name: 'Marcus Webb',
      decided_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      note: 'Approved — maintenance window CR-4021.',
    },
    requested_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    trace_events: [
      { type: 'trace_initiated', actor: 'Nexus Infra Bot', status: 'started', offset_ms: 0 },
      { type: 'policy_evaluated', actor: 'Policy Engine', status: 'matched', offset_ms: 7 },
      { type: 'approval_requested', actor: 'Approval Service', status: 'pending', offset_ms: 11 },
      { type: 'approval_decided', actor: 'Marcus Webb', status: 'approved', offset_ms: 303000 },
      { type: 'operation_executed', actor: 'Nexus Infra Bot', status: 'success', offset_ms: 303400 },
    ],
    interactive: false,
  },
  {
    id: 'scn-healthcare-lab-order',
    status: 'denied',
    risk_classification: 'medium',
    risk_score: 60,
    agent: {
      id: 'clinical-assistant',
      name: 'MedAssist Clinical Assistant',
      owner: 'Dr. Priya Sharma · Internal Medicine',
      environment: 'clinical',
    },
    action: {
      operation: 'order_lab_test',
      target_integration: 'ehr',
      resource_scope: 'patient.P-4521',
      data_classification: 'restricted',
      declared_goal:
        'Order CBC as part of annual wellness workup — patient discussed fatigue symptoms.',
      raw_payload: {
        patient_id: 'P-4521',
        test: 'CBC',
        urgency: 'routine',
      },
    },
    policy: {
      id: 'pol-hipaa-lab-orders',
      name: 'Lab orders require physician approval',
      rationale: 'HIPAA-protected clinical workflow — all AI-generated lab orders must be co-signed.',
      effect: 'approval_required',
      priority: 15,
    },
    flag_reason: 'Automated lab order without prior physician chart review.',
    decision: {
      status: 'denied',
      approver_name: 'Dr. Priya Sharma',
      decided_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      note: 'Deferred — discussing differential at tomorrow\'s 10:00 visit.',
    },
    requested_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    trace_events: [
      { type: 'trace_initiated', actor: 'MedAssist Clinical Assistant', status: 'started', offset_ms: 0 },
      { type: 'policy_evaluated', actor: 'Policy Engine', status: 'matched', offset_ms: 6 },
      { type: 'approval_requested', actor: 'Approval Service', status: 'pending', offset_ms: 10 },
      { type: 'approval_decided', actor: 'Dr. Priya Sharma', status: 'denied', offset_ms: 68000 },
      { type: 'operation_blocked', actor: 'Approval Service', status: 'blocked', offset_ms: 68100 },
    ],
    interactive: false,
  },
];

export function findScenario(id) {
  return scenarios.find((s) => s.id === id);
}
