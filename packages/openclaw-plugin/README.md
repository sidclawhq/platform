# @sidclaw/openclaw-plugin

Adds SidClaw governance — policy evaluation, approval workflow, tamper-evident
audit trail, and token / cost attribution — to [OpenClaw](https://www.npmjs.com/package/openclaw)
agents.

MIT licensed. Version `0.3.0`.

## Install

```bash
npm install @sidclaw/openclaw-plugin @sidclaw/sdk openclaw
```

`openclaw` is an optional peer — install it only if you're wiring the plugin
into a real OpenClaw runtime.

## Quick start — OpenClaw runtime

Create `sidclaw.openclaw-plugin.ts` in your OpenClaw project:

```typescript
import { definePluginEntry } from 'openclaw/plugin-sdk';
import { AgentIdentityClient } from '@sidclaw/sdk';
import { createSidClawOpenClawPluginEntry } from '@sidclaw/openclaw-plugin';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: process.env.SIDCLAW_BASE_URL ?? 'https://api.sidclaw.com',
  agentId: process.env.SIDCLAW_AGENT_ID!,
});

export default definePluginEntry(
  createSidClawOpenClawPluginEntry({
    client,
    mode: 'enforce', // or 'observe'
    defaultAgentId: process.env.SIDCLAW_AGENT_ID,
  }),
);
```

`createSidClawOpenClawPluginEntry` returns an object with
`{ id, name, description, version, hooks, register }` that `definePluginEntry`
accepts directly.

## What gets wired

The plugin calls `api.on(name, handler)` (OpenClaw's real
`OpenClawPluginApi.on<K extends PluginHookName>` surface) for:

| OpenClaw hook | Behavior |
|---|---|
| `before_tool_call` | Classify tool call, POST `/api/v1/evaluate`, return `{ block, blockReason }` on deny, `{ requireApproval: { title, description, … } }` on `approval_required`, or nothing on allow |
| `after_tool_call` | Record outcome + error classification on the trace |
| `llm_output` | Translate OpenClaw's `{ input, output, cacheRead }` usage into SidClaw telemetry and attribute cost across this session's open traces (runId-deduped) |
| `agent_end` | Drop pending state for the agent's session |
| `session_end` | Flush session state |

Event payloads and context fields are mapped from OpenClaw's typed
`PluginHookBeforeToolCallEvent` + `PluginHookToolContext` (etc.) into the
plugin's internal `HookContext` shape.

## Quick start — library / custom runtime

If you are embedding SidClaw governance into a runtime that is not OpenClaw
(or into unit tests), use the raw factory directly:

```typescript
import { createSidClawPlugin } from '@sidclaw/openclaw-plugin';
import { AgentIdentityClient } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  agentId: 'agent-default',
});

const plugin = createSidClawPlugin({ client, mode: 'enforce' });

// Before every tool call:
const gate = await plugin.hooks.before_tool_call({
  tool_name: 'send_email',
  tool_args: { to: 'customer@acme.com' },
  tool_call_id: 'tc-123',
  session_id: 'session-abc',
  agent_id: 'agent-default',
});
if (gate && 'abort' in gate && gate.abort) throw new Error(gate.reason);
if (gate && 'requireApproval' in gate) {
  // Surface gate.requireApproval.url to the human approver and wait.
}

// After the tool call returns (or errors):
await plugin.hooks.after_tool_call({
  tool_call_id: 'tc-123',
  session_id: 'session-abc',
  output: 'queued',
});

// Optional: attribute LLM usage to open traces for this session.
await plugin.hooks.llm_output({
  session_id: 'session-abc',
  run_id: 'run-1',
  usage: { input_tokens: 2000, output_tokens: 400, model: 'claude-sonnet-4-6' },
});

// When the agent session ends:
await plugin.hooks.agent_end({ session_id: 'session-abc' });
```

## Session isolation

Trace state is scoped by `session_id` (internally:
`Map<sessionId, Map<toolCallId, PendingTrace>>`). Two sessions can reuse the
same `tool_call_id` without collision, and `llm_output` only attributes
tokens to the traces for its own session.

## runId-based telemetry dedup

`llm_output` keeps a `Map<runId, Set<traceId>>` so streamed or replayed
emissions within the same LLM run never double-charge telemetry. New runs
attribute fresh.

## Tool classification

The default classifier:

- Skips a small allowlist of obvious read-only tool names (`read`, `read_file`,
  `grep`, `search`, `glob`, `list`, `view`, `ls`, `cat`, `get`, `fetch`).
- Flags tools whose **leading verb token** is one of `rm`, `delete`, `drop`,
  `truncate`, `destroy`, `wipe`, `purge`, or `erase` as destructive.
  `removeFilter`, `removeChild`, `list_delete_candidates` are **not** flagged —
  only the first token counts, and `remove` was dropped because of DOM-style
  false positives.
- Emits `data_classification: 'internal'` by default (sensitivity, not
  destructiveness). Destructive signals are expressed via `reversible: false`
  and `risk_score: 70`.

Override with a custom classifier:

```typescript
createSidClawOpenClawPluginEntry({
  client,
  toolClassifier: (toolName, args) => {
    if (toolName === 'postgres_query') {
      const sql = (args as { sql?: string })?.sql ?? '';
      const mutating = /\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER)\b/i.test(sql);
      return {
        operation: mutating ? 'sql.write' : 'sql.read',
        target_integration: 'postgres',
        resource_scope: 'default',
        data_classification: mutating ? 'restricted' : 'confidential',
        reversible: !mutating,
      };
    }
    return null; // fall back to the built-in classifier
  },
});
```

## Compatibility

- `@sidclaw/sdk` is a **peer dependency** at `^0.1.11`. `recordTelemetry` is
  feature-detected at runtime, so the plugin still works against older SDKs —
  telemetry calls simply no-op.
- `openclaw` is an **optional peer dependency** at `>=2026.4.0`. The plugin
  runs against any host that implements the `OpenClawPluginApi.on(hookName,
  handler)` shape.

## License

MIT
