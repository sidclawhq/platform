import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const connectionString = process.env['DATABASE_URL'] ?? 'postgresql://agent_identity:agent_identity@localhost:5432/agent_identity';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...\n');

  // ── Tenant ───────────────────────────────────────────────────────────────

  const tenant = await prisma.tenant.upsert({
    where: { id: 'tenant-default' },
    update: {},
    create: {
      id: 'tenant-default',
      name: 'Development Workspace',
      slug: 'dev',
      plan: 'enterprise',
      settings: {
        default_approval_ttl_seconds: 86400,
        default_data_classification: 'internal',
        notification_email: null,
      },
      onboarding_state: {},
    },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // ── User ─────────────────────────────────────────────────────────────────

  const user = await prisma.user.upsert({
    where: { tenant_id_email: { tenant_id: 'tenant-default', email: 'admin@example.com' } },
    update: {},
    create: {
      id: 'user-admin',
      tenant_id: 'tenant-default',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      auth_provider: 'email',
      auth_provider_id: null,
      password_hash: null,
    },
  });
  console.log(`User: ${user.name} (${user.id})`);

  // ── API Key ──────────────────────────────────────────────────────────────

  const rawKey = `ai_dev_${crypto.randomBytes(16).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await prisma.apiKey.upsert({
    where: { id: 'apikey-dev' },
    update: {
      key_prefix: rawKey.substring(0, 12),
      key_hash: keyHash,
    },
    create: {
      id: 'apikey-dev',
      tenant_id: 'tenant-default',
      name: 'Development Key',
      key_prefix: rawKey.substring(0, 12),
      key_hash: keyHash,
      scopes: ['evaluate', 'traces:read', 'traces:write', 'approvals:read'],
    },
  });

  console.log(`API Key: ${apiKey.name} (${apiKey.id})`);
  console.log(`\nDevelopment API Key: ${rawKey}\n`);

  // Write key to deployment/.env.development
  const deploymentDir = path.resolve(import.meta.dirname, '..', '..', '..', 'deployment');
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  const envDevPath = path.join(deploymentDir, '.env.development');
  fs.writeFileSync(envDevPath, `AGENT_IDENTITY_API_KEY=${rawKey}\n`);
  console.log(`API key written to ${envDevPath}`);

  // ── Agents ───────────────────────────────────────────────────────────────

  const agents = [
    {
      id: 'agent-001',
      tenant_id: 'tenant-default',
      name: 'Customer Communications Agent',
      description: 'Drafts and routes outbound customer communications under delegated authority',
      owner_name: 'Sarah Chen',
      owner_role: 'Communications Lead',
      team: 'Customer Operations',
      environment: 'prod',
      authority_model: 'hybrid',
      identity_mode: 'hybrid_identity',
      delegation_model: 'on_behalf_of_owner',
      autonomy_tier: 'high',
      lifecycle_state: 'active',
      authorized_integrations: [
        {
          name: 'Communications Service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
          allowed_operations: ['draft', 'send'],
        },
        {
          name: 'CRM Platform',
          resource_scope: 'customer_records',
          data_classification: 'confidential',
          allowed_operations: ['read'],
        },
        {
          name: 'Template Engine',
          resource_scope: 'approved_templates',
          data_classification: 'internal',
          allowed_operations: ['read', 'render'],
        },
      ],
      metadata: null,
      next_review_date: '2026-04-18',
      created_by: 'seed-script',
    },
    {
      id: 'agent-002',
      tenant_id: 'tenant-default',
      name: 'Internal Knowledge Retrieval Agent',
      description: 'Retrieves internal knowledge and summarises documents',
      owner_name: 'David Kim',
      owner_role: 'Knowledge Systems Manager',
      team: 'Enterprise Architecture',
      environment: 'prod',
      authority_model: 'self',
      identity_mode: 'service_identity',
      delegation_model: 'self',
      autonomy_tier: 'low',
      lifecycle_state: 'active',
      authorized_integrations: [
        {
          name: 'Document Store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
          allowed_operations: ['read', 'summarize'],
        },
        {
          name: 'Policy Repository',
          resource_scope: 'policy_documents',
          data_classification: 'confidential',
          allowed_operations: ['read'],
        },
      ],
      metadata: null,
      next_review_date: '2026-05-02',
      created_by: 'seed-script',
    },
    {
      id: 'agent-003',
      tenant_id: 'tenant-default',
      name: 'Case Operations Agent',
      description: 'Writes structured updates into internal case management systems',
      owner_name: 'Rachel Torres',
      owner_role: 'Operations Director',
      team: 'Case Management',
      environment: 'prod',
      authority_model: 'delegated',
      identity_mode: 'delegated_identity',
      delegation_model: 'on_behalf_of_user',
      autonomy_tier: 'medium',
      lifecycle_state: 'active',
      authorized_integrations: [
        {
          name: 'Case Management System',
          resource_scope: 'active_cases',
          data_classification: 'confidential',
          allowed_operations: ['read', 'update', 'close'],
        },
        {
          name: 'Notification Service',
          resource_scope: 'internal_notifications',
          data_classification: 'internal',
          allowed_operations: ['send'],
        },
      ],
      metadata: null,
      next_review_date: '2026-04-25',
      created_by: 'seed-script',
    },
  ];

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      update: {},
      create: agent,
    });
    console.log(`Agent: ${agent.name} (${agent.id})`);
  }

  // ── Policy Rules ─────────────────────────────────────────────────────────

  const policies = [
    // Agent 001: Customer Communications Agent
    {
      id: 'pol-001',
      tenant_id: 'tenant-default',
      agent_id: 'agent-001',
      policy_name: 'Outbound customer email review',
      target_integration: 'communications_service',
      operation: 'send',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Outbound communication involving regulated customer context requires human review before release to ensure compliance with communication standards and data handling policies.',
      priority: 100,
      conditions: null,
      max_session_ttl: 14400,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-10T09:00:00Z'),
    },
    {
      id: 'pol-002',
      tenant_id: 'tenant-default',
      agent_id: 'agent-001',
      policy_name: 'Draft communication — internal templates',
      target_integration: 'template_engine',
      operation: 'render',
      resource_scope: 'approved_templates',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: "Rendering pre-approved templates against internal data is within the agent's permitted operational scope and does not require additional review.",
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-10T09:05:00Z'),
    },
    {
      id: 'pol-003',
      tenant_id: 'tenant-default',
      agent_id: 'agent-001',
      policy_name: 'Read customer records for context',
      target_integration: 'crm_platform',
      operation: 'read',
      resource_scope: 'customer_records',
      data_classification: 'confidential',
      policy_effect: 'allow',
      rationale: "Read-only access to customer records for communication context is permitted under the agent's delegated authority model with existing data classification controls.",
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-04T14:30:00Z'),
    },
    {
      id: 'pol-004',
      tenant_id: 'tenant-default',
      agent_id: 'agent-001',
      policy_name: 'Access restricted customer PII',
      target_integration: 'crm_platform',
      operation: 'export',
      resource_scope: 'customer_pii_records',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Direct export of restricted customer personally identifiable information is prohibited under data protection policy regardless of delegated authority.',
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-10T09:10:00Z'),
    },

    // Agent 002: Internal Knowledge Retrieval Agent
    {
      id: 'pol-005',
      tenant_id: 'tenant-default',
      agent_id: 'agent-002',
      policy_name: 'Retrieve internal knowledge base',
      target_integration: 'document_store',
      operation: 'read',
      resource_scope: 'internal_docs',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Read access to the internal knowledge base is within standard operational scope for a low-autonomy retrieval agent with service identity.',
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-11T10:00:00Z'),
    },
    {
      id: 'pol-006',
      tenant_id: 'tenant-default',
      agent_id: 'agent-002',
      policy_name: 'Summarize internal documents',
      target_integration: 'document_store',
      operation: 'summarize',
      resource_scope: 'internal_docs',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: "Document summarization within the internal knowledge base is a core function within the agent's permitted operational boundary.",
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-11T10:05:00Z'),
    },
    {
      id: 'pol-007',
      tenant_id: 'tenant-default',
      agent_id: 'agent-002',
      policy_name: 'Access confidential policy documents',
      target_integration: 'policy_repository',
      operation: 'read',
      resource_scope: 'policy_documents',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Access to confidential policy documents requires human approval to ensure need-to-know verification and prevent unauthorized distribution of governance materials.',
      priority: 100,
      conditions: null,
      max_session_ttl: 14400,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-11T10:10:00Z'),
    },
    {
      id: 'pol-008',
      tenant_id: 'tenant-default',
      agent_id: 'agent-002',
      policy_name: 'Access restricted board materials',
      target_integration: 'document_store',
      operation: 'read',
      resource_scope: 'board_materials',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: "Board-level and executive materials are classified as restricted and fall outside the retrieval agent's authorized scope under any operating model.",
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-05T11:00:00Z'),
    },

    // Agent 003: Case Operations Agent
    {
      id: 'pol-009',
      tenant_id: 'tenant-default',
      agent_id: 'agent-003',
      policy_name: 'Update active case records',
      target_integration: 'case_management_system',
      operation: 'update',
      resource_scope: 'active_cases',
      data_classification: 'confidential',
      policy_effect: 'allow',
      rationale: "Structured updates to active case records are within the agent's core operational scope and are governed by existing case management access controls.",
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-12T08:30:00Z'),
    },
    {
      id: 'pol-010',
      tenant_id: 'tenant-default',
      agent_id: 'agent-003',
      policy_name: 'Close case with financial impact',
      target_integration: 'case_management_system',
      operation: 'close',
      resource_scope: 'high_impact_cases',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Closing a case with financial impact above the defined threshold requires human review under the operational risk policy to ensure proper financial reconciliation.',
      priority: 100,
      conditions: null,
      max_session_ttl: 14400,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-12T08:35:00Z'),
    },
    {
      id: 'pol-011',
      tenant_id: 'tenant-default',
      agent_id: 'agent-003',
      policy_name: 'Access restricted legal hold cases',
      target_integration: 'case_management_system',
      operation: 'read',
      resource_scope: 'legal_hold_cases',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: "Legal hold case records are under restricted access control and cannot be accessed by automated agents to preserve litigation privilege and regulatory compliance.",
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-12T08:40:00Z'),
    },
    {
      id: 'pol-012',
      tenant_id: 'tenant-default',
      agent_id: 'agent-003',
      policy_name: 'Send internal team notification',
      target_integration: 'notification_service',
      operation: 'send',
      resource_scope: 'internal_notifications',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: "Sending notifications to internal team channels is a low-risk operation within the agent's standard operational permissions.",
      priority: 100,
      conditions: null,
      max_session_ttl: null,
      is_active: true,
      policy_version: 1,
      modified_by: 'Governance Admin',
      modified_at: new Date('2026-03-12T08:45:00Z'),
    },
  ];

  for (const policy of policies) {
    await prisma.policyRule.upsert({
      where: { id: policy.id },
      update: {},
      create: policy,
    });
    console.log(`Policy: ${policy.policy_name} (${policy.id})`);
  }

  // ── Audit Traces ─────────────────────────────────────────────────────────

  // Scenario 1: Approval pending — send notification (agent-001)
  await prisma.auditTrace.upsert({
    where: { id: 'trace-001' },
    update: {},
    create: {
      id: 'trace-001',
      tenant_id: 'tenant-default',
      agent_id: 'agent-001',
      authority_model: 'hybrid',
      requested_operation: 'send',
      target_integration: 'communications_service',
      resource_scope: 'customer_emails',
      parent_trace_id: null,
      final_outcome: 'in_progress',
      started_at: new Date('2026-03-20T14:30:00Z'),
    },
  });
  console.log('Trace: trace-001 (approval pending — send notification)');

  // Scenario 2: Approval pending — close case (agent-003)
  await prisma.auditTrace.upsert({
    where: { id: 'trace-002' },
    update: {},
    create: {
      id: 'trace-002',
      tenant_id: 'tenant-default',
      agent_id: 'agent-003',
      authority_model: 'delegated',
      requested_operation: 'close',
      target_integration: 'case_management_system',
      resource_scope: 'high_impact_cases',
      parent_trace_id: null,
      final_outcome: 'in_progress',
      started_at: new Date('2026-03-20T15:10:00Z'),
    },
  });
  console.log('Trace: trace-002 (approval pending — close case)');

  // Scenario 3: Auto-allowed — read documents (agent-002)
  await prisma.auditTrace.upsert({
    where: { id: 'trace-003' },
    update: {},
    create: {
      id: 'trace-003',
      tenant_id: 'tenant-default',
      agent_id: 'agent-002',
      authority_model: 'self',
      requested_operation: 'read',
      target_integration: 'document_store',
      resource_scope: 'internal_docs',
      parent_trace_id: null,
      final_outcome: 'executed',
      started_at: new Date('2026-03-20T13:45:00Z'),
      completed_at: new Date('2026-03-20T13:45:03Z'),
    },
  });
  console.log('Trace: trace-003 (auto-allowed — read documents)');

  // Scenario 4: Auto-blocked — export PII (agent-001)
  await prisma.auditTrace.upsert({
    where: { id: 'trace-004' },
    update: {},
    create: {
      id: 'trace-004',
      tenant_id: 'tenant-default',
      agent_id: 'agent-001',
      authority_model: 'hybrid',
      requested_operation: 'export',
      target_integration: 'crm_platform',
      resource_scope: 'customer_pii_records',
      parent_trace_id: null,
      final_outcome: 'blocked',
      started_at: new Date('2026-03-20T16:00:00Z'),
      completed_at: new Date('2026-03-20T16:00:02Z'),
    },
  });
  console.log('Trace: trace-004 (auto-blocked — export PII)');

  // ── Approval Requests ────────────────────────────────────────────────────

  // Scenario 1 approval
  await prisma.approvalRequest.upsert({
    where: { id: 'approval-001' },
    update: {},
    create: {
      id: 'approval-001',
      tenant_id: 'tenant-default',
      trace_id: 'trace-001',
      agent_id: 'agent-001',
      policy_rule_id: 'pol-001',
      requested_operation: 'send',
      target_integration: 'communications_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      authority_model: 'hybrid',
      delegated_from: 'Sarah Chen',
      policy_effect: 'approval_required',
      flag_reason: 'Outbound communication involving regulated customer context requires human review before release.',
      status: 'pending',
      requested_at: new Date('2026-03-20T14:30:02Z'),
      separation_of_duties_check: 'not_applicable',
    },
  });
  console.log('Approval: approval-001 (pending — send notification)');

  // Scenario 2 approval
  await prisma.approvalRequest.upsert({
    where: { id: 'approval-002' },
    update: {},
    create: {
      id: 'approval-002',
      tenant_id: 'tenant-default',
      trace_id: 'trace-002',
      agent_id: 'agent-003',
      policy_rule_id: 'pol-010',
      requested_operation: 'close',
      target_integration: 'case_management_system',
      resource_scope: 'high_impact_cases',
      data_classification: 'confidential',
      authority_model: 'delegated',
      delegated_from: 'Rachel Torres',
      policy_effect: 'approval_required',
      flag_reason: 'Closing a case with financial impact above threshold requires human review under operational risk policy.',
      status: 'pending',
      requested_at: new Date('2026-03-20T15:10:02Z'),
      separation_of_duties_check: 'not_applicable',
    },
  });
  console.log('Approval: approval-002 (pending — close case)');

  // ── Audit Events ─────────────────────────────────────────────────────────

  // Delete existing events to ensure idempotency (events don't have stable IDs for upsert)
  await prisma.auditEvent.deleteMany({
    where: { tenant_id: 'tenant-default' },
  });

  const allEvents = [
    // ── Scenario 1 events (trace-001, agent-001) ──
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-001',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'trace_initiated',
      actor_type: 'agent',
      actor_name: 'Customer Communications Agent',
      description: 'Agent initiated send operation on communications_service',
      status: 'started',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T14:30:00Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-001',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'identity_resolved',
      actor_type: 'system',
      actor_name: 'Identity Service',
      description: 'Resolved hybrid identity: service principal + delegated from Sarah Chen',
      status: 'resolved',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T14:30:00.500Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-001',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'policy_evaluated',
      actor_type: 'policy_engine',
      actor_name: 'Policy Engine',
      description: 'Policy "Outbound customer email review" matched — effect: approval_required',
      status: 'evaluated',
      policy_version: 1,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T14:30:01Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-001',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'sensitive_operation_detected',
      actor_type: 'policy_engine',
      actor_name: 'Policy Engine',
      description: 'Confidential data classification detected on outbound communication channel',
      status: 'flagged',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T14:30:01.500Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-001',
      agent_id: 'agent-001',
      approval_request_id: 'approval-001',
      event_type: 'approval_requested',
      actor_type: 'approval_service',
      actor_name: 'Approval Service',
      description: 'Approval request created — awaiting human reviewer',
      status: 'pending',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T14:30:02Z'),
    },

    // ── Scenario 2 events (trace-002, agent-003) ──
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-002',
      agent_id: 'agent-003',
      approval_request_id: null,
      event_type: 'trace_initiated',
      actor_type: 'agent',
      actor_name: 'Case Operations Agent',
      description: 'Agent initiated close operation on case_management_system',
      status: 'started',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T15:10:00Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-002',
      agent_id: 'agent-003',
      approval_request_id: null,
      event_type: 'identity_resolved',
      actor_type: 'system',
      actor_name: 'Identity Service',
      description: 'Resolved delegated identity: acting on behalf of Rachel Torres',
      status: 'resolved',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T15:10:00.500Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-002',
      agent_id: 'agent-003',
      approval_request_id: null,
      event_type: 'delegation_resolved',
      actor_type: 'system',
      actor_name: 'Identity Service',
      description: 'Delegation chain verified: Rachel Torres → Case Operations Agent',
      status: 'verified',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T15:10:00.800Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-002',
      agent_id: 'agent-003',
      approval_request_id: null,
      event_type: 'policy_evaluated',
      actor_type: 'policy_engine',
      actor_name: 'Policy Engine',
      description: 'Policy "Close case with financial impact" matched — effect: approval_required',
      status: 'evaluated',
      policy_version: 1,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T15:10:01Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-002',
      agent_id: 'agent-003',
      approval_request_id: 'approval-002',
      event_type: 'approval_requested',
      actor_type: 'approval_service',
      actor_name: 'Approval Service',
      description: 'Approval request created — awaiting human reviewer',
      status: 'pending',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T15:10:02Z'),
    },

    // ── Scenario 3 events (trace-003, agent-002) ──
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-003',
      agent_id: 'agent-002',
      approval_request_id: null,
      event_type: 'trace_initiated',
      actor_type: 'agent',
      actor_name: 'Internal Knowledge Retrieval Agent',
      description: 'Agent initiated read operation on document_store',
      status: 'started',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T13:45:00Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-003',
      agent_id: 'agent-002',
      approval_request_id: null,
      event_type: 'identity_resolved',
      actor_type: 'system',
      actor_name: 'Identity Service',
      description: 'Resolved service identity: self-authorized agent',
      status: 'resolved',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T13:45:00.500Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-003',
      agent_id: 'agent-002',
      approval_request_id: null,
      event_type: 'policy_evaluated',
      actor_type: 'policy_engine',
      actor_name: 'Policy Engine',
      description: 'Policy "Retrieve internal knowledge base" matched — effect: allow',
      status: 'evaluated',
      policy_version: 1,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T13:45:01Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-003',
      agent_id: 'agent-002',
      approval_request_id: null,
      event_type: 'operation_allowed',
      actor_type: 'policy_engine',
      actor_name: 'Policy Engine',
      description: 'Operation allowed by policy — no approval required',
      status: 'allowed',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T13:45:01.500Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-003',
      agent_id: 'agent-002',
      approval_request_id: null,
      event_type: 'operation_executed',
      actor_type: 'agent',
      actor_name: 'Internal Knowledge Retrieval Agent',
      description: 'Read operation completed successfully — 3 documents retrieved',
      status: 'success',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T13:45:02.500Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-003',
      agent_id: 'agent-002',
      approval_request_id: null,
      event_type: 'trace_closed',
      actor_type: 'system',
      actor_name: 'Trace Service',
      description: 'Trace completed with outcome: executed',
      status: 'closed',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T13:45:03Z'),
    },

    // ── Scenario 4 events (trace-004, agent-001) ──
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-004',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'trace_initiated',
      actor_type: 'agent',
      actor_name: 'Customer Communications Agent',
      description: 'Agent initiated export operation on crm_platform',
      status: 'started',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T16:00:00Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-004',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'identity_resolved',
      actor_type: 'system',
      actor_name: 'Identity Service',
      description: 'Resolved hybrid identity: service principal + delegated from Sarah Chen',
      status: 'resolved',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T16:00:00.500Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-004',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'policy_evaluated',
      actor_type: 'policy_engine',
      actor_name: 'Policy Engine',
      description: 'Policy "Access restricted customer PII" matched — effect: deny',
      status: 'evaluated',
      policy_version: 1,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T16:00:01Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-004',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'operation_denied',
      actor_type: 'policy_engine',
      actor_name: 'Policy Engine',
      description: 'Operation denied — restricted PII export prohibited regardless of authority model',
      status: 'denied',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T16:00:01.500Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-004',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'operation_blocked',
      actor_type: 'system',
      actor_name: 'Enforcement Service',
      description: 'Action blocked before execution — no data accessed',
      status: 'blocked',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T16:00:01.800Z'),
    },
    {
      tenant_id: 'tenant-default',
      trace_id: 'trace-004',
      agent_id: 'agent-001',
      approval_request_id: null,
      event_type: 'trace_closed',
      actor_type: 'system',
      actor_name: 'Trace Service',
      description: 'Trace completed with outcome: blocked',
      status: 'closed',
      policy_version: null,
      correlation_id: null,
      metadata: null,
      timestamp: new Date('2026-03-20T16:00:02Z'),
    },
  ];

  await prisma.auditEvent.createMany({ data: allEvents });
  console.log(`\nCreated ${allEvents.length} audit events across 4 traces`);

  // ── Summary ──────────────────────────────────────────────────────────────

  const counts = {
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    agents: await prisma.agent.count(),
    policies: await prisma.policyRule.count(),
    approvals: await prisma.approvalRequest.count(),
    traces: await prisma.auditTrace.count(),
    events: await prisma.auditEvent.count(),
    apiKeys: await prisma.apiKey.count(),
  };

  console.log('\n── Seed Summary ──');
  console.log(`Tenants:    ${counts.tenants}`);
  console.log(`Users:      ${counts.users}`);
  console.log(`Agents:     ${counts.agents}`);
  console.log(`Policies:   ${counts.policies}`);
  console.log(`Approvals:  ${counts.approvals}`);
  console.log(`Traces:     ${counts.traces}`);
  console.log(`Events:     ${counts.events}`);
  console.log(`API Keys:   ${counts.apiKeys}`);
  console.log('\nDone!\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
