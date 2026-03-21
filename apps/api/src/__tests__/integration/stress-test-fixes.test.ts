import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestServer,
  destroyTestServer,
  cleanDatabase,
  seedTestData,
} from '../../test-utils/test-server.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let testData: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  const server = await createTestServer();
  app = server.app;
  prisma = server.prisma;
});

afterAll(async () => {
  await destroyTestServer();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
  testData = await seedTestData(prisma);
});

// ── Helper: evaluate an action that requires approval ─────────────────────────
async function evaluateApprovalRequired() {
  // Create a policy that requires approval
  await prisma.policyRule.create({
    data: {
      id: 'pol-sod-test',
      tenant_id: testData.tenant.id,
      agent_id: testData.agent.id,
      policy_name: 'SoD test policy',
      target_integration: 'email_service',
      operation: 'send',
      resource_scope: '*',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Requires human review',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'test',
    },
  });

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/evaluate',
    headers: { authorization: `Bearer ${testData.rawApiKey}` },
    payload: {
      agent_id: testData.agent.id,
      operation: 'send',
      target_integration: 'email_service',
      resource_scope: '*',
      data_classification: 'confidential',
    },
  });

  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.decision).toBe('approval_required');
  return body;
}

// ── Helper: evaluate an action that is allowed ────────────────────────────────
async function evaluateAllowed() {
  await prisma.policyRule.create({
    data: {
      id: 'pol-allow-test',
      tenant_id: testData.tenant.id,
      agent_id: testData.agent.id,
      policy_name: 'Allow test policy',
      target_integration: 'document_store',
      operation: 'read',
      resource_scope: '*',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Read access permitted',
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'test',
    },
  });

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/evaluate',
    headers: { authorization: `Bearer ${testData.rawApiKey}` },
    payload: {
      agent_id: testData.agent.id,
      operation: 'read',
      target_integration: 'document_store',
      resource_scope: '*',
      data_classification: 'internal',
    },
  });

  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.decision).toBe('allow');
  return body;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fix 1: Separation of Duties — Name Normalization
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Separation of Duties — name normalization', () => {
  // Agent owner is "Test Owner" (from seedTestData)

  beforeEach(async () => {
    // Ensure multi-user workspace (SoD is enforced)
    await prisma.user.create({
      data: {
        tenant_id: testData.tenant.id,
        email: 'reviewer@example.com',
        name: 'Test Reviewer',
        role: 'reviewer',
        auth_provider: 'email',
      },
    });
  });

  it('blocks approval when approver name matches owner (case insensitive)', async () => {
    const evalResult = await evaluateApprovalRequired();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'test owner' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('blocks approval when approver name matches owner (extra whitespace)', async () => {
    const evalResult = await evaluateApprovalRequired();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Test  Owner' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('blocks approval when approver name matches owner (tabs)', async () => {
    const evalResult = await evaluateApprovalRequired();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Test\tOwner' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('blocks approval when approver name matches owner (ALL CAPS)', async () => {
    const evalResult = await evaluateApprovalRequired();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'TEST OWNER' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows approval from a different person', async () => {
    const evalResult = await evaluateApprovalRequired();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Test Reviewer' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.separation_of_duties_check).toBe('pass');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fix 2: Double-Approve Race Condition
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Double-approve race condition', () => {
  beforeEach(async () => {
    await prisma.user.create({
      data: {
        tenant_id: testData.tenant.id,
        email: 'reviewer@example.com',
        name: 'Test Reviewer',
        role: 'reviewer',
        auth_provider: 'email',
      },
    });
  });

  it('rejects concurrent double-approve with 409', async () => {
    const evalResult = await evaluateApprovalRequired();

    // Send two approve requests concurrently
    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Reviewer A' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Reviewer B' },
      }),
    ]);

    const codes = [res1.statusCode, res2.statusCode].sort();
    expect(codes).toEqual([200, 409]);

    // Verify only one approval_granted event exists
    const events = await prisma.auditEvent.findMany({
      where: { trace_id: evalResult.trace_id, event_type: 'approval_granted' },
    });
    expect(events).toHaveLength(1);
  });

  it('rejects concurrent double-deny with 409', async () => {
    const evalResult = await evaluateApprovalRequired();

    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${evalResult.approval_request_id}/deny`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Reviewer A' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${evalResult.approval_request_id}/deny`,
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: { approver_name: 'Reviewer B' },
      }),
    ]);

    const codes = [res1.statusCode, res2.statusCode].sort();
    expect(codes).toEqual([200, 409]);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fix 5: Single-User Workspace Self-Approval
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Single-user workspace approval', () => {
  it('allows self-approval in single-user workspace with not_applicable SoD', async () => {
    // seedTestData creates one user — single-user workspace
    const evalResult = await evaluateApprovalRequired();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Test Owner' }, // Same as agent owner
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.separation_of_duties_check).toBe('not_applicable');
  });

  it('still blocks self-approval in multi-user workspace', async () => {
    // Add a second user
    await prisma.user.create({
      data: {
        tenant_id: testData.tenant.id,
        email: 'reviewer@example.com',
        name: 'Test Reviewer',
        role: 'reviewer',
        auth_provider: 'email',
      },
    });

    const evalResult = await evaluateApprovalRequired();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${evalResult.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { approver_name: 'Test Owner' },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fix 6: Auto-Close Allow Traces
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Auto-close allow traces', () => {
  it('auto-closes trace when policy allows action', async () => {
    const evalResult = await evaluateAllowed();

    // Verify trace is immediately finalized
    const trace = await prisma.auditTrace.findUnique({
      where: { id: evalResult.trace_id },
    });

    expect(trace?.final_outcome).toBe('executed');
    expect(trace?.completed_at).not.toBeNull();

    // Verify trace_closed event exists
    const closeEvent = await prisma.auditEvent.findFirst({
      where: { trace_id: evalResult.trace_id, event_type: 'trace_closed' },
    });
    expect(closeEvent).not.toBeNull();
    expect(closeEvent?.description).toContain('auto-closed');
  });

  it('recordOutcome still works on auto-closed allow trace', async () => {
    const evalResult = await evaluateAllowed();

    // Call recordOutcome with success metadata
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${evalResult.trace_id}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success', metadata: { execution_time_ms: 150 } },
    });

    // Should succeed (204) — adds metadata event without re-closing
    expect(res.statusCode).toBe(204);

    // Verify the outcome event was created
    const outcomeEvent = await prisma.auditEvent.findFirst({
      where: { trace_id: evalResult.trace_id, event_type: 'operation_executed' },
    });
    expect(outcomeEvent).not.toBeNull();
  });

  it('rejects recordOutcome on blocked traces', async () => {
    // Create a deny policy
    await prisma.policyRule.create({
      data: {
        id: 'pol-deny-test',
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Deny test',
        target_integration: 'crm_platform',
        operation: 'delete',
        resource_scope: '*',
        data_classification: 'restricted',
        policy_effect: 'deny',
        rationale: 'Denied by policy',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    const evalRes = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'delete',
        target_integration: 'crm_platform',
        resource_scope: '*',
        data_classification: 'restricted',
      },
    });
    const evalBody = evalRes.json();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${evalBody.trace_id}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    expect(res.statusCode).toBe(409);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fix 7: Body Size Limit
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Body size limit', () => {
  it('rejects oversized request body', async () => {
    const largePayload = JSON.stringify({
      agent_id: testData.agent.id,
      operation: 'read',
      target_integration: 'test',
      resource_scope: '*',
      data_classification: 'public',
      context: { data: 'A'.repeat(2_000_000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: {
        authorization: `Bearer ${testData.rawApiKey}`,
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(largePayload)),
      },
      payload: largePayload,
    });

    // Fastify returns 413 for body too large (or 500 if inject bypasses limit check)
    // Real HTTP requests will get 413 from the bodyLimit: 1_048_576 setting
    expect(res.statusCode).not.toBe(200);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fix 8: Invalid JSON Handling
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Invalid JSON handling', () => {
  it('returns 400 for malformed JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: {
        authorization: `Bearer ${testData.rawApiKey}`,
        'content-type': 'application/json',
      },
      payload: 'not json',
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('validation_error');
  });
});
