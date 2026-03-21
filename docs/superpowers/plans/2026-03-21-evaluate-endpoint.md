# P1.3 — Evaluate Endpoint & Trace Creation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three API endpoints — evaluate (POST /api/v1/evaluate), outcome (POST /api/v1/traces/:traceId/outcome), and approval status (GET /api/v1/approvals/:id/status) — connecting the SDK (P1.1) to the policy engine (P1.2).

**Architecture:** Route handlers call PolicyEngine from `services/policy-engine.ts` within Prisma transactions that atomically create audit traces, audit events, and (optionally) approval requests. ZodError handling is added to the error handler so `.parse()` validation failures return 400.

**Tech Stack:** Fastify, Prisma, Zod, Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/src/middleware/error-handler.ts` | Add ZodError → 400 mapping |
| Rewrite | `apps/api/src/routes/evaluate.ts` | `POST /api/v1/evaluate` handler |
| Modify | `apps/api/src/routes/traces.ts` | Add `POST /api/v1/traces/:traceId/outcome` |
| Modify | `apps/api/src/routes/approvals.ts` | Add `GET /api/v1/approvals/:id/status` |
| Create | `apps/api/src/__tests__/integration/evaluate.test.ts` | Integration tests for all three endpoints |

---

### Task 1: Add ZodError handling to error handler

**Files:**
- Modify: `apps/api/src/middleware/error-handler.ts`

The evaluate route uses Zod `.parse()` which throws `ZodError` on invalid input. The error handler currently only catches `AppError` and Fastify validation errors — ZodError falls through to a 500. Fix this.

- [ ] **Step 1: Add ZodError handling**

In `apps/api/src/middleware/error-handler.ts`, add a ZodError check before the unhandled-error fallback:

```typescript
import { ZodError } from 'zod';

// ... existing imports ...

// Inside setErrorHandler, AFTER the Fastify validation block, BEFORE the unhandled-error block:

    // Handle Zod validation errors (from .parse() in route handlers)
    if (error instanceof ZodError) {
      request.log.warn({ err: error, request_id: requestId }, 'Zod validation error');
      return reply.status(400).send({
        error: 'validation_error',
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        status: 400,
        details: { issues: error.errors },
        request_id: requestId,
      });
    }
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd apps/api && npx vitest run src/__tests__/integration/auth.test.ts`
Expected: All existing tests pass (no regressions).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/error-handler.ts
git commit -m "feat(api): handle ZodError as 400 in error handler"
```

---

### Task 2: Implement POST /api/v1/evaluate

**Files:**
- Rewrite: `apps/api/src/routes/evaluate.ts`

**Dependencies:** Task 1 (ZodError handling)

The evaluate endpoint receives a request from the SDK, creates an audit trace, runs the policy engine, and returns the decision. All DB operations happen in a single Prisma transaction.

- [ ] **Step 1: Write the route handler**

Replace the contents of `apps/api/src/routes/evaluate.ts` with:

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EvaluateRequestSchema } from '@sidclaw/shared';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';
import { PolicyEngine } from '../services/policy-engine.js';

const EvaluateRequestWithAgentSchema = EvaluateRequestSchema.extend({
  agent_id: z.string().min(1),
});

