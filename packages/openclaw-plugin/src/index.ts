/**
 * @sidclaw/openclaw-plugin — governance lifecycle hooks for OpenClaw agents.
 *
 * Two surfaces are exported:
 *
 *   1. `createSidClawPlugin(config)` — a framework-agnostic factory that
 *      returns an object shaped as `{ name, version, hooks: { before_tool_call,
 *      after_tool_call, llm_output, agent_end } }`. This is the raw, testable
 *      library surface that any runtime can drive.
 *
 *   2. `default` / `createSidClawOpenClawPluginEntry(config)` — a
 *      `definePluginEntry`-compatible export for the real `openclaw` package.
 *      Its `register(api)` wires the plugin into OpenClaw's real hook surface
 *      via `api.on(hookName, handler)` — the API confirmed against
 *      `openclaw@2026.4.14`'s `OpenClawPluginApi` in
 *      `dist/plugin-sdk/src/plugins/types.d.ts`.
 *
 * State is scoped per-session via `Map<sessionId, Map<toolCallId,
 * PendingTrace>>`, so concurrent sessions never contaminate each other.
 */

import type { AgentIdentityClient } from '@sidclaw/sdk';

// `estimateCost` is only available in @sidclaw/sdk >= 0.1.10. We import it
// lazily via a feature-detect pattern so this package still compiles and runs
// against older SDKs where the export may be missing.
type EstimateCostFn = (input: {
  model: string;
  tokens_in?: number;
  tokens_out?: number;
  tokens_cache_read?: number;
}) => number;

let _estimateCost: EstimateCostFn | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const sdk = require('@sidclaw/sdk') as { estimateCost?: EstimateCostFn };
  if (typeof sdk.estimateCost === 'function') {
    _estimateCost = sdk.estimateCost;
  }
} catch {
  // SDK not installed at require time (optional peer use case). No-op.
}
function estimateCostSafe(input: Parameters<EstimateCostFn>[0]): number {
  if (_estimateCost) {
    try {
      return _estimateCost(input);
    } catch {
      return 0;
    }
  }
  return 0;
}

export const PLUGIN_VERSION = '0.3.0';
export const PLUGIN_ID = '@sidclaw/openclaw-plugin';
export const PLUGIN_NAME = 'SidClaw Governance';
export const PLUGIN_DESCRIPTION =
  'SidClaw governance for OpenClaw — policy evaluation, approval workflow, audit trail, and token/cost attribution for every tool call.';

const DEFAULT_SESSION_ID = '__default__';

export interface PluginConfig {
  /** SidClaw SDK client used to evaluate and record traces. */
  client: AgentIdentityClient;
  /**
   * Default agent ID to use when the hook context does not supply one.
   * Hook contexts with `agent_id` always override this.
   */
  defaultAgentId?: string;
  /** `enforce` aborts denied tool calls; `observe` records but never blocks. */
  mode?: 'enforce' | 'observe';
  /**
   * Operation-prefix allowlist. Tool calls whose classified `operation` does
   * not contain any of these substrings are ignored. Unset = govern every
   * non-read-only tool (default behavior).
   */
  governedCategories?: string[];
  /**
   * Map OpenClaw tool names to SidClaw action metadata. Return `null` to fall
   * back to the built-in heuristic classifier. Return a classification to
   * override it. Throw to refuse a tool outright.
   */
  toolClassifier?: (toolName: string, toolArgs: unknown) => ClassifiedAction | null;
  /**
   * Optional base URL used to render the approval URL surfaced to OpenClaw
   * (Block Kit / card approve-deny flows). Defaults to
   * `https://app.sidclaw.com`.
   */
  approvalDashboardUrl?: string;
}

export interface ClassifiedAction {
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: 'public' | 'internal' | 'confidential' | 'restricted';
  reversible?: boolean;
  risk_score?: number;
}

/** Context passed into every lifecycle hook by the host runtime. */
export interface HookContext {
  tool_name?: string;
  tool_args?: unknown;
  tool_call_id?: string;
  session_id?: string;
  agent_id?: string;
  run_id?: string;
  output?: unknown;
  error?: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    model?: string;
  };
}

interface PendingTrace {
  trace_id: string;
  tool_call_id: string;
  agent_id?: string;
}

/** Outcome the raw `before_tool_call` hook can return. */
export type BeforeToolCallResult =
  | { abort: true; reason: string }
  | { requireApproval: { reason: string; url: string; approval_request_id?: string } }
  | void;

