---
name: sidclaw-governance
description: "Teach Claude Code to self-govern using SidClaw — check policies before risky actions, wait for human approval on flagged ones, and record every outcome. Use when you want the agent to self-instrument governance without hooks, or alongside hooks for explicit control."
license: MIT
metadata:
  tags:
    - security
    - governance
    - audit
    - compliance
    - mcp
---

# SidClaw Governance

You have access to SidClaw — an identity, policy, approval, and audit layer
for AI agents. The governance MCP tools are available as `sidclaw_evaluate`,
`sidclaw_record`, `sidclaw_approve`, `sidclaw_policies`, `sidclaw_session_start`,
and `sidclaw_session_end`.

## When to use these tools

Call governance BEFORE executing any action that could:
- modify the file system outside the immediate workspace
- run a destructive shell command (`rm -rf`, `DROP TABLE`, `git push --force`, etc.)
- dispatch a subagent, create a cron, create a team, or trigger a remote action
- hit a network API that sends data to a third party
- deploy code, push to a remote branch, or publish a package
- move money, send messages to real users, or modify medical/legal records

**Quick mental model — risk tiers:**

| Risk | When | What to do |
|------|------|-----------|
| < 30 | Local-only, reversible, internal data | Call `sidclaw_record` after (log-only) |
| 30–70 | Moderate effect, recoverable, might surprise a reviewer | Call `sidclaw_evaluate` first |
| > 70 | Destructive, irreversible, or touches production / regulated data | Always `sidclaw_evaluate` first |

Do not bypass governance for convenience. If evaluate returns `deny`, do not
retry with a different phrasing to try to slip through. Explain the situation
to the user and ask for guidance.

## The protocol

### Step 1. Start a session (optional but nice for audit grouping)

```
sidclaw_session_start({
  agent_id: "claude-code",
  workspace: "/path/to/repo",
  branch: "feature/x"
})
→ { session_id: "mcp-sess-..." }
```

Hold on to `session_id` for the whole turn.

### Step 2. Before each risky action, call `sidclaw_evaluate`

```
sidclaw_evaluate({
  operation: "bash.destructive",
  target_integration: "claude_code",
  resource_scope: "rm -rf ./data/",
  data_classification: "restricted",
  declared_goal: "Clean up stale migration artifacts per user request",
  systems_touched: ["filesystem"],
  reversible: false,
  risk_score: 95
})
```

Handle the response:

- `decision: "allow"` — proceed. Note the `trace_id` for the next step.
- `decision: "approval_required"` — do NOT execute yet. Go to step 3.
- `decision: "deny"` — tell the user the action was blocked by policy.
  Include the reason. Suggest alternatives (safer commands, scoped targets).
  Never retry with tweaked parameters hoping to slip past the policy.

### Step 3. If flagged, wait for human approval

```
sidclaw_approve({
  approval_id: "<from evaluate response>",
  timeout_seconds: 300
})
→ { status: "approved" | "denied" | "expired" | "timeout" }
```

Tell the user the approval URL while waiting so they can act:
`<dashboard>/dashboard/approvals/<approval_id>`

If approved → execute. If anything else → stop and explain.

### Step 4. After executing (or failing), call `sidclaw_record`

```
sidclaw_record({
  trace_id: "<from evaluate>",
  status: "success" | "error",
  outcome_summary: "3 files deleted",
  exit_code: 0,
  error_classification: "timeout" | "permission" | "not_found" | "runtime",
  tokens_in: 1200,
  tokens_out: 340,
  model: "claude-sonnet-4-6",
  cost_estimate: 0.005
})
```

Including token usage is optional but turns every governed action into a cost
data point. Enterprise reviewers love that.

### Step 5. End the session

```
sidclaw_session_end({
  session_id: "<from step 1>",
  status: "completed" | "failed" | "cancelled",
  summary: "Cleaned migration artifacts, pushed to feature/x"
})
```

## Example — a destructive bash command

User: "Delete the old migration files in ./data/"

You:
1. Recognize this is high-risk (destructive, filesystem, probably irreversible).
2. Call `sidclaw_evaluate({ operation: "bash.destructive", target_integration: "claude_code", resource_scope: "rm -rf ./data/", data_classification: "internal", declared_goal: "Delete stale migration artifacts per user request", reversible: false })`
3. Response: `{ decision: "approval_required", approval_id: "ap-42", trace_id: "tr-91" }`
4. Tell the user: "This will irreversibly delete ./data/. I've flagged it for approval — please review at <url>."
5. Call `sidclaw_approve({ approval_id: "ap-42", timeout_seconds: 180 })`
6. If approved, run the `rm -rf`, then call `sidclaw_record({ trace_id: "tr-91", status: "success", outcome_summary: "..." })`
7. If denied/timeout, stop and ask the user what they'd like to do instead.

## Do NOT

- Do not call `sidclaw_record` with `status: "success"` for an action you did
  not actually execute.
- Do not skip `sidclaw_evaluate` because the command looks "safe to you."
  Your intuition about safety is not the policy — the policy is.
- Do not swallow a `deny` and try again with a renamed operation. The
  audit trail already recorded the attempt.
- Do not tell the user you have approval when `sidclaw_approve` returned
  `timeout` or `denied`.
- Do not expose API keys or session secrets in declared_goal / outcome_summary.

## Working alongside the hooks

If the SidClaw Claude Code hooks are also installed (`hooks/` in the SidClaw
repo), every bash/edit/write call is ALREADY governed at the hook layer. You
do not need to call `sidclaw_evaluate` for those tools — the hook does it.

Use these MCP tools for:
- Governance of actions the hooks don't cover (custom API calls, MCP tool
  orchestration, decisions to send emails/SMS, decisions to move money)
- Explicit audit recording (`sidclaw_record`) for actions the hooks can't
  see (LLM reasoning outcomes, multi-step chains)
- Reading the policy set before choosing an approach (`sidclaw_policies`)

## License

MIT. Copyright (c) 2026 SidClaw.