export async function evaluateRoutes(app: FastifyInstance) {
  app.post('/evaluate', async (request, reply) => {
    const tenantId = request.tenantId!;
    const body = EvaluateRequestWithAgentSchema.parse(request.body);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Load agent
      const agent = await tx.agent.findFirst({
        where: { id: body.agent_id, tenant_id: tenantId },
      });
      if (!agent) throw new NotFoundError('Agent', body.agent_id);

      // 2. Create AuditTrace
      const trace = await tx.auditTrace.create({
        data: {
          tenant_id: tenantId,
          agent_id: agent.id,
          authority_model: agent.authority_model,
          requested_operation: body.operation,
          target_integration: body.target_integration,
          resource_scope: body.resource_scope,
          final_outcome: 'in_progress',
        },
      });

      // 3. Create AuditEvent: trace_initiated
      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: agent.id,
          event_type: 'trace_initiated',
          actor_type: 'agent',
          actor_name: agent.name,
          description: `Agent initiated ${body.operation} operation on ${body.target_integration}`,
          status: 'started',
        },
      });

      // 4. Create AuditEvent: identity_resolved
      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: agent.id,
          event_type: 'identity_resolved',
          actor_type: 'system',
          actor_name: 'Identity Service',
          description: `Resolved ${agent.identity_mode} identity: ${agent.authority_model} authority, delegation: ${agent.delegation_model}`,
          status: 'resolved',
          metadata: {
            owner_name: agent.owner_name,
            authority_model: agent.authority_model,
            delegation_model: agent.delegation_model,
            identity_mode: agent.identity_mode,
          },
        },
      });

      // 5. Call policy engine
      const policyEngine = new PolicyEngine(tx as typeof prisma);
      const decision = await policyEngine.evaluate(agent.id, tenantId, {
        operation: body.operation,
        target_integration: body.target_integration,
        resource_scope: body.resource_scope,
        data_classification: body.data_classification,
      });

      // 6. Create AuditEvent: policy_evaluated
      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: agent.id,
          event_type: 'policy_evaluated',
          actor_type: 'policy_engine',
          actor_name: 'Policy Engine',
          description: decision.rule_id
            ? `Policy "${decision.rationale.substring(0, 80)}..." matched — effect: ${decision.effect}`
            : `No matching policy — default deny applied`,
          status: 'evaluated',
          policy_version: decision.policy_version,
          metadata: {
            effect: decision.effect,
            rule_id: decision.rule_id,
          },
        },
      });

      // 7. If approval_required or deny, create sensitive_operation_detected event
      if (decision.effect === 'approval_required' || decision.effect === 'deny') {
        await tx.auditEvent.create({
          data: {
            tenant_id: tenantId,
            trace_id: trace.id,
            agent_id: agent.id,
            event_type: 'sensitive_operation_detected',
            actor_type: 'policy_engine',
            actor_name: 'Policy Engine',
            description: `${body.data_classification} data classification detected on ${body.target_integration}`,
            status: 'flagged',
          },
        });
      }

      // 8. Handle each decision type
      if (decision.effect === 'approval_required') {
        const approvalRequest = await tx.approvalRequest.create({
          data: {
            tenant_id: tenantId,
            trace_id: trace.id,
            agent_id: agent.id,
            policy_rule_id: decision.rule_id!,
            requested_operation: body.operation,
            target_integration: body.target_integration,
            resource_scope: body.resource_scope,
            data_classification: body.data_classification,
            authority_model: agent.authority_model,
            delegated_from: agent.delegation_model !== 'self' ? agent.owner_name : null,
            policy_effect: 'approval_required',
            flag_reason: decision.rationale,
            status: 'pending',
          },
        });

        await tx.auditEvent.create({
          data: {
            tenant_id: tenantId,
            trace_id: trace.id,
            agent_id: agent.id,
            approval_request_id: approvalRequest.id,
            event_type: 'approval_requested',
            actor_type: 'approval_service',
            actor_name: 'Approval Service',
            description: 'Approval request created — awaiting human reviewer',
            status: 'pending',
          },
        });

        return {
          decision: 'approval_required' as const,
          trace_id: trace.id,
          approval_request_id: approvalRequest.id,
          reason: decision.rationale,
          policy_rule_id: decision.rule_id,
        };
      }

      if (decision.effect === 'allow') {
        await tx.auditEvent.create({
          data: {
            tenant_id: tenantId,
            trace_id: trace.id,
            agent_id: agent.id,
            event_type: 'operation_allowed',
            actor_type: 'policy_engine',
            actor_name: 'Policy Engine',
            description: 'Operation allowed by policy — no approval required',
            status: 'allowed',
          },
        });

        return {
          decision: 'allow' as const,
          trace_id: trace.id,
          approval_request_id: null,
          reason: decision.rationale,
          policy_rule_id: decision.rule_id,
        };
      }

      // decision.effect === 'deny'
      await tx.auditTrace.update({
        where: { id: trace.id },
        data: { final_outcome: 'blocked', completed_at: new Date() },
      });

      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: agent.id,
          event_type: 'operation_denied',
          actor_type: 'policy_engine',
          actor_name: 'Policy Engine',
          description: `Operation denied — ${decision.rationale}`,
          status: 'denied',
        },
      });

      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: agent.id,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: 'Trace completed with outcome: blocked',
          status: 'closed',
        },
      });

      return {
        decision: 'deny' as const,
        trace_id: trace.id,
        approval_request_id: null,
        reason: decision.rationale,
        policy_rule_id: decision.rule_id,
      };
    });

    return reply.status(200).send(result);
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/evaluate.ts
git commit -m "feat(api): implement POST /api/v1/evaluate endpoint"
```

---

### Task 3: Implement POST /api/v1/traces/:traceId/outcome

**Files:**
- Modify: `apps/api/src/routes/traces.ts`

Adds the outcome endpoint that the SDK calls after the agent executes (or fails) the approved operation. Records the final outcome and closes the trace.

- [ ] **Step 1: Write the outcome handler**

Add to `apps/api/src/routes/traces.ts` — import `z`, `prisma`, `NotFoundError`, then add the new route inside `traceRoutes`:

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';

const RecordOutcomeSchema = z.object({
  status: z.enum(['success', 'error']),
  metadata: z.record(z.unknown()).optional(),
});

export async function traceRoutes(app: FastifyInstance) {
  // POST /api/v1/traces/:traceId/outcome — record execution outcome (P1.3)
  app.post('/traces/:traceId/outcome', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { traceId } = request.params as { traceId: string };
    const body = RecordOutcomeSchema.parse(request.body);

    await prisma.$transaction(async (tx) => {
      const trace = await tx.auditTrace.findFirst({
        where: { id: traceId, tenant_id: tenantId },
      });
      if (!trace) throw new NotFoundError('Trace', traceId);

      const finalOutcome = body.status === 'success'
        ? (trace.final_outcome === 'in_progress' ? 'executed' : 'completed_with_approval')
        : 'blocked';
      const eventType = body.status === 'success' ? 'operation_executed' : 'operation_failed';

      const agent = await tx.agent.findFirst({
        where: { id: trace.agent_id },
        select: { name: true },
      });

      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: trace.agent_id,
          event_type: eventType,
          actor_type: 'agent',
          actor_name: agent?.name ?? 'Unknown Agent',
          description: body.status === 'success'
            ? `${trace.requested_operation} operation completed successfully`
            : `${trace.requested_operation} operation failed`,
          status: body.status,
          metadata: body.metadata ?? null,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenant_id: tenantId,
          trace_id: trace.id,
          agent_id: trace.agent_id,
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: `Trace completed with outcome: ${finalOutcome}`,
          status: 'closed',
        },
      });

      await tx.auditTrace.update({
        where: { id: trace.id },
        data: {
          final_outcome: finalOutcome,
          completed_at: new Date(),
        },
      });
    });

    return reply.status(204).send();
  });

  // GET /api/v1/traces — list audit traces (P1.6)
  app.get('/traces', async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }));

  // GET /api/v1/traces/:id — trace detail with events (P1.6)
  app.get('/traces/:id', async () => ({ data: null }));

  // GET /api/v1/traces/:id/events — trace events timeline (P1.6)
  app.get('/traces/:id/events', async () => ({ data: [] }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/traces.ts
git commit -m "feat(api): implement POST /api/v1/traces/:traceId/outcome endpoint"
```

