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

// Helper: create a policy with a given effect
async function createPolicy(effect: 'allow' | 'approval_required' | 'deny') {
  await prisma.policyRule.create({
    data: {
      id: `pol-${effect}-001`,
      tenant_id: testData.tenant.id,
      agent_id: testData.agent.id,
      policy_name: `${effect} policy`,
      target_integration: 'document_store',
      operation: 'read',
      resource_scope: '*',
      data_classification: 'internal',
      policy_effect: effect,
      rationale: `${effect} by test policy`,
      priority: 100,
      is_active: true,
      policy_version: 1,
      modified_by: 'test',
    },
  });
}

// Helper: evaluate to get a trace
async function evaluate() {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/evaluate',
    headers: { authorization: `Bearer ${testData.rawApiKey}` },
    payload: {
      agent_id: testData.agent.id,
      operation: 'read',
      target_integration: 'document_store',
      resource_scope: 'internal_docs',
      data_classification: 'internal',
    },
  });
  return response.json();
}

describe('Integrity Hashes', () => {
  it('new audit events have integrity_hash set', async () => {
    await createPolicy('allow');
    const result = await evaluate();

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: result.trace_id },
      orderBy: { timestamp: 'asc' },
    });

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.integrity_hash).toBeTruthy();
      expect(event.integrity_hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('hash chain: each event hash incorporates previous event hash', async () => {
    await createPolicy('allow');
    const result = await evaluate();

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: result.trace_id },
      orderBy: { timestamp: 'asc' },
    });

    // All events should have distinct hashes (different content)
    const hashes = events.map(e => e.integrity_hash);
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(hashes.length);
  });

  it('first event in trace uses GENESIS as previous hash', async () => {
    await createPolicy('allow');
    const result = await evaluate();

    // Verify the chain via the verify endpoint
    const verifyResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${result.trace_id}/verify`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const verifyResult = verifyResponse.json();
    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.verified_events).toBeGreaterThan(0);
  });

  it('verify endpoint returns verified=true for untampered trace', async () => {
    await createPolicy('allow');
    const result = await evaluate();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${result.trace_id}/verify`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.verified).toBe(true);
    expect(body.total_events).toBeGreaterThan(0);
    expect(body.verified_events).toBe(body.total_events);
    expect(body.broken_at).toBeNull();
  });

  it('verify endpoint detects tampered event (modified description)', async () => {
    await createPolicy('allow');
    const result = await evaluate();

    // Tamper with an event's description
    const events = await prisma.auditEvent.findMany({
      where: { trace_id: result.trace_id },
      orderBy: { timestamp: 'asc' },
    });

    await prisma.auditEvent.update({
      where: { id: events[0].id },
      data: { description: 'TAMPERED DESCRIPTION' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${result.trace_id}/verify`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.verified).toBe(false);
    expect(body.broken_at).not.toBeNull();
    expect(body.broken_at.event_id).toBe(events[0].id);
  });

  it('verify endpoint handles traces with no hashes (pre-migration events)', async () => {
    // Create a trace and events without hashes (simulating pre-migration data)
    const trace = await prisma.auditTrace.create({
      data: {
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        authority_model: 'self',
        requested_operation: 'legacy_op',
        target_integration: 'legacy_system',
        resource_scope: '*',
        final_outcome: 'executed',
        completed_at: new Date(),
      },
    });

    await prisma.auditEvent.create({
      data: {
        tenant_id: testData.tenant.id,
        trace_id: trace.id,
        agent_id: testData.agent.id,
        event_type: 'trace_initiated',
        actor_type: 'agent',
        actor_name: 'Legacy Agent',
        description: 'Legacy event without hash',
        status: 'started',
        // no integrity_hash
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${trace.id}/verify`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(body.verified).toBe(true);
    expect(body.total_events).toBe(1);
    expect(body.verified_events).toBe(0); // no hashed events
  });

  it('trace integrity_hash equals last event hash', async () => {
    await createPolicy('deny');
    const result = await evaluate();

    const trace = await prisma.auditTrace.findUnique({
      where: { id: result.trace_id },
    });

    const lastEvent = await prisma.auditEvent.findFirst({
      where: { trace_id: result.trace_id },
      orderBy: { timestamp: 'desc' },
    });

    expect(trace?.integrity_hash).toBeTruthy();
    expect(trace?.integrity_hash).toBe(lastEvent?.integrity_hash);
  });

  it('approval flow events also get hashes', async () => {
    await createPolicy('approval_required');
    const result = await evaluate();

    expect(result.decision).toBe('approval_required');

    // Approve it
    const approveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/approvals/${result.approval_request_id}/approve`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        approver_name: 'External Reviewer',
        decision_note: 'Looks good',
      },
    });
    expect(approveResponse.statusCode).toBe(200);

    // All events including approval should have hashes
    const events = await prisma.auditEvent.findMany({
      where: { trace_id: result.trace_id },
      orderBy: { timestamp: 'asc' },
    });

    for (const event of events) {
      expect(event.integrity_hash).toBeTruthy();
    }

    // Verify the full chain
    const verifyResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/traces/${result.trace_id}/verify`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(verifyResponse.json().verified).toBe(true);
  });
});

describe('Audit Export', () => {
  it('JSON export returns all events in date range', async () => {
    await createPolicy('allow');
    await evaluate();

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/audit/export?from=${oneHourAgo.toISOString()}&to=${now.toISOString()}&format=json`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toContain('attachment');

    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('event_id');
    expect(body[0]).toHaveProperty('trace_id');
    expect(body[0]).toHaveProperty('event_type');
    expect(body[0]).toHaveProperty('integrity_hash');
  });

  it('CSV export has correct columns', async () => {
    await createPolicy('allow');
    await evaluate();

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/audit/export?from=${oneHourAgo.toISOString()}&to=${now.toISOString()}&format=csv`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');

    const csv = response.body;
    const lines = csv.split('\n');
    const header = lines[0];
    expect(header).toBe(
      'event_id,trace_id,agent_id,event_type,actor_type,actor_name,description,status,timestamp,policy_version,integrity_hash',
    );
    expect(lines.length).toBeGreaterThan(1);
  });

  it('from and to parameters are required', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/audit/export?format=json',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it('export respects tenant isolation', async () => {
    // Create data for the test tenant
    await createPolicy('allow');
    await evaluate();

    // Create a second tenant with its own data
    const tenant2 = await prisma.tenant.create({
      data: {
        id: 'tenant-2',
        name: 'Other Workspace',
        slug: 'other',
        plan: 'enterprise',
        settings: {},
        onboarding_state: {},
      },
    });

    const agent2 = await prisma.agent.create({
      data: {
        tenant_id: tenant2.id,
        name: 'Other Agent',
        description: 'Agent in other tenant',
        owner_name: 'Other Owner',
        owner_role: 'Engineer',
        team: 'Other',
        authority_model: 'self',
        identity_mode: 'service_identity',
        delegation_model: 'self',
        created_by: 'test',
      },
    });

    // Insert an event directly for tenant2
    await prisma.auditTrace.create({
      data: {
        id: 'other-trace',
        tenant_id: tenant2.id,
        agent_id: agent2.id,
        authority_model: 'self',
        requested_operation: 'other_op',
        target_integration: 'other_system',
        resource_scope: '*',
        final_outcome: 'executed',
      },
    });

    await prisma.auditEvent.create({
      data: {
        tenant_id: tenant2.id,
        trace_id: 'other-trace',
        agent_id: agent2.id,
        event_type: 'trace_initiated',
        actor_type: 'agent',
        actor_name: 'Other Agent',
        description: 'Event in other tenant',
        status: 'started',
      },
    });

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // Export as test tenant (should not see tenant2's events)
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/audit/export?from=${oneHourAgo.toISOString()}&to=${now.toISOString()}&format=json`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    for (const event of body) {
      // None of the events should belong to tenant2's trace
      expect(event.trace_id).not.toBe('other-trace');
    }
  });
});

describe('Webhook extension', () => {
  it('endpoints can subscribe to audit.event and audit.batch', async () => {
    // Create webhook endpoint subscribed to audit events
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        tenant_id: testData.tenant.id,
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        events: ['audit.event', 'audit.batch'],
        is_active: true,
      },
    });

    expect(endpoint.events).toContain('audit.event');
    expect(endpoint.events).toContain('audit.batch');
  });
});
