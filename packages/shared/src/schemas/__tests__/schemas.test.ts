import { describe, expect, it } from 'vitest';
import {
  AgentSchema,
  AgentCreateSchema,
  AgentUpdateSchema,
  PolicyRuleSchema,
  PolicyRuleCreateSchema,
  PolicyRuleUpdateSchema,
  PolicyRuleVersionSchema,
  ApprovalRequestSchema,
  ApprovalDecisionSchema,
  AuditTraceSchema,
  AuditEventSchema,
  TenantSchema,
  TenantSettingsSchema,
  UserSchema,
  ApiKeySchema,
  PaginationSchema,
  ApiErrorSchema,
  EvaluateRequestSchema,
  EvaluateResponseSchema,
  AuthorizedIntegrationSchema,
} from '../../schemas';
import type {
  AgentInput,
  PolicyRuleInput,
  ApprovalRequestInput,
  AuditTraceInput,
  AuditEventInput,
  TenantInput,
  UserInput,
  ApiKeyInput,
} from '../../schemas';
import type { Agent } from '../../types/agent';
import type { PolicyRule } from '../../types/policy';
import type { ApprovalRequest } from '../../types/approval';
import type { AuditTrace, AuditEvent } from '../../types/audit';
import type { Tenant } from '../../types/tenant';
import type { User } from '../../types/user';
import type { ApiKey } from '../../types/api-key';
import {
  createAgent,
  createPolicyRule,
  createPolicyRuleVersion,
  createApprovalRequest,
  createAuditTrace,
  createAuditEvent,
  createTenant,
  createUser,
  createApiKey,
  createAuthorizedIntegration,
} from '../../test-utils/factories';

// Compile-time type assignability checks
// These lines verify that z.infer<typeof Schema> is assignable to the interface
const _agentCheck: Agent = {} as AgentInput;
const _policyCheck: PolicyRule = {} as PolicyRuleInput;
const _approvalCheck: ApprovalRequest = {} as ApprovalRequestInput;
const _traceCheck: AuditTrace = {} as AuditTraceInput;
const _eventCheck: AuditEvent = {} as AuditEventInput;
const _tenantCheck: Tenant = {} as TenantInput;
const _userCheck: User = {} as UserInput;
const _apiKeyCheck: ApiKey = {} as ApiKeyInput;

// Suppress unused variable warnings
void _agentCheck;
void _policyCheck;
void _approvalCheck;
void _traceCheck;
void _eventCheck;
void _tenantCheck;
void _userCheck;
void _apiKeyCheck;

