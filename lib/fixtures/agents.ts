import type { Agent } from '@/lib/types';

export const SEED_AGENTS: Agent[] = [
  {
    id: 'agent-001',
    name: 'Customer Communications Agent',
    description:
      'Drafts and routes outbound customer communications under delegated authority',
    owner_name: 'Sarah Chen',
    owner_role: 'Service Operations Lead',
    team: 'Customer Operations',
    environment: 'prod',
    authority_model: 'hybrid',
    identity_mode: 'hybrid_identity',
    delegation_model: 'on_behalf_of_owner',
    autonomy_tier: 'medium',
    lifecycle_state: 'active',
    authorized_integrations: [
      {
        name: 'Communications Service',
        resource_scope: 'Outbound customer communications',
        data_classification: 'confidential',
        allowed_operations: ['draft', 'send'],
      },
      {
        name: 'CRM Platform',
        resource_scope: 'Customer records (read-only)',
        data_classification: 'confidential',
        allowed_operations: ['read'],
      },
      {
        name: 'Template Engine',
        resource_scope: 'Approved communication templates',
        data_classification: 'internal',
        allowed_operations: ['read', 'render'],
      },
    ],
    next_review_date: '2026-04-18',
    recent_activity_state: '3 operations this week',
  },
  {
    id: 'agent-002',
    name: 'Internal Knowledge Retrieval Agent',
    description:
      'Retrieves internal knowledge and summarises documents',
    owner_name: 'Marcus Webb',
    owner_role: 'Knowledge Systems Lead',
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
        resource_scope: 'Internal knowledge base',
        data_classification: 'internal',
        allowed_operations: ['read', 'summarize'],
      },
      {
        name: 'Policy Repository',
        resource_scope: 'Published policy documents',
        data_classification: 'confidential',
        allowed_operations: ['read'],
      },
    ],
    next_review_date: '2026-05-02',
    recent_activity_state: '12 operations this week',
  },
  {
    id: 'agent-003',
    name: 'Case Operations Agent',
    description:
      'Writes structured updates into internal case management systems',
    owner_name: 'Priya Sharma',
    owner_role: 'Operations Manager',
    team: 'Case Management',
    environment: 'prod',
    authority_model: 'self',
    identity_mode: 'service_identity',
    delegation_model: 'self',
    autonomy_tier: 'medium',
    lifecycle_state: 'active',
    authorized_integrations: [
      {
        name: 'Case Management System',
        resource_scope: 'Active case records',
        data_classification: 'confidential',
        allowed_operations: ['read', 'update', 'close'],
      },
      {
        name: 'Notification Service',
        resource_scope: 'Internal team notifications',
        data_classification: 'internal',
        allowed_operations: ['send'],
      },
    ],
    next_review_date: '2026-04-25',
    recent_activity_state: '7 operations this week',
  },
];
