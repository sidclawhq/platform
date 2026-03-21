import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { EvaluateRequestSchema } from '@sidclaw/shared';
import type { DataClassification } from '@sidclaw/shared';
import type { PrismaClient } from '../generated/prisma/index.js';
import { Prisma } from '../generated/prisma/index.js';
import { NotFoundError } from '../errors.js';
import { PolicyEngine } from '../services/policy-engine.js';
import { deriveRiskClassification } from '../services/risk-classification.js';
import { IntegrityService } from '../services/integrity-service.js';
import { WebhookService } from '../services/webhook-service.js';
import { EmailService } from '../services/email-service.js';
import { NotificationService } from '../services/notification-service.js';

const EvaluateRequestWithAgentSchema = EvaluateRequestSchema.extend({
  agent_id: z.string().min(1),
});

export async function evaluateRoutes(app: FastifyInstance) {
  const emailService = new EmailService();

  app.post('/evaluate', async (request, reply) => {
    const tenantId = request.tenantId!;
    const body = EvaluateRequestWithAgentSchema.parse(request.body);
    const db = request.tenantPrisma! as unknown as PrismaClient;

    let agentName = '';
    const result = await db.$transaction(async (tx) => {
      const integrity = new IntegrityService(tx as unknown as PrismaClient);
      let lastHash: string | null = null;
      let eventSeq = 0;
      const baseTime = Date.now();

      // Helper to create an event with integrity hash, chaining in memory.
      // Uses monotonic timestamps to guarantee ordering.
      const createEvent = async (
        traceId: string,
        agentId: string,
        eventData: {
          event_type: string;
          actor_type: string;
          actor_name: string;
          description: string;
          status: string;
          policy_version?: number;
          approval_request_id?: string;
          metadata?: object;
        },
      ) => {
        const eventId = randomUUID();
        const timestamp = new Date(baseTime + eventSeq++);

        const hash = await integrity.computeEventHash(
          tx as unknown as PrismaClient,
          traceId,
          {
            id: eventId,
            event_type: eventData.event_type,
            actor_type: eventData.actor_type,
            actor_name: eventData.actor_name,
            description: eventData.description,
            status: eventData.status,
            timestamp,
          },
          lastHash,
        );
        await tx.auditEvent.create({
          data: {
            id: eventId,
            tenant_id: tenantId,
            trace_id: traceId,
            agent_id: agentId,
            event_type: eventData.event_type,
            actor_type: eventData.actor_type,
            actor_name: eventData.actor_name,
            description: eventData.description,
            status: eventData.status,
            timestamp,
            integrity_hash: hash,
            policy_version: eventData.policy_version,
            approval_request_id: eventData.approval_request_id,
            metadata: eventData.metadata as Prisma.InputJsonValue | undefined,
          },
        });
        lastHash = hash;
        return hash;
      };

      // 1. Load agent
      const agent = await tx.agent.findFirst({
        where: { id: body.agent_id },
      });
      if (!agent) throw new NotFoundError('Agent', body.agent_id);
      agentName = agent.name;

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

      // Lock the trace row for hash chain serialization
      await tx.$queryRaw`SELECT id FROM "AuditTrace" WHERE id = ${trace.id} FOR UPDATE`;

      // 3. Create AuditEvent: trace_initiated
      await createEvent(trace.id, agent.id, {
        event_type: 'trace_initiated',
        actor_type: 'agent',
        actor_name: agent.name,
        description: `Agent initiated ${body.operation} operation on ${body.target_integration}`,
        status: 'started',
      });

      // 4. Create AuditEvent: identity_resolved
      await createEvent(trace.id, agent.id, {
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
      });

      // 5. Call policy engine
      const policyEngine = new PolicyEngine(tx as any);
      const decision = await policyEngine.evaluate(agent.id, {
        operation: body.operation,
        target_integration: body.target_integration,
        resource_scope: body.resource_scope,
        data_classification: body.data_classification,
      });

      // 6. Create AuditEvent: policy_evaluated
      await createEvent(trace.id, agent.id, {
        event_type: 'policy_evaluated',
        actor_type: 'policy_engine',
        actor_name: 'Policy Engine',
        description: decision.rule_id
          ? `Policy "${decision.rationale.substring(0, 80)}..." matched — effect: ${decision.effect}`
          : `No matching policy — default deny applied`,
        status: 'evaluated',
        policy_version: decision.policy_version ?? undefined,
        metadata: {
          effect: decision.effect,
          rule_id: decision.rule_id,
        },
      });

      // 7. If approval_required or deny, create sensitive_operation_detected event
      if (decision.effect === 'approval_required' || decision.effect === 'deny') {
        await createEvent(trace.id, agent.id, {
          event_type: 'sensitive_operation_detected',
          actor_type: 'policy_engine',
          actor_name: 'Policy Engine',
          description: `${body.data_classification} data classification detected on ${body.target_integration}`,
          status: 'flagged',
        });
      }

      // 8. Handle each decision type
      if (decision.effect === 'approval_required') {
        const policyRule = await tx.policyRule.findUnique({ where: { id: decision.rule_id! } });
        const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
        const ttlSeconds = policyRule?.max_session_ttl
          ?? (tenant?.settings as Record<string, unknown>)?.default_approval_ttl_seconds as number | undefined
          ?? 86400;
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        const riskClassification = deriveRiskClassification(
          body.data_classification as DataClassification,
          body.operation,
        );

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
            expires_at: expiresAt,
            risk_classification: riskClassification,
            context_snapshot: body.context != null ? body.context as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
          },
        });

        await createEvent(trace.id, agent.id, {
          event_type: 'approval_requested',
          actor_type: 'approval_service',
          actor_name: 'Approval Service',
          description: 'Approval request created — awaiting human reviewer',
          status: 'pending',
          approval_request_id: approvalRequest.id,
        });

        return {
          decision: 'approval_required' as const,
          trace_id: trace.id,
          approval_request_id: approvalRequest.id,
          reason: decision.rationale,
          policy_rule_id: decision.rule_id,
          risk_classification: riskClassification,
        };
      }

      if (decision.effect === 'allow') {
        await createEvent(trace.id, agent.id, {
          event_type: 'operation_allowed',
          actor_type: 'policy_engine',
          actor_name: 'Policy Engine',
          description: 'Operation allowed by policy — no approval required',
          status: 'allowed',
        });

        // Auto-close the trace for allow decisions
        const traceCloseHash = await createEvent(trace.id, agent.id, {
          event_type: 'trace_closed',
          actor_type: 'system',
          actor_name: 'Trace Service',
          description: 'Trace auto-closed: policy allowed action without approval',
          status: 'closed',
        });

        await tx.auditTrace.update({
          where: { id: trace.id },
          data: {
            final_outcome: 'executed',
            completed_at: new Date(),
            integrity_hash: traceCloseHash,
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
      await createEvent(trace.id, agent.id, {
        event_type: 'operation_denied',
        actor_type: 'policy_engine',
        actor_name: 'Policy Engine',
        description: `Operation denied — ${decision.rationale}`,
        status: 'denied',
      });

      const traceCloseHash = await createEvent(trace.id, agent.id, {
        event_type: 'trace_closed',
        actor_type: 'system',
        actor_name: 'Trace Service',
        description: 'Trace completed with outcome: blocked',
        status: 'closed',
      });

      await tx.auditTrace.update({
        where: { id: trace.id },
        data: {
          final_outcome: 'blocked',
          completed_at: new Date(),
          integrity_hash: traceCloseHash,
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

    // Webhook dispatch — AFTER transaction commits, fire and forget
    if (result.decision === 'approval_required') {
      const webhookService = new WebhookService(db);
      webhookService.dispatch(tenantId, 'approval.requested', {
        approval_request: {
          id: result.approval_request_id,
          trace_id: result.trace_id,
          agent_name: agentName,
          operation: body.operation,
          target_integration: body.target_integration,
          flag_reason: result.reason,
        },
      }).catch(() => {});
    }

    // Email notification — AFTER transaction commits, fire and forget
    if (result.decision === 'approval_required') {
      const notificationService = new NotificationService(db, emailService);
      notificationService.notifyApprovalRequested(tenantId, {
        id: result.approval_request_id!,
        agent_name: agentName,
        operation: body.operation,
        target_integration: body.target_integration,
        data_classification: body.data_classification,
        risk_classification: result.risk_classification ?? null,
        flag_reason: result.reason,
      }).catch(() => {});  // fire and forget
    }

    return reply.status(200).send(result);
  });
}