export interface SidClawLifecycleHooks {
  before_tool_call: (ctx: HookContext) => Promise<BeforeToolCallResult>;
  after_tool_call: (ctx: HookContext) => Promise<void>;
  llm_output: (ctx: HookContext) => Promise<void>;
  agent_end: (ctx?: HookContext) => Promise<void>;
}

export interface SidClawPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  hooks: SidClawLifecycleHooks;
  /** Inspect internal per-session state. Exposed for tests/debugging. */
  _internal: {
    pendingCount(sessionId?: string): number;
    sessionIds(): string[];
  };
}

/**
 * Tokens (case-insensitive) that mark a tool name as destructive.
 *
 * `remove` was intentionally dropped: it is too generic and produces false
 * positives for DOM-style APIs (`removeFilter`, `removeChild`, `removeListener`).
 */
const DESTRUCTIVE_VERBS = new Set([
  'rm',
  'delete',
  'drop',
  'truncate',
  'destroy',
  'wipe',
  'purge',
  'erase',
]);

/**
 * Check if a tool name's **leading verb** is destructive. Splits on `_`, `-`,
 * `.`, whitespace, and camelCase boundaries and only looks at the first
 * token, because that's where the action lives in idiomatic tool names.
 */
function isDestructiveName(name: string): boolean {
  const tokens = name
    // Split camelCase: insert a space at each lower→Upper boundary.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return DESTRUCTIVE_VERBS.has(tokens[0]);
}

/** Tool names (case-insensitive) that are read-only and skipped by default. */
const READ_ONLY_TOOL_NAMES = new Set([
  'read',
  'read_file',
  'grep',
  'search',
  'glob',
  'list',
  'view',
  'ls',
  'cat',
  'get',
  'fetch',
]);

