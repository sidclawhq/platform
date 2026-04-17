import type { SidClawClient } from './client.js';

/**
 * Tool descriptors — published to MCP clients so the LLM knows what each tool
 * does. The `inputSchema` follows JSON Schema draft 2020-12 per MCP spec.
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'sidclaw_evaluate',
    description:
      "Pre-action policy check. Call before executing any risky action. " +
      "Returns 'allow', 'approval_required' (pending human review), or 'deny'. " +
      "Creates a hash-chained audit trace regardless of outcome.",
    inputSchema: {
      type: 'object',
      required: [
        'operation',
        'target_integration',
        'resource_scope',
        'data_classification',
      ],
      properties: {
        operation: {
          type: 'string',
          description: 'The action the agent wants to take (e.g., "send_email", "execute_trade", "delete_record").',
        },
        target_integration: {
          type: 'string',
          description: 'The system the action targets (e.g., "email_service", "trading_api", "filesystem").',
        },
        resource_scope: {
          type: 'string',
          description: 'The resource identifier (e.g., "customer_emails", "equities.us", "/data/users").',
        },
        data_classification: {
          type: 'string',
          enum: ['public', 'internal', 'confidential', 'restricted'],
          description: 'Data sensitivity tier.',
        },
        agent_id: {
          type: 'string',
          description: 'Overrides the default agent ID (set via SIDCLAW_AGENT_ID env).',
        },
        declared_goal: {
          type: 'string',
          description: "The agent's stated intent — shown to reviewers on the approval card.",
        },
        systems_touched: {
          type: 'array',
          items: { type: 'string' },
          description: 'Downstream systems this action will affect.',
        },
        reversible: {
          type: 'boolean',
          description: 'Whether the action can be undone.',
        },
        risk_score: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Optional agent-supplied risk score (0–100). The policy engine will still compute its own.',
        },
      },
    },
  },
  {
    name: 'sidclaw_record',
    description:
      "Log the outcome of an action that has already executed. Use this when you don't need pre-approval but want the action in the audit trail. " +
      'Attaches error classification, exit code, and optional token usage.',
    inputSchema: {
      type: 'object',
      required: ['trace_id', 'status'],
      properties: {
        trace_id: {
          type: 'string',
          description: 'Trace ID returned by a prior sidclaw_evaluate call.',
        },
        status: {
          type: 'string',
          enum: ['success', 'error'],
        },
        outcome_summary: {
          type: 'string',
          description: 'Truncated human-readable result (max 500 chars).',
        },
        error_classification: {
          type: 'string',
          enum: ['timeout', 'permission', 'not_found', 'runtime'],
        },
        exit_code: {
          type: 'number',
          description: 'Process exit code for shell/binary actions (0 = success).',
          minimum: -255,
          maximum: 255,
        },
        tokens_in: { type: 'number', minimum: 0 },
        tokens_out: { type: 'number', minimum: 0 },
        tokens_cache_read: { type: 'number', minimum: 0 },
        model: { type: 'string' },
        cost_estimate: { type: 'number', minimum: 0 },
        metadata: {
          type: 'object',
          description: 'Arbitrary caller-supplied metadata — attached to the outcome event for debugging.',
          additionalProperties: true,
        },
      },
    },
  },
  {
    name: 'sidclaw_approve',
    description:
      "Wait for a human approval to resolve. Use after sidclaw_evaluate returns 'approval_required'. " +
      'Blocks up to `timeout_seconds` seconds, polling every `poll_interval` seconds.',
    inputSchema: {
      type: 'object',
      required: ['approval_id'],
      properties: {
        approval_id: { type: 'string' },
        timeout_seconds: {
          type: 'number',
          minimum: 5,
          maximum: 3600,
          default: 300,
        },
        poll_interval: {
          type: 'number',
          minimum: 1,
          maximum: 60,
          default: 3,
        },
      },
    },
  },
  {
    name: 'sidclaw_policies',
    description: 'List active policy rules for the current tenant (or a specific agent).',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string' },
      },
    },
  },
  {
    name: 'sidclaw_session_start',
    description:
      "Generate a client-side session ID for your own bookkeeping. SidClaw does " +
      "NOT persist sessions on the backend — use sidclaw_evaluate + sidclaw_record " +
      "for the audit trail. This is purely a handle you can hold onto and pass to " +
      "sidclaw_session_end when your session finishes.",
    inputSchema: {
      type: 'object',
      required: ['agent_id'],
      properties: {
        agent_id: { type: 'string' },
        workspace: { type: 'string' },
        branch: { type: 'string' },
      },
    },
  },
  {
    name: 'sidclaw_session_end',
    description:
      "Close out a client-side session created via sidclaw_session_start. Not " +
      "persisted — this is a local no-op you can use to mark intent in your own logs.",
    inputSchema: {
      type: 'object',
      required: ['session_id', 'status'],
      properties: {
        session_id: { type: 'string' },
        status: {
          type: 'string',
          enum: ['completed', 'failed', 'cancelled'],
        },
        summary: { type: 'string' },
      },
    },
  },
] as const;


export type ToolName = (typeof TOOL_DEFINITIONS)[number]['name'];


export async function handleToolCall(
  client: SidClawClient,
  defaultAgentId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'sidclaw_evaluate':
        return ok(await handleEvaluate(client, defaultAgentId, args));
      case 'sidclaw_record':
        return ok(await handleRecord(client, args));
      case 'sidclaw_approve':
        return ok(await handleApprove(client, args));
      case 'sidclaw_policies':
        return ok(await handlePolicies(client, args));
      case 'sidclaw_session_start':
        return ok(await handleSessionStart(args));
      case 'sidclaw_session_end':
        return ok(await handleSessionEnd(args));
      default:
        return err(`unknown tool: ${name}`);
    }
  } catch (e) {
    return err((e as Error).message);
  }
}


function ok(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function err(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}


async function handleEvaluate(
  client: SidClawClient,
  defaultAgentId: string,
  args: Record<string, unknown>,
) {
  const required = ['operation', 'target_integration', 'resource_scope', 'data_classification'];
  for (const field of required) {
    if (typeof args[field] !== 'string' || !args[field]) {
      throw new Error(`sidclaw_evaluate requires ${field}`);
    }
  }
  const context: Record<string, unknown> = {};
  if (args.declared_goal) context.declared_goal = args.declared_goal;
  if (args.systems_touched) context.systems_touched = args.systems_touched;
  if (typeof args.reversible === 'boolean') context.reversible = args.reversible;
  if (typeof args.risk_score === 'number') context.risk_score = args.risk_score;

  return client.evaluate({
    agent_id: (args.agent_id as string) || defaultAgentId,
    operation: args.operation as string,
    target_integration: args.target_integration as string,
    resource_scope: args.resource_scope as string,
    data_classification: args.data_classification as
      | 'public'
      | 'internal'
      | 'confidential'
      | 'restricted',
    context: Object.keys(context).length > 0 ? context : undefined,
  });
}


async function handleRecord(client: SidClawClient, args: Record<string, unknown>) {
  if (typeof args.trace_id !== 'string' || !args.trace_id) {
    throw new Error('sidclaw_record requires trace_id');
  }
  const status = args.status;
  if (status !== 'success' && status !== 'error') {
    throw new Error('sidclaw_record status must be "success" or "error"');
  }
  const payload: Parameters<SidClawClient['recordOutcome']>[1] = { status };
  for (const key of [
    'outcome_summary',
    'error_classification',
    'exit_code',
    'tokens_in',
    'tokens_out',
    'tokens_cache_read',
    'model',
    'cost_estimate',
    'metadata',
  ] as const) {
    if (args[key] !== undefined) {
      // @ts-expect-error — narrowed by key
      payload[key] = args[key];
    }
  }
  await client.recordOutcome(args.trace_id, payload);
  return { recorded: true };
}


async function handleApprove(client: SidClawClient, args: Record<string, unknown>) {
  if (typeof args.approval_id !== 'string' || !args.approval_id) {
    throw new Error('sidclaw_approve requires approval_id');
  }
  const timeout = Number(args.timeout_seconds ?? 300);
  const pollInterval = Number(args.poll_interval ?? 3);
  return client.waitForApproval(args.approval_id, timeout, pollInterval);
}


async function handlePolicies(client: SidClawClient, args: Record<string, unknown>) {
  const agentId = typeof args.agent_id === 'string' ? args.agent_id : undefined;
  return client.listPolicies(agentId);
}


async function handleSessionStart(args: Record<string, unknown>) {
  if (typeof args.agent_id !== 'string' || !args.agent_id) {
    throw new Error('sidclaw_session_start requires agent_id');
  }
  // Sessions are client-side concept for this server — we return a synthetic id
  // so the LLM has a handle to use with session_end. The actual audit trail
  // happens through evaluate/record calls.
  const sessionId = `mcp-sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    session_id: sessionId,
    agent_id: args.agent_id,
    workspace: args.workspace ?? null,
    branch: args.branch ?? null,
    started_at: new Date().toISOString(),
  };
}


async function handleSessionEnd(args: Record<string, unknown>) {
  if (typeof args.session_id !== 'string') {
    throw new Error('sidclaw_session_end requires session_id');
  }
  if (args.status !== 'completed' && args.status !== 'failed' && args.status !== 'cancelled') {
    throw new Error('status must be completed | failed | cancelled');
  }
  return {
    session_id: args.session_id,
    status: args.status,
    summary: args.summary ?? null,
    ended_at: new Date().toISOString(),
  };
}
