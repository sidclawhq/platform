/**
 * E2E tests for the vertical slice.
 *
 * Prerequisites:
 *   1. Start test database: docker compose -f docker-compose.test.yml up -d
 *   2. Start API server against test database:
 *      DATABASE_URL=postgresql://agent_identity:agent_identity@localhost:5433/agent_identity_test npm run dev
 *      (from apps/api/)
 *   3. Run tests: npx vitest run --config tests/e2e/vitest.config.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupE2E, teardownE2E, createSDKClient, prisma } from './helpers';

let testData: Awaited<ReturnType<typeof setupE2E>>;

describe('Vertical Slice E2E', () => {
  beforeAll(async () => {
    testData = await setupE2E();
  }, 30000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe('Scenario 1: Approval flow — approve', () => {
    it('evaluate → approval_required → approve → record outcome → trace complete', async () => {
      const client = createSDKClient(testData.rawApiKey, testData.commsAgent.id);

      // 1. Evaluate — should require approval
      const decision = await client.evaluate({
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
        context: { recipient: 'customer-1234', template: 'follow-up' },
      });

      expect(decision.decision).toBe('approval_required');
      expect(decision.trace_id).toBeDefined();
      expect(decision.approval_request_id).toBeDefined();
      expect(decision.reason).toContain('human review');

      // 2. Verify trace is in_progress
      const trace = await prisma.auditTrace.findUnique({ where: { id: decision.trace_id } });
      expect(trace!.final_outcome).toBe('in_progress');

      // 3. Verify audit events created (trace_initiated → identity_resolved → policy_evaluated → sensitive_operation_detected → approval_requested)
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: decision.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      expect(events.length).toBeGreaterThanOrEqual(5);
      expect(events.map(e => e.event_type)).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'sensitive_operation_detected',
        'approval_requested',
      ]);

      // 4. Verify identity_resolved event contains agent metadata
      const identityEvent = events.find(e => e.event_type === 'identity_resolved');
      expect(identityEvent!.description).toContain('hybrid');

      // 5. Approve the request (via direct API call, simulating dashboard)
      const approveResponse = await fetch(`${process.env.TEST_API_URL ?? 'http://localhost:4000'}/api/v1/approvals/${decision.approval_request_id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.rawApiKey}`,
        },
        body: JSON.stringify({
          approver_name: 'E2E Admin', // Not the agent owner (Sarah Chen)
          decision_note: 'Verified customer context is appropriate',
        }),
      });
      expect(approveResponse.status).toBe(200);

      // 6. Verify approval status changed
      const approval = await prisma.approvalRequest.findUnique({ where: { id: decision.approval_request_id! } });
      expect(approval!.status).toBe('approved');
      expect(approval!.approver_name).toBe('E2E Admin');
      expect(approval!.separation_of_duties_check).toBe('pass');

      // 7. Verify approval_granted event was created
      const eventsAfterApproval = await prisma.auditEvent.findMany({
        where: { trace_id: decision.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      const grantedEvent = eventsAfterApproval.find(e => e.event_type === 'approval_granted');
      expect(grantedEvent).toBeDefined();
      expect(grantedEvent!.actor_name).toBe('E2E Admin');

      // 8. Record outcome (simulating SDK after agent executes the action)
      await client.recordOutcome(decision.trace_id, {
        status: 'success',
        metadata: { emails_sent: 1 },
      });

      // 9. Verify trace finalized
      const finalTrace = await prisma.auditTrace.findUnique({ where: { id: decision.trace_id } });
      expect(finalTrace!.final_outcome).toBe('completed_with_approval');
      expect(finalTrace!.completed_at).toBeDefined();

      // 10. Verify complete event sequence
      const allEvents = await prisma.auditEvent.findMany({
        where: { trace_id: decision.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      expect(allEvents.map(e => e.event_type)).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'sensitive_operation_detected',
        'approval_requested',
        'approval_granted',
        'operation_executed',
        'trace_closed',
      ]);
    });
  });

  describe('Scenario 2: Approval flow — deny', () => {
    it('evaluate → approval_required → deny → trace finalized as denied', async () => {
      const client = createSDKClient(testData.rawApiKey, testData.caseAgent.id);

      // 1. Evaluate
      const decision = await client.evaluate({
        operation: 'close',
        target_integration: 'case_management_system',
        resource_scope: 'high_impact_cases',
        data_classification: 'confidential',
      });

      expect(decision.decision).toBe('approval_required');

      // 2. Deny the request
      const denyResponse = await fetch(`${process.env.TEST_API_URL ?? 'http://localhost:4000'}/api/v1/approvals/${decision.approval_request_id}/deny`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.rawApiKey}`,
        },
        body: JSON.stringify({
          approver_name: 'E2E Admin',
          decision_note: 'Need more context on financial impact',
        }),
      });
      expect(denyResponse.status).toBe(200);

      // 3. Verify trace finalized as denied
      const trace = await prisma.auditTrace.findUnique({ where: { id: decision.trace_id } });
      expect(trace!.final_outcome).toBe('denied');
      expect(trace!.completed_at).toBeDefined();

      // 4. Verify event sequence includes approval_denied and trace_closed
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: decision.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      const eventTypes = events.map(e => e.event_type);
      expect(eventTypes).toContain('approval_denied');
      expect(eventTypes).toContain('trace_closed');
      expect(eventTypes[eventTypes.length - 1]).toBe('trace_closed');
    });
  });

  describe('Scenario 3: Auto-allow', () => {
    it('evaluate → allow → record outcome → trace complete', async () => {
      const client = createSDKClient(testData.rawApiKey, testData.knowledgeAgent.id);

      // 1. Evaluate — should be allowed
      const decision = await client.evaluate({
        operation: 'read',
        target_integration: 'document_store',
        resource_scope: 'internal_docs',
        data_classification: 'internal',
      });

      expect(decision.decision).toBe('allow');
      expect(decision.approval_request_id).toBeNull();

      // 2. Verify no approval request created
      const approvals = await prisma.approvalRequest.findMany({
        where: { trace_id: decision.trace_id },
      });
      expect(approvals).toHaveLength(0);

      // 3. Record outcome
      await client.recordOutcome(decision.trace_id, { status: 'success' });

      // 4. Verify trace
      const trace = await prisma.auditTrace.findUnique({ where: { id: decision.trace_id } });
      expect(trace!.final_outcome).toBe('executed');

      // 5. Verify event sequence — no approval events
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: decision.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      const eventTypes = events.map(e => e.event_type);
      expect(eventTypes).toContain('operation_allowed');
      expect(eventTypes).not.toContain('approval_requested');
      expect(eventTypes[eventTypes.length - 1]).toBe('trace_closed');
    });
  });

  describe('Scenario 4: Auto-block (deny policy)', () => {
    it('evaluate → deny → trace blocked immediately', async () => {
      const client = createSDKClient(testData.rawApiKey, testData.commsAgent.id);

      // 1. Evaluate — should be denied
      const decision = await client.evaluate({
        operation: 'export',
        target_integration: 'crm_platform',
        resource_scope: 'customer_pii_records',
        data_classification: 'restricted',
      });

      expect(decision.decision).toBe('deny');
      expect(decision.approval_request_id).toBeNull();
      expect(decision.reason).toContain('PII');

      // 2. Verify trace immediately blocked
      const trace = await prisma.auditTrace.findUnique({ where: { id: decision.trace_id } });
      expect(trace!.final_outcome).toBe('blocked');
      expect(trace!.completed_at).toBeDefined();

      // 3. Verify event sequence includes deny + close
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: decision.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      const eventTypes = events.map(e => e.event_type);
      expect(eventTypes).toContain('sensitive_operation_detected');
      expect(eventTypes).toContain('operation_denied');
      expect(eventTypes[eventTypes.length - 1]).toBe('trace_closed');
    });
  });

  describe('Scenario 5: Separation of duties violation', () => {
    it('agent owner cannot approve their own agent request', async () => {
      const client = createSDKClient(testData.rawApiKey, testData.commsAgent.id);

      // 1. Create an approval request
      const decision = await client.evaluate({
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      });

      expect(decision.decision).toBe('approval_required');

      // 2. Try to approve as the agent owner (Sarah Chen)
      const response = await fetch(`${process.env.TEST_API_URL ?? 'http://localhost:4000'}/api/v1/approvals/${decision.approval_request_id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.rawApiKey}`,
        },
        body: JSON.stringify({
          approver_name: 'Sarah Chen', // This IS the agent owner
        }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('separation_of_duties');
    });
  });

  describe('Scenario 6: Conflict — double approval', () => {
    it('cannot approve an already-approved request', async () => {
      const client = createSDKClient(testData.rawApiKey, testData.commsAgent.id);

      // 1. Create approval request
      const decision = await client.evaluate({
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      });

      // 2. Approve it
      await fetch(`${process.env.TEST_API_URL ?? 'http://localhost:4000'}/api/v1/approvals/${decision.approval_request_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testData.rawApiKey}` },
        body: JSON.stringify({ approver_name: 'E2E Admin' }),
      });

      // 3. Try to approve again
      const response = await fetch(`${process.env.TEST_API_URL ?? 'http://localhost:4000'}/api/v1/approvals/${decision.approval_request_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testData.rawApiKey}` },
        body: JSON.stringify({ approver_name: 'Another Admin' }),
      });

      expect(response.status).toBe(409);
    });
  });
});