/** Build the raw SidClaw governance plugin. */
export function createSidClawPlugin(config: PluginConfig): SidClawPlugin {
  const {
    client,
    defaultAgentId,
    mode = 'enforce',
    governedCategories,
    toolClassifier,
    approvalDashboardUrl = 'https://app.sidclaw.com',
  } = config;

  // Session-scoped trace map: sessionId -> toolCallId -> PendingTrace.
  const pendingBySession = new Map<string, Map<string, PendingTrace>>();
  // runId -> set of traceIds we've already attributed telemetry to for that
  // run. Prevents double-charging when `llm_output` fires multiple times for
  // the same run (e.g. streamed chunks + final).
  const telemetryDedup = new Map<string, Set<string>>();

  function sessionMap(sessionId: string): Map<string, PendingTrace> {
    let m = pendingBySession.get(sessionId);
    if (!m) {
      m = new Map();
      pendingBySession.set(sessionId, m);
    }
    return m;
  }

  function sessionKey(ctx: HookContext): string {
    return ctx.session_id ?? DEFAULT_SESSION_ID;
  }

  function classify(toolName: string, toolArgs: unknown): ClassifiedAction | null {
    if (toolClassifier) {
      const c = toolClassifier(toolName, toolArgs);
      if (c !== null) return c;
    }
    const lower = toolName.toLowerCase();
    if (READ_ONLY_TOOL_NAMES.has(lower)) return null;

    const destructive = isDestructiveName(toolName);
    return {
      operation: `openclaw.${toolName}`,
      target_integration: 'openclaw',
      resource_scope: toolName,
      // Classification describes sensitivity, not destructiveness.
      data_classification: 'internal',
      reversible: !destructive,
      risk_score: destructive ? 70 : 30,
    };
  }

  function isGoverned(classification: ClassifiedAction): boolean {
    if (!governedCategories || governedCategories.length === 0) return true;
    return governedCategories.some((c) => classification.operation.includes(c));
  }

  function resolveAgentId(ctx: HookContext): string | undefined {
    // Hook context wins over config default.
    return ctx.agent_id ?? defaultAgentId;
  }

  function approvalUrl(approvalRequestId: string | null | undefined): string {
    if (!approvalRequestId) return `${approvalDashboardUrl}/dashboard/approvals`;
    return `${approvalDashboardUrl}/dashboard/approvals/${approvalRequestId}`;
  }

  const hooks: SidClawLifecycleHooks = {
    async before_tool_call(ctx): Promise<BeforeToolCallResult> {
      const toolName = ctx.tool_name ?? '';
      if (!toolName) return;

      const action = classify(toolName, ctx.tool_args ?? {});
      if (!action) return;
      if (!isGoverned(action)) return;

      const agentId = resolveAgentId(ctx);

      try {
        const result = await client.evaluate({
          ...(agentId ? { agent_id: agentId } : {}),
          operation: action.operation,
          target_integration: action.target_integration,
          resource_scope: action.resource_scope,
          data_classification: action.data_classification,
          context: {
            tool_name: toolName,
            reversible: action.reversible,
            risk_score: action.risk_score,
            tool_args_summary: stringify(ctx.tool_args ?? {}, 500),
            session_id: ctx.session_id,
          },
        });

        if (result.trace_id && ctx.tool_call_id) {
          sessionMap(sessionKey(ctx)).set(ctx.tool_call_id, {
            trace_id: result.trace_id,
            tool_call_id: ctx.tool_call_id,
            agent_id: agentId,
          });
        }

        if (mode === 'observe') return;

        if (result.decision === 'deny') {
          return {
            abort: true,
            reason: result.reason ?? 'SidClaw policy denied this tool call',
          };
        }

        if (result.decision === 'approval_required') {
          return {
            requireApproval: {
              reason: result.reason ?? 'SidClaw requires human approval for this tool call',
              url: approvalUrl(result.approval_request_id ?? null),
              ...(result.approval_request_id
                ? { approval_request_id: result.approval_request_id }
                : {}),
            },
          };
        }
      } catch (err) {
        if (mode === 'enforce') {
          return {
            abort: true,
            reason: `SidClaw unreachable: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
    },

    async after_tool_call(ctx) {
      if (!ctx.tool_call_id) return;
      const map = sessionMap(sessionKey(ctx));
      const pending = map.get(ctx.tool_call_id);
      if (!pending) return;
      map.delete(ctx.tool_call_id);

      const hasError = ctx.error != null;
      try {
        await client.recordOutcome(pending.trace_id, {
          status: hasError ? 'error' : 'success',
          outcome_summary: ctx.output ? stringify(ctx.output, 500) : undefined,
          error_classification: classifyError(ctx.error),
        });
      } catch {
        // best-effort: never throw from an audit recording failure.
      }
    },

    async llm_output(ctx) {
      const usage = ctx.usage;
      if (!usage) return;

      // Only distribute across traces for THIS session.
      const map = sessionMap(sessionKey(ctx));
      const traceIds = Array.from(map.values()).map((p) => p.trace_id);
      if (traceIds.length === 0) return;

      // recordTelemetry shipped in @sidclaw/sdk 0.1.11. Gracefully no-op on
      // older SDKs that don't expose it.
      const recordTelemetry = (client as unknown as {
        recordTelemetry?: (
          traceId: string,
          telemetry: Record<string, unknown>,
        ) => Promise<unknown>;
      }).recordTelemetry;
      if (typeof recordTelemetry !== 'function') return;

      // runId-based dedup: skip traces we've already attributed for this run.
      const runId = ctx.run_id;
      const seen = runId ? (telemetryDedup.get(runId) ?? new Set<string>()) : undefined;
      const targets = seen ? traceIds.filter((id) => !seen.has(id)) : traceIds;
      if (targets.length === 0) return;

      const divisor = targets.length;
      const perIn = Math.floor((usage.input_tokens ?? 0) / divisor);
      const perOut = Math.floor((usage.output_tokens ?? 0) / divisor);
      const perCache = Math.floor((usage.cache_read_input_tokens ?? 0) / divisor);
      const model = usage.model ?? '';
      const cost = model
        ? estimateCostSafe({
            model,
            tokens_in: perIn,
            tokens_out: perOut,
            tokens_cache_read: perCache,
          })
        : 0;

      await Promise.all(
        targets.map(async (traceId) => {
          try {
            await recordTelemetry.call(client, traceId, {
              tokens_in: perIn || undefined,
              tokens_out: perOut || undefined,
              tokens_cache_read: perCache || undefined,
              model: model || undefined,
              cost_estimate: cost > 0 ? cost : undefined,
            });
            if (runId) {
              if (!seen) return;
              seen.add(traceId);
            }
          } catch {
            // best-effort
          }
        }),
      );

      if (runId && seen) telemetryDedup.set(runId, seen);
    },

    async agent_end(ctx) {
      if (ctx?.session_id) {
        pendingBySession.delete(ctx.session_id);
      } else {
        pendingBySession.clear();
      }
      if (ctx?.run_id) {
        telemetryDedup.delete(ctx.run_id);
      } else if (!ctx?.session_id) {
        telemetryDedup.clear();
      }
    },
  };

  return {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: PLUGIN_DESCRIPTION,
    hooks,
    _internal: {
      pendingCount(sessionId?: string): number {
        if (sessionId) return pendingBySession.get(sessionId)?.size ?? 0;
        let total = 0;
        for (const m of pendingBySession.values()) total += m.size;
        return total;
      },
      sessionIds(): string[] {
        return Array.from(pendingBySession.keys());
      },
    },
  };
}

/* -------------------------------------------------------------------------- *
 * OpenClaw plugin-sdk interop
 *
 * The real `openclaw@2026.4.14` `OpenClawPluginApi` (from
 * `dist/plugin-sdk/src/plugins/types.d.ts` in the published tarball) exposes:
 *
 *   api.on<K extends PluginHookName>(
 *     hookName: K,
 *     handler: PluginHookHandlerMap[K],
 *     opts?: { priority?: number },
 *   ): void;
 *
 * with hook names including `before_tool_call`, `after_tool_call`,
 * `llm_output`, `session_end`, `agent_end`, and others. Event payloads are
 * typed as `PluginHookBeforeToolCallEvent`, `PluginHookAfterToolCallEvent`,
 * etc., with a `PluginHookToolContext` (for tool events) or
 * `PluginHookAgentContext` (for llm/agent events) or `PluginHookSessionContext`
 * (for session events).
 *
 * We re-declare a structural subset of the types here so this package stays
 * installable without `openclaw` in the dependency graph (it's an optional
 * peer).
 * -------------------------------------------------------------------------- */

type OcToolContext = {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  toolName: string;
  toolCallId?: string;
};

type OcAgentContext = {
  runId?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  workspaceDir?: string;
  modelProviderId?: string;
  modelId?: string;
  messageProvider?: string;
  trigger?: string;
  channelId?: string;
};

type OcSessionContext = {
  agentId?: string;
  sessionId: string;
  sessionKey?: string;
};

type OcBeforeToolCallEvent = {
  toolName: string;
  params: Record<string, unknown>;
  runId?: string;
  toolCallId?: string;
};

type OcBeforeToolCallResult =
  | {
      params?: Record<string, unknown>;
      block?: boolean;
      blockReason?: string;
      requireApproval?: {
        title: string;
        description: string;
        severity?: 'info' | 'warning' | 'critical';
        timeoutMs?: number;
        timeoutBehavior?: 'allow' | 'deny';
        pluginId?: string;
      };
    }
  | void;

type OcAfterToolCallEvent = {
  toolName: string;
  params: Record<string, unknown>;
  runId?: string;
  toolCallId?: string;
  result?: unknown;
  error?: string;
  durationMs?: number;
};

type OcLlmOutputEvent = {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  assistantTexts: string[];
  lastAssistant?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
};

type OcAgentEndEvent = {
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs?: number;
};

type OcSessionEndEvent = {
  sessionId: string;
  sessionKey?: string;
  messageCount: number;
  durationMs?: number;
  reason?: string;
  sessionFile?: string;
  transcriptArchived?: boolean;
  nextSessionId?: string;
  nextSessionKey?: string;
};

/**
 * A minimal structural shape of `OpenClawPluginApi` we rely on. The real type
 * is far richer (tool registration, provider registration, etc.) but the hook
 * registry is the only surface this plugin touches.
 */
export interface OpenClawPluginApiShape {
  id?: string;
  name?: string;
  logger?: {
    info?: (msg: string, meta?: unknown) => void;
    warn?: (msg: string, meta?: unknown) => void;
    error?: (msg: string, meta?: unknown) => void;
  };
  on: (hookName: string, handler: (...args: unknown[]) => unknown, opts?: unknown) => void;
}

export interface OpenClawPluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  /** Raw lifecycle hooks — agents/runtimes that drive them directly can use these. */
  hooks: SidClawLifecycleHooks;
  /** Called by OpenClaw with its plugin API during plugin load. */
  register(api: OpenClawPluginApiShape): void;
}

/**
 * Build a `definePluginEntry`-compatible definition for OpenClaw.
 *
 * On load, OpenClaw calls `register(api)` and we wire handlers onto
 * `api.on('before_tool_call', …)`, `api.on('after_tool_call', …)`,
 * `api.on('llm_output', …)`, and `api.on('agent_end', …)`. We translate
 * OpenClaw's event + ctx payloads into the plugin's internal `HookContext`
 * shape and bridge the `before_tool_call` return value back into OpenClaw's
 * `PluginHookBeforeToolCallResult` union (`{ block, blockReason }` or
 * `{ requireApproval: { title, description, … } }`).
 */
export function createSidClawOpenClawPluginEntry(config: PluginConfig): OpenClawPluginDefinition {
  const plugin = createSidClawPlugin(config);

  const register: OpenClawPluginDefinition['register'] = (api) => {
    const logger = api.logger;

    if (typeof api.on !== 'function') {
      logger?.warn?.(
        `${PLUGIN_ID}: host API does not expose \`on\` — tool lifecycle hooks must be driven directly.`,
      );
      return;
    }

    // before_tool_call: evaluate, translate result into OpenClaw's union.
    api.on('before_tool_call', async (...args: unknown[]) => {
      const event = args[0] as OcBeforeToolCallEvent;
      const ctx = args[1] as OcToolContext;
      const internal: HookContext = {
        tool_name: event.toolName,
        tool_args: event.params,
        tool_call_id: event.toolCallId ?? ctx.toolCallId,
        session_id: ctx.sessionId ?? ctx.sessionKey,
        agent_id: ctx.agentId,
        run_id: event.runId ?? ctx.runId,
      };
      const result = await plugin.hooks.before_tool_call(internal);
      return translateBeforeToolCallResult(result);
    });

    api.on('after_tool_call', async (...args: unknown[]) => {
      const event = args[0] as OcAfterToolCallEvent;
      const ctx = args[1] as OcToolContext;
      await plugin.hooks.after_tool_call({
        tool_name: event.toolName,
        tool_args: event.params,
        tool_call_id: event.toolCallId ?? ctx.toolCallId,
        session_id: ctx.sessionId ?? ctx.sessionKey,
        agent_id: ctx.agentId,
        run_id: event.runId ?? ctx.runId,
        output: event.result,
        error: event.error,
      });
    });

    api.on('llm_output', async (...args: unknown[]) => {
      const event = args[0] as OcLlmOutputEvent;
      const ctx = args[1] as OcAgentContext;
      await plugin.hooks.llm_output({
        session_id: event.sessionId ?? ctx.sessionId ?? ctx.sessionKey,
        agent_id: ctx.agentId,
        run_id: event.runId ?? ctx.runId,
        usage: event.usage
          ? {
              input_tokens: event.usage.input,
              output_tokens: event.usage.output,
              cache_read_input_tokens: event.usage.cacheRead,
              model: event.model,
            }
          : undefined,
      });
    });

    api.on('agent_end', async (...args: unknown[]) => {
      // `agent_end` doesn't carry a sessionId in its event; the context does.
      const _event = args[0] as OcAgentEndEvent;
      void _event;
      const ctx = args[1] as OcAgentContext;
      await plugin.hooks.agent_end({
        session_id: ctx.sessionId ?? ctx.sessionKey,
        agent_id: ctx.agentId,
        run_id: ctx.runId,
      });
    });

    api.on('session_end', async (...args: unknown[]) => {
      const event = args[0] as OcSessionEndEvent;
      const ctx = args[1] as OcSessionContext;
      await plugin.hooks.agent_end({
        session_id: event.sessionId ?? ctx.sessionId ?? ctx.sessionKey,
        agent_id: ctx.agentId,
      });
    });

    logger?.info?.(`${PLUGIN_ID}@${PLUGIN_VERSION} registered`);
  };

  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    hooks: plugin.hooks,
    register,
  };
}

/**
 * Translate the plugin's internal `BeforeToolCallResult` into OpenClaw's
 * `PluginHookBeforeToolCallResult` union.
 */
function translateBeforeToolCallResult(
  r: BeforeToolCallResult,
): OcBeforeToolCallResult {
  if (!r) return undefined;
  if ('abort' in r && r.abort) {
    return { block: true, blockReason: r.reason };
  }
  if ('requireApproval' in r) {
    const { reason, url } = r.requireApproval;
    return {
      requireApproval: {
        title: 'SidClaw approval required',
        description: `${reason}\n\nReview in dashboard: ${url}`,
        severity: 'warning',
        pluginId: PLUGIN_ID,
      },
    };
  }
  return undefined;
}

function classifyError(
  error: unknown,
): 'timeout' | 'permission' | 'not_found' | 'runtime' | undefined {
  if (!error) return undefined;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
  if (msg.includes('permission') || msg.includes('eacces')) return 'permission';
  if (msg.includes('not found') || msg.includes('enoent')) return 'not_found';
  return 'runtime';
}

function stringify(value: unknown, limit: number): string {
  let text: string;
  if (typeof value === 'string') text = value;
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1) + '…';
}

/**
 * Default export: a factory matching OpenClaw's `definePluginEntry` signature.
 *
 * Consumers typically wrap it with `definePluginEntry` from
 * `openclaw/plugin-sdk`:
 *
 * ```ts
 * import { definePluginEntry } from 'openclaw/plugin-sdk';
 * import { createSidClawOpenClawPluginEntry } from '@sidclaw/openclaw-plugin';
 * export default definePluginEntry(createSidClawOpenClawPluginEntry({ client }));
 * ```
 */
export default createSidClawOpenClawPluginEntry;