---

### Task 4: Implement GET /api/v1/approvals/:id/status

**Files:**
- Modify: `apps/api/src/routes/approvals.ts`

Adds the approval status polling endpoint that the SDK calls while waiting for human review.

- [ ] **Step 1: Write the status handler**

Replace `apps/api/src/routes/approvals.ts` with:

```typescript
import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';

export async function approvalRoutes(app: FastifyInstance) {
  // GET /api/v1/approvals/:id/status — poll approval status (P1.3)
  app.get('/approvals/:id/status', async (request, reply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const approval = await prisma.approvalRequest.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        status: true,
        decided_at: true,
        approver_name: true,
        decision_note: true,
      },
    });

    if (!approval) throw new NotFoundError('ApprovalRequest', id);

    return reply.status(200).send(approval);
  });

  // GET /api/v1/approvals — list pending approvals (P1.4)
  app.get('/approvals', async () => ({ data: [], pagination: { total: 0, limit: 50, offset: 0 } }));

  // GET /api/v1/approvals/:id — approval detail (P1.4)
  app.get('/approvals/:id', async () => ({ data: null }));

  // POST /api/v1/approvals/:id/approve — approve request (P1.4)
  // POST /api/v1/approvals/:id/deny — deny request (P1.4)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/approvals.ts
git commit -m "feat(api): implement GET /api/v1/approvals/:id/status endpoint"
```

---

### Task 5: Integration tests — evaluate endpoint (allow path)

**Files:**
- Create: `apps/api/src/__tests__/integration/evaluate.test.ts`

- [ ] **Step 1: Write the test file with allow-path tests**

Create `apps/api/src/__tests__/integration/evaluate.test.ts`:

```typescript
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

describe('POST /api/v1/evaluate', () => {
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

  describe('allow decision', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-allow-001',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Allow read on document_store',
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
    });

    it('returns decision: allow with trace_id', async () => {
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

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.decision).toBe('allow');
      expect(body.trace_id).toBeDefined();
      expect(body.approval_request_id).toBeNull();
      expect(body.reason).toBe('Read access permitted');
      expect(body.policy_rule_id).toBe('pol-allow-001');
    });

    it('creates AuditTrace with final_outcome: in_progress', async () => {
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

      const body = response.json();
      const trace = await prisma.auditTrace.findUnique({ where: { id: body.trace_id } });
      expect(trace).toBeDefined();
      expect(trace!.final_outcome).toBe('in_progress');
      expect(trace!.completed_at).toBeNull();
    });

    it('creates audit events: trace_initiated -> identity_resolved -> policy_evaluated -> operation_allowed', async () => {
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

      const body = response.json();
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: body.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      expect(events.map(e => e.event_type)).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'operation_allowed',
      ]);
    });

    it('does not create an ApprovalRequest', async () => {
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

      const body = response.json();
      const approvals = await prisma.approvalRequest.findMany({
        where: { trace_id: body.trace_id },
      });
      expect(approvals).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run to verify tests pass**

Run: `cd apps/api && npx vitest run src/__tests__/integration/evaluate.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/evaluate.test.ts
git commit -m "test(api): add evaluate endpoint integration tests — allow path"
```

---

### Task 6: Integration tests — approval_required path

**Files:**
- Modify: `apps/api/src/__tests__/integration/evaluate.test.ts`

- [ ] **Step 1: Add approval_required tests**

Add the following `describe` block inside the `POST /api/v1/evaluate` describe, after the `allow decision` block:

```typescript
  describe('approval_required decision', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-approval-001',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Require approval for send on comms',
          target_integration: 'communications_service',
          operation: 'send',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
          policy_effect: 'approval_required',
          rationale: 'Requires human review',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });
    });

    it('returns decision: approval_required with trace_id and approval_request_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.decision).toBe('approval_required');
      expect(body.trace_id).toBeDefined();
      expect(body.approval_request_id).toBeDefined();
      expect(body.reason).toBe('Requires human review');
      expect(body.policy_rule_id).toBe('pol-approval-001');
    });

    it('creates AuditTrace with final_outcome: in_progress', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      const body = response.json();
      const trace = await prisma.auditTrace.findUnique({ where: { id: body.trace_id } });
      expect(trace!.final_outcome).toBe('in_progress');
    });

    it('creates ApprovalRequest with status: pending', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      const body = response.json();
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval).toBeDefined();
      expect(approval!.status).toBe('pending');
    });

    it('sets policy_rule_id on the ApprovalRequest', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      const body = response.json();
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval!.policy_rule_id).toBe('pol-approval-001');
    });

    it('creates audit events: trace_initiated -> identity_resolved -> policy_evaluated -> sensitive_operation_detected -> approval_requested', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      const body = response.json();
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: body.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      expect(events.map(e => e.event_type)).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'sensitive_operation_detected',
        'approval_requested',
      ]);
    });

    it('sets flag_reason from policy rationale', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      const body = response.json();
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval!.flag_reason).toBe('Requires human review');
    });

    it('sets delegated_from when agent delegation_model is not self', async () => {
      // Update agent to have a non-self delegation model
      await prisma.agent.update({
        where: { id: testData.agent.id },
        data: { delegation_model: 'on_behalf_of_user', owner_name: 'Jane Smith' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'send',
          target_integration: 'communications_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
        },
      });

      const body = response.json();
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: body.approval_request_id },
      });
      expect(approval!.delegated_from).toBe('Jane Smith');
    });
  });
```

- [ ] **Step 2: Run to verify tests pass**

Run: `cd apps/api && npx vitest run src/__tests__/integration/evaluate.test.ts`
Expected: All tests pass (4 allow + 7 approval_required = 11 total).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/evaluate.test.ts
git commit -m "test(api): add evaluate endpoint integration tests — approval_required path"
```

---

### Task 7: Integration tests — deny path and error cases

**Files:**
- Modify: `apps/api/src/__tests__/integration/evaluate.test.ts`

- [ ] **Step 1: Add deny and error tests**

Add these `describe` blocks inside the `POST /api/v1/evaluate` describe:

