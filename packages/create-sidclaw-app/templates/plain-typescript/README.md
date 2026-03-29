# {{projectName}}

A governed AI agent powered by [SidClaw](https://sidclaw.com).

## What This Demonstrates

Three functions with three different governance outcomes:
- `search_docs` — Allowed instantly (safe read operation)
- `send_email` — Requires human approval (check the dashboard!)
- `export_data` — Blocked by policy (data protection)

## How Governance Works

When you ran `create-sidclaw-app`, the CLI automatically created:

1. **An agent** registered in the SidClaw dashboard
2. **Three demo policies** that control what the agent can do:

| Function | Policy | Effect | Why |
|----------|--------|--------|-----|
| `search_docs` | Allow knowledge base search | Allowed | Safe read-only operation |
| `send_email` | Require approval for emails | Requires approval | High-risk: sends data externally |
| `export_data` | Block data export | Denied | Prevents unauthorized data extraction |

View and edit these policies: [Dashboard → Policies](https://app.sidclaw.com/dashboard/policies)

### Add your own policy

1. Go to [app.sidclaw.com/dashboard/policies](https://app.sidclaw.com/dashboard/policies)
2. Click "Create Policy"
3. Set the operation name to match your function
4. Choose the effect: allow, require approval, or deny

## Run

```bash
npm start
```

## Approve Requests

When the agent tries to send an email, you'll see a pending approval at:
https://app.sidclaw.com/dashboard/approvals

## View Traces

See the complete audit trail at:
https://app.sidclaw.com/dashboard/audit
