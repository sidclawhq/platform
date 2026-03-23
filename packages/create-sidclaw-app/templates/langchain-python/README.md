# {{projectName}}

A governed AI agent powered by [SidClaw](https://sidclaw.com).

## What This Demonstrates

Three tools with three different governance outcomes:
- `search_docs` — Allowed instantly (safe read operation)
- `send_email` — Requires human approval (check the dashboard!)
- `export_data` — Blocked by policy (data protection)

## Run

```bash
python main.py
```

## Approve Requests

When the agent tries to send an email, you'll see a pending approval at:
https://app.sidclaw.com/dashboard/approvals

## View Traces

See the complete audit trail at:
https://app.sidclaw.com/dashboard/audit
