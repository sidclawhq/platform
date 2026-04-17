# SidClaw Claude Code Hooks

Zero-code AI agent governance for [Claude Code](https://www.claude.com/product/claude-code).

These hooks intercept every tool call Claude Code makes (bash, file writes, MCP
tool invocations, subagent dispatches, cron jobs) and route them through
SidClaw's policy engine. Actions the policy allows run normally. Destructive
actions pause for human approval. Everything is audited with a tamper-evident
trace — hash-chained events you can verify end-to-end.

**MIT licensed.** No vendor lock-in. No framework dependency. Install in
30 seconds with `npm run hooks:install`.

---

## What it does

| Hook | When it runs | What it does |
|------|--------------|--------------|
| `sidclaw_pretool.py` | Before every governed tool call | Classifies the action, POSTs `/api/v1/evaluate`, enforces the decision (allow/deny/approval). |
| `sidclaw_posttool.py` | After every governed tool call | Records the outcome (exit code, error classification) on the trace. |
| `sidclaw_stop.py` | When a Claude Code turn completes | Attributes LLM token usage + cost to the traces from that turn. |

Governed by default: `Bash`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit`,
`Agent`, `Skill`, `RemoteTrigger`, `CronCreate`, `TeamCreate`, and all
`mcp__*` tools. Override with `SIDCLAW_GOVERNED_CATEGORIES`.

---

## Install

From within the SidClaw platform repo:

```bash
npm run hooks:install
```

Or copy into an existing project:

```bash
node /path/to/sidclaw/platform/scripts/install-hooks.mjs --target=.
```

Then set the two required environment variables (anywhere your shell picks
them up — `~/.zshrc`, `.envrc`, etc.):

```bash
export SIDCLAW_BASE_URL=https://api.sidclaw.com
export SIDCLAW_API_KEY=ai_your_key_here
```

Start Claude Code. Every governed tool call is now evaluated.

---

## Configuration

All options are environment variables — no config file.

| Variable | Default | What it does |
|----------|---------|--------------|
| `SIDCLAW_BASE_URL` | — (required) | SidClaw instance URL |
| `SIDCLAW_API_KEY` | — (required) | API key (scope: evaluate + read) |
| `SIDCLAW_AGENT_ID` | `claude-code` | Agent identity registered with SidClaw |
| `SIDCLAW_HOOK_MODE` | `enforce` | `enforce` blocks; `observe` logs only |
| `SIDCLAW_GUARD_TIMEOUT` | `2.5` | Seconds to wait for the evaluate call |
| `SIDCLAW_APPROVAL_TIMEOUT` | `300` | Max seconds the hook waits for human approval |
| `SIDCLAW_GOVERNED_CATEGORIES` | `execution,file_io,orchestration,mcp` | Which tool categories to govern (or `all`) |
| `SIDCLAW_DASHBOARD_URL` | derived from base URL | Where to send approvers |
| `SIDCLAW_FAIL_OPEN` | `false` | `true` allows tool calls on transport/server failures. **Auth errors (401/403) are never fail-open** — a revoked or wrong API key will always block, so operators can't accidentally bypass governance with a stale key. Rate limits (429) are ALSO not covered by this — use the separate opt-in below. |
| `SIDCLAW_FAIL_OPEN_ON_RATE_LIMIT` | `false` | `true` allows tool calls when SidClaw responds with 429. Default is closed because rate limits usually mean the tenant is legitimately over-quota — silently bypassing governance hides real problems. Turn on only if your Claude Code usage is so bursty that rate-limit fail-closed is worse than the governance gap. |
| `SIDCLAW_HOOK_DEBUG` | — | Set to any value to stream hook debug output to stderr |
| `SIDCLAW_WORKSPACE` | `pwd` | Base directory for "outside workspace" checks |
| `SIDCLAW_MODEL_PRICING` | built-in | Override JSON of per-1M-token prices |

---

## Policy-friendly action names

The hooks call `POST /api/v1/evaluate` with normalized action names so you can
write targeted policies:

| Tool | operation | target_integration | resource_scope |
|------|-----------|--------------------|-----------------|
| Bash (readonly) | `bash.readonly` | `claude_code` | the command (truncated) |
| Bash (destructive) | `bash.destructive` | `claude_code` | the command |
| Bash (deployment) | `bash.deployment` | `claude_code` | the command |
| Edit / Write / MultiEdit | `file_io.<tool>` | `claude_code` | the file path |
| Agent / Skill / RemoteTrigger | `orchestration.<tool>` | `claude_code` | subagent description |
| `mcp__foo__bar` | `mcp.mcp__foo__bar` | `claude_code` | full MCP tool name |

Example: block all `bash.destructive` actions unless approved:

```yaml
policy_name: Require approval for destructive bash
target_integration: claude_code
operation: bash.destructive
resource_scope: "*"
data_classification: confidential
policy_effect: approval_required
rationale: "Destructive shell commands need human review."
priority: 10
```

---

## Risk scoring

The PreToolUse hook assigns every action a risk score (0–100):

- Base risk from the tool catalog (`Bash`=70, `Write`=40, `Read`=5, etc.)
- +20 for destructive bash patterns (`rm -rf`, `DROP TABLE`, `git push --force`)
- +15 for sensitive paths (`/etc/passwd`, `~/.ssh`, `.env`)
- +15 for irreversible actions (shred, mkfs, truncate)
- +10 for network/deployment/traversal
- +15 for unhealthy MCP servers (≥3 recent failures)

The score is attached to the `context.classification.risk_score` field in
evaluate requests and shown on approval cards.

---

## Safety model

- **Fail closed by default.** If SidClaw is unreachable, the hook blocks
  the action (unless `SIDCLAW_FAIL_OPEN=true`).
- **Every governed call creates a trace.** Even `allow` decisions produce a
  hash-chained audit trail you can replay.
- **Observability mode.** `SIDCLAW_HOOK_MODE=observe` logs decisions without
  blocking — great for rolling out governance gradually.
- **Hook outputs go to stderr.** Claude Code shows stderr to the user, so
  denial reasons and approval URLs are visible in the conversation.

---

## Test / development

```bash
cd hooks
python -m pytest tests/
```

The tests use `pytest` and stub out the HTTP client — no SidClaw instance
required.
