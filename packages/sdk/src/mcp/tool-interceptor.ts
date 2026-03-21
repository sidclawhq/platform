import type { AgentIdentityClient } from '../client/agent-identity-client.js';
import type { GovernanceMCPServerConfig } from './config.js';
import { findMapping, deriveResourceScope } from './tool-mapper.js';

export interface InterceptResult {
  action: 'forward' | 'error';
  traceId?: string;
  error?: { code: number; message: string; data?: Record<string, unknown> };
}

/**
 * Evaluates a tool call against the governance policy engine and returns
 * whether to forward, deny, or require approval.
 */
export async function interceptToolCall(
  toolName: string,
  args: Record<string, unknown>,
  client: AgentIdentityClient,
  config: GovernanceMCPServerConfig,
  upstreamServerName: string
): Promise<InterceptResult> {
  const mapping = findMapping(toolName, config.toolMappings ?? []);

  if (mapping?.skip_governance) {
    return { action: 'forward' };
  }

  const evalRequest = {
    operation: mapping?.operation ?? toolName,
    target_integration: mapping?.target_integration ?? upstreamServerName,
    resource_scope: mapping?.resource_scope ?? config.defaultResourceScope ?? deriveResourceScope(toolName, args),
    data_classification: mapping?.data_classification ?? config.defaultDataClassification ?? 'internal',
    context: { mcp_tool: toolName, mcp_args: args, mcp_server: upstreamServerName },
  };

  const decision = await client.evaluate(evalRequest);

  if (decision.decision === 'allow') {
    return { action: 'forward', traceId: decision.trace_id };
  }

  if (decision.decision === 'deny') {
    return {
      action: 'error',
      traceId: decision.trace_id,
      error: {
        code: -32001,
        message: `Action denied by policy: ${decision.reason}`,
        data: {
          type: 'action_denied',
          trace_id: decision.trace_id,
          reason: decision.reason,
          policy_rule_id: decision.policy_rule_id,
        },
      },
    };
  }

  // approval_required
  if (config.approvalWaitMode === 'block') {
    try {
      const approval = await client.waitForApproval(decision.approval_request_id!, {
        timeout: config.approvalBlockTimeoutMs ?? 30000,
        pollInterval: 1000,
      });
      if (approval.status === 'approved') {
        return { action: 'forward', traceId: decision.trace_id };
      }
      // Denied or expired
      return {
        action: 'error',
        traceId: decision.trace_id,
        error: {
          code: -32001,
          message: `Approval ${approval.status}: ${approval.decision_note ?? 'No reason provided'}`,
          data: {
            type: `approval_${approval.status}`,
            trace_id: decision.trace_id,
            approval_request_id: decision.approval_request_id,
          },
        },
      };
    } catch {
      // Timeout — return as error
      return {
        action: 'error',
        traceId: decision.trace_id,
        error: {
          code: -32001,
          message: `Approval required but timed out waiting: ${decision.reason}`,
          data: {
            type: 'approval_required',
            trace_id: decision.trace_id,
            approval_request_id: decision.approval_request_id,
            reason: decision.reason,
          },
        },
      };
    }
  }

  // Error mode (default): return immediately with structured error
  return {
    action: 'error',
    traceId: decision.trace_id,
    error: {
      code: -32001,
      message: `Approval required: ${decision.reason}`,
      data: {
        type: 'approval_required',
        trace_id: decision.trace_id,
        approval_request_id: decision.approval_request_id,
        reason: decision.reason,
      },
    },
  };
}
