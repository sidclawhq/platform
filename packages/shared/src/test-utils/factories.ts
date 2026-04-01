import { randomUUID } from 'node:crypto';
import type { Agent, AuthorizedIntegration } from '../types/agent';
import type { PolicyRule, PolicyRuleVersion } from '../types/policy';
import type { ApprovalRequest } from '../types/approval';
import type { AuditTrace, AuditEvent } from '../types/audit';
import type { Tenant, TenantSettings } from '../types/tenant';
import type { User } from '../types/user';
import type { ApiKey } from '../types/api-key';

export function createAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    name: 'Test Agent',
    description: 'A test agent for unit testing',
    owner_name: 'Test Owner',
    owner_role: 'Platform Engineering',
    team: 'Platform',
    environment: 'dev',
    authority_model: 'self',
    identity_mode: 'service_identity',
    delegation_model: 'self',
    autonomy_tier: 'low',
    lifecycle_state: 'active',
    authorized_integrations: [],
    credential_config: null,
    metadata: null,
    next_review_date: new Date(Date.now() + 90 * 86400000).toISOString(),
    created_by: 'test-setup',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createAuthorizedIntegration(overrides?: Partial<AuthorizedIntegration>): AuthorizedIntegration {
  return {
    name: 'test-integration',
    resource_scope: 'test/*',
    data_classification: 'internal',
    allowed_operations: ['read'],
    ...overrides,
  };
}

export function createPolicyRule(overrides?: Partial<PolicyRule>): PolicyRule {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    agent_id: randomUUID(),
    policy_name: 'Test Policy',
    target_integration: 'test-integration',
    operation: 'read',
    resource_scope: 'test/*',
    data_classification: 'internal',
    policy_effect: 'allow',
    rationale: 'Allow read access to test resources for development purposes',
    priority: 100,
    conditions: null,
    max_session_ttl: null,
    is_active: true,
    policy_version: 1,
    modified_by: 'test-setup',
    modified_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createPolicyRuleVersion(overrides?: Partial<PolicyRuleVersion>): PolicyRuleVersion {
  return {
    id: randomUUID(),
    policy_rule_id: randomUUID(),
    version: 1,
    policy_name: 'Test Policy',
    operation: 'read',
    target_integration: 'test-integration',
    resource_scope: 'test/*',
    data_classification: 'internal',
    policy_effect: 'allow',
    rationale: 'Allow read access to test resources for development purposes',
    priority: 100,
    conditions: null,
    max_session_ttl: null,
    modified_by: 'test-setup',
    modified_at: new Date().toISOString(),
    change_summary: null,
    ...overrides,
  };
}

export function createApprovalRequest(overrides?: Partial<ApprovalRequest>): ApprovalRequest {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    trace_id: randomUUID(),
    agent_id: randomUUID(),
    requested_operation: 'write',
    target_integration: 'test-integration',
    resource_scope: 'prod/*',
    data_classification: 'confidential',
    risk_classification: 'high',
    authority_model: 'delegated',
    delegated_from: null,
    policy_effect: 'approval_required',
    flag_reason: 'Write to production confidential resource requires approval',
    status: 'pending',
    context_snapshot: null,
    alternatives: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    requested_at: new Date().toISOString(),
    decided_at: null,
    approver_name: null,
    decision_note: null,
    separation_of_duties_check: 'not_applicable',
    ...overrides,
  };
}

export function createAuditTrace(overrides?: Partial<AuditTrace>): AuditTrace {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    agent_id: randomUUID(),
    authority_model: 'self',
    requested_operation: 'read',
    target_integration: 'test-integration',
    resource_scope: 'test/*',
    parent_trace_id: null,
    credential_id: null,
    integrity_hash: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    final_outcome: 'in_progress',
    deleted_at: null,
    ...overrides,
  };
}

export function createAuditEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    trace_id: randomUUID(),
    agent_id: randomUUID(),
    approval_request_id: null,
    timestamp: new Date().toISOString(),
    event_type: 'trace_initiated',
    actor_type: 'agent',
    actor_name: 'test-agent',
    description: 'Trace initiated for test operation',
    status: 'ok',
    policy_version: null,
    correlation_id: null,
    metadata: null,
    integrity_hash: null,
    deleted_at: null,
    ...overrides,
  };
}

export function createTenantSettings(overrides?: Partial<TenantSettings>): TenantSettings {
  return {
    default_approval_ttl_seconds: 86400,
    default_data_classification: 'internal',
    notification_email: null,
    ...overrides,
  };
}

export function createTenant(overrides?: Partial<Tenant>): Tenant {
  return {
    id: randomUUID(),
    name: 'Test Tenant',
    slug: 'test-tenant',
    plan: 'free',
    settings: createTenantSettings(),
    onboarding_state: {},
    stripe_customer_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createUser(overrides?: Partial<User>): User {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    email: 'test@example.com',
    name: 'Test User',
    role: 'viewer',
    auth_provider: 'email',
    auth_provider_id: null,
    password_hash: null,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createApiKey(overrides?: Partial<ApiKey>): ApiKey {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    name: 'Test API Key',
    key_prefix: 'ak_test_1234',
    key_hash: 'sha256_placeholder_hash_value_for_testing',
    scopes: ['evaluate'],
    expires_at: null,
    last_used_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