```typescript
  describe('deny decision', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-deny-001',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Deny export on crm_platform',
          target_integration: 'crm_platform',
          operation: 'export',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
          policy_effect: 'deny',
          rationale: 'PII export prohibited',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });
    });

    it('returns decision: deny with trace_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'export',
          target_integration: 'crm_platform',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.decision).toBe('deny');
      expect(body.trace_id).toBeDefined();
      expect(body.approval_request_id).toBeNull();
    });

    it('creates AuditTrace with final_outcome: blocked and completed_at set', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'export',
          target_integration: 'crm_platform',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
        },
      });

      const body = response.json();
      const trace = await prisma.auditTrace.findUnique({ where: { id: body.trace_id } });
      expect(trace!.final_outcome).toBe('blocked');
      expect(trace!.completed_at).not.toBeNull();
    });

    it('does not create an ApprovalRequest', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'export',
          target_integration: 'crm_platform',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
        },
      });

      const body = response.json();
      const approvals = await prisma.approvalRequest.findMany({
        where: { trace_id: body.trace_id },
      });
      expect(approvals).toHaveLength(0);
    });

    it('creates audit events: trace_initiated -> identity_resolved -> policy_evaluated -> sensitive_operation_detected -> operation_denied -> trace_closed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          operation: 'export',
          target_integration: 'crm_platform',
          resource_scope: 'customer_pii_records',
          data_classification: 'restricted',
        },
      });

      const body = response.json();
      const events = await prisma.auditEvent.findMany({
        where: { trace_id: body.trace_id },
        orderBy: { timestamp: 'asc' },
      });
      expect(events.map(e => e.event_type)).toEqual([
        'trace_initiated',
        'identity_resolved',
        'policy_evaluated',
        'sensitive_operation_detected',
        'operation_denied',
        'trace_closed',
      ]);
    });
  });

  describe('error cases', () => {
    it('returns 400 for invalid request body (missing operation)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: testData.agent.id,
          // operation missing
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for non-existent agent_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: 'non-existent-agent',
          operation: 'read',
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        payload: {
          agent_id: testData.agent.id,
          operation: 'read',
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('transaction rolls back on internal error (no partial state)', async () => {
      // Use a non-existent agent to trigger NotFoundError inside the transaction
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/evaluate',
        headers: { authorization: `Bearer ${testData.rawApiKey}` },
        payload: {
          agent_id: 'non-existent-agent',
          operation: 'read',
          target_integration: 'document_store',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
        },
      });

      expect(response.statusCode).toBe(404);

      // Verify no trace or events were created
      const traces = await prisma.auditTrace.findMany();
      expect(traces).toHaveLength(0);
      const events = await prisma.auditEvent.findMany();
      expect(events).toHaveLength(0);
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await prisma.policyRule.create({
        data: {
          id: 'pol-perf-001',
          tenant_id: testData.tenant.id,
          agent_id: testData.agent.id,
          policy_name: 'Allow read',
          target_integration: 'document_store',
          operation: 'read',
          resource_scope: '*',
          data_classification: 'internal',
          policy_effect: 'allow',
          rationale: 'Read allowed',
          priority: 100,
          is_active: true,
          policy_version: 1,
          modified_by: 'test',
        },
      });
    });

    it('completes within 100ms', async () => {
      const start = Date.now();
      await app.inject({
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
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });
```

- [ ] **Step 2: Run to verify tests pass**