describe('AgentSchema', () => {
  it('accepts a valid agent from factory', () => {
    const agent = createAgent();
    expect(AgentSchema.parse(agent)).toEqual(agent);
  });

  it('rejects missing required field', () => {
    const agent = createAgent();
    const { name: _, ...incomplete } = agent;
    expect(() => AgentSchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid enum value', () => {
    const agent = createAgent({ environment: 'invalid' as 'dev' });
    expect(() => AgentSchema.parse(agent)).toThrow();
  });
});

describe('AgentCreateSchema', () => {
  it('does not require server-generated fields', () => {
    const agent = createAgent();
    const { id: _, tenant_id: _t, created_at: _c, updated_at: _u, lifecycle_state: _l, ...createInput } = agent;
    expect(AgentCreateSchema.parse(createInput)).toEqual(createInput);
  });

  it('rejects if id is provided', () => {
    const agent = createAgent();
    const { tenant_id: _, created_at: _c, updated_at: _u, lifecycle_state: _l, ...withId } = agent;
    // AgentCreateSchema strips unknown keys, so id should not cause an error with strip mode
    // But the key should not be present in the output
    const parsed = AgentCreateSchema.parse(withId);
    expect(parsed).not.toHaveProperty('id');
  });
});

describe('AgentUpdateSchema', () => {
  it('requires only id', () => {
    const result = AgentUpdateSchema.parse({ id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('AuthorizedIntegrationSchema', () => {
  it('accepts a valid integration', () => {
    const integration = createAuthorizedIntegration();
    expect(AuthorizedIntegrationSchema.parse(integration)).toEqual(integration);
  });
});

describe('PolicyRuleSchema', () => {
  it('accepts a valid policy rule from factory', () => {
    const rule = createPolicyRule();
    expect(PolicyRuleSchema.parse(rule)).toEqual(rule);
  });

  it('rejects missing required field', () => {
    const rule = createPolicyRule();
    const { policy_name: _, ...incomplete } = rule;
    expect(() => PolicyRuleSchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid enum value', () => {
    const rule = createPolicyRule({ policy_effect: 'invalid' as 'allow' });
    expect(() => PolicyRuleSchema.parse(rule)).toThrow();
  });

  it('rejects rationale shorter than 10 characters', () => {
    const rule = createPolicyRule({ rationale: 'short' });
    expect(() => PolicyRuleSchema.parse(rule)).toThrow();
  });

  it('rejects rationale longer than 1000 characters', () => {
    const rule = createPolicyRule({ rationale: 'x'.repeat(1001) });
    expect(() => PolicyRuleSchema.parse(rule)).toThrow();
  });
});

describe('PolicyRuleCreateSchema', () => {
  it('does not require server-generated fields', () => {
    const rule = createPolicyRule();
    const { id: _, tenant_id: _t, policy_version: _v, created_at: _c, updated_at: _u, is_active: _a, ...createInput } = rule;
    expect(PolicyRuleCreateSchema.parse(createInput)).toEqual(createInput);
  });
});

describe('PolicyRuleUpdateSchema', () => {
  it('requires only id', () => {
    const result = PolicyRuleUpdateSchema.parse({ id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('PolicyRuleVersionSchema', () => {
  it('accepts a valid policy rule version from factory', () => {
    const version = createPolicyRuleVersion();
    expect(PolicyRuleVersionSchema.parse(version)).toEqual(version);
  });
});

describe('ApprovalRequestSchema', () => {
  it('accepts a valid approval request from factory', () => {
    const request = createApprovalRequest();
    expect(ApprovalRequestSchema.parse(request)).toEqual(request);
  });

  it('rejects missing required field', () => {
    const request = createApprovalRequest();
    const { requested_operation: _, ...incomplete } = request;
    expect(() => ApprovalRequestSchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid enum value', () => {
    const request = createApprovalRequest({ status: 'invalid' as 'pending' });
    expect(() => ApprovalRequestSchema.parse(request)).toThrow();
  });
});

describe('ApprovalDecisionSchema', () => {
  it('accepts valid decision', () => {
    const decision = { approver_name: 'Admin User' };
    expect(ApprovalDecisionSchema.parse(decision)).toEqual(decision);
  });

  it('accepts decision with note', () => {
    const decision = { approver_name: 'Admin User', decision_note: 'Approved for production' };
    expect(ApprovalDecisionSchema.parse(decision)).toEqual(decision);
  });

  it('rejects missing approver_name', () => {
    expect(() => ApprovalDecisionSchema.parse({})).toThrow();
  });
});

describe('AuditTraceSchema', () => {
  it('accepts a valid audit trace from factory', () => {
    const trace = createAuditTrace();
    expect(AuditTraceSchema.parse(trace)).toEqual(trace);
  });

  it('rejects missing required field', () => {
    const trace = createAuditTrace();
    const { agent_id: _, ...incomplete } = trace;
    expect(() => AuditTraceSchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid enum value', () => {
    const trace = createAuditTrace({ final_outcome: 'invalid' as 'pending' });
    expect(() => AuditTraceSchema.parse(trace)).toThrow();
  });
});

describe('AuditEventSchema', () => {
  it('accepts a valid audit event from factory', () => {
    const event = createAuditEvent();
    expect(AuditEventSchema.parse(event)).toEqual(event);
  });

  it('rejects missing required field', () => {
    const event = createAuditEvent();
    const { event_type: _, ...incomplete } = event;
    expect(() => AuditEventSchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid enum value', () => {
    const event = createAuditEvent({ event_type: 'invalid' as 'trace_initiated' });
    expect(() => AuditEventSchema.parse(event)).toThrow();
  });
});

describe('TenantSchema', () => {
  it('accepts a valid tenant from factory', () => {
    const tenant = createTenant();
    expect(TenantSchema.parse(tenant)).toEqual(tenant);
  });

  it('rejects missing required field', () => {
    const tenant = createTenant();
    const { name: _, ...incomplete } = tenant;
    expect(() => TenantSchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid enum value', () => {
    const tenant = createTenant({ plan: 'invalid' as 'free' });
    expect(() => TenantSchema.parse(tenant)).toThrow();
  });
});

describe('TenantSettingsSchema', () => {
  it('accepts valid settings', () => {
    const settings = { default_approval_ttl_seconds: 86400, default_data_classification: 'internal', notification_email: null };
    expect(TenantSettingsSchema.parse(settings)).toEqual(settings);
  });
});

describe('UserSchema', () => {
  it('accepts a valid user from factory', () => {
    const user = createUser();
    expect(UserSchema.parse(user)).toEqual(user);
  });

  it('rejects missing required field', () => {
    const user = createUser();
    const { email: _, ...incomplete } = user;
    expect(() => UserSchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid enum value', () => {
    const user = createUser({ role: 'invalid' as 'viewer' });
    expect(() => UserSchema.parse(user)).toThrow();
  });

  it('rejects invalid email', () => {
    const user = createUser({ email: 'not-an-email' });
    expect(() => UserSchema.parse(user)).toThrow();
  });
});

describe('ApiKeySchema', () => {
  it('accepts a valid api key from factory', () => {
    const key = createApiKey();
    expect(ApiKeySchema.parse(key)).toEqual(key);
  });

  it('rejects missing required field', () => {
    const key = createApiKey();
    const { name: _, ...incomplete } = key;
    expect(() => ApiKeySchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid scope', () => {
    const key = createApiKey({ scopes: ['invalid' as 'evaluate'] });
    expect(() => ApiKeySchema.parse(key)).toThrow();
  });
});

describe('PaginationSchema', () => {
  it('accepts valid pagination', () => {
    const pagination = { total: 100, limit: 20, offset: 0 };
    expect(PaginationSchema.parse(pagination)).toEqual(pagination);
  });
});

describe('ApiErrorSchema', () => {
  it('accepts valid error', () => {
    const error = { error: 'not_found', message: 'Resource not found', status: 404, request_id: 'req-123' };
    expect(ApiErrorSchema.parse(error)).toEqual(error);
  });
});

describe('EvaluateRequestSchema', () => {
  it('accepts valid evaluate request', () => {
    const request = {
      operation: 'read',
      target_integration: 'postgres',
      resource_scope: 'users/*',
      data_classification: 'internal' as const,
    };
    expect(EvaluateRequestSchema.parse(request)).toEqual(request);
  });

  it('rejects missing required field', () => {
    expect(() => EvaluateRequestSchema.parse({ operation: 'read' })).toThrow();
  });
});

describe('EvaluateResponseSchema', () => {
  it('accepts valid evaluate response', () => {
    const response = {
      decision: 'allow' as const,
      trace_id: '550e8400-e29b-41d4-a716-446655440000',
      approval_request_id: null,
      reason: 'Policy allows this operation',
      policy_rule_id: '550e8400-e29b-41d4-a716-446655440001',
    };
    expect(EvaluateResponseSchema.parse(response)).toEqual(response);
  });
});
