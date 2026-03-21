import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EvaluateRequestSchema } from '@agent-identity/shared';
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