Run: `cd apps/api && npx vitest run src/__tests__/integration/evaluate.test.ts`
Expected: All tests pass (4 allow + 7 approval + 4 deny + 4 error + 1 perf = 20 total).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/evaluate.test.ts
git commit -m "test(api): add evaluate endpoint integration tests — deny path, errors, perf"
```

---

### Task 8: Integration tests — outcome and approval status endpoints

**Files:**
- Modify: `apps/api/src/__tests__/integration/evaluate.test.ts`

- [ ] **Step 1: Add outcome endpoint tests**

Add at the bottom of the file, as sibling describe blocks to `POST /api/v1/evaluate`:

```typescript
describe('POST /api/v1/traces/:traceId/outcome', () => {
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

    // Create an allow policy so we can get a trace via evaluate
    await prisma.policyRule.create({
      data: {
        id: 'pol-outcome-001',
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Allow read',
        target_integration: 'document_store',
        operation: 'read',
        resource_scope: '*',
        data_classification: 'internal',
        policy_effect: 'allow',
        rationale: 'Read allowed',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });
  });

  async function evaluateAndGetTraceId(): Promise<string> {
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
    return response.json().trace_id;
  }

  it('returns 204 on success', async () => {
    const traceId = await evaluateAndGetTraceId();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    expect(response.statusCode).toBe(204);
  });

  it('records success outcome and finalizes trace', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    const trace = await prisma.auditTrace.findUnique({ where: { id: traceId } });
    expect(trace!.final_outcome).toBe('executed');
    expect(trace!.completed_at).not.toBeNull();
  });

  it('records error outcome and finalizes trace', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'error' },
    });

    const trace = await prisma.auditTrace.findUnique({ where: { id: traceId } });
    expect(trace!.final_outcome).toBe('blocked');
    expect(trace!.completed_at).not.toBeNull();
  });

  it('creates operation_executed event for success', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: traceId, event_type: 'operation_executed' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.status).toBe('success');
  });

  it('creates operation_failed event for error', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'error' },
    });

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: traceId, event_type: 'operation_failed' },
    });
    expect(events).toHaveLength(1);
  });

  it('creates trace_closed event', async () => {
    const traceId = await evaluateAndGetTraceId();

    await app.inject({
      method: 'POST',
      url: `/api/v1/traces/${traceId}/outcome`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    const events = await prisma.auditEvent.findMany({
      where: { trace_id: traceId, event_type: 'trace_closed' },
    });
    expect(events).toHaveLength(1);
  });

  it('returns 404 for non-existent trace', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/traces/non-existent-trace/outcome',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: { status: 'success' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /api/v1/approvals/:id/status', () => {
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

  it('returns pending status for new approval', async () => {
    // Create an approval_required policy
    await prisma.policyRule.create({
      data: {
        id: 'pol-status-001',
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Require approval',
        target_integration: 'communications_service',
        operation: 'send',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
        policy_effect: 'approval_required',
        rationale: 'Needs review',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    // Evaluate to create an approval request
    const evalResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      },
    });

    const approvalId = evalResponse.json().approval_request_id;

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/approvals/${approvalId}/status`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(approvalId);
    expect(body.status).toBe('pending');
    expect(body.decided_at).toBeNull();
    expect(body.approver_name).toBeNull();
    expect(body.decision_note).toBeNull();
  });

  it('returns 404 for non-existent approval', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/approvals/non-existent-id/status',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns correct fields: id, status, decided_at, approver_name, decision_note', async () => {
    await prisma.policyRule.create({
      data: {
        id: 'pol-fields-001',
        tenant_id: testData.tenant.id,
        agent_id: testData.agent.id,
        policy_name: 'Require approval',
        target_integration: 'communications_service',
        operation: 'send',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
        policy_effect: 'approval_required',
        rationale: 'Needs review',
        priority: 100,
        is_active: true,
        policy_version: 1,
        modified_by: 'test',
      },
    });

    const evalResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/evaluate',
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
      payload: {
        agent_id: testData.agent.id,
        operation: 'send',
        target_integration: 'communications_service',
        resource_scope: 'customer_emails',
        data_classification: 'confidential',
      },
    });

    const approvalId = evalResponse.json().approval_request_id;

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/approvals/${approvalId}/status`,
      headers: { authorization: `Bearer ${testData.rawApiKey}` },
    });

    const body = response.json();
    expect(Object.keys(body).sort()).toEqual([
      'approver_name',
      'decided_at',
      'decision_note',
      'id',
      'status',
    ]);
  });
});
```

**Important:** These describe blocks each have their own `beforeAll`/`afterAll` for server setup. Since vitest runs them sequentially in one file and `createTestServer()` / `destroyTestServer()` use module-level singletons, this will work correctly — the server is created once and reused.

- [ ] **Step 2: Run all tests**

Run: `cd apps/api && npx vitest run src/__tests__/integration/evaluate.test.ts`
Expected: All tests pass (20 evaluate + 7 outcome + 3 approval = 30 total).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/evaluate.test.ts
git commit -m "test(api): add outcome and approval status integration tests"
```

---

### Task 9: Full test suite and final verification

- [ ] **Step 1: Run all API tests**

Run: `cd apps/api && npx vitest run`
Expected: All integration tests pass (health, auth, policy-engine, evaluate).

- [ ] **Step 2: Run turbo test across all packages**

Run: `npx turbo test`
Expected: All packages pass.

- [ ] **Step 3: TypeScript check**

Run: `npx turbo build`
Expected: No errors.

- [ ] **Step 4: Commit any fixes, then final commit**

If any fixes were needed, commit them. Otherwise, this task is done.
