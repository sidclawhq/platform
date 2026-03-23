# {{projectName}}

A governed AI agent chat app powered by [SidClaw](https://sidclaw.com) and the Vercel AI SDK.

## What This Demonstrates

A Next.js chat interface with three governed tools:
- `search_docs` — Allowed instantly (safe read operation)
- `send_email` — Requires human approval (check the dashboard!)
- `export_data` — Blocked by policy (data protection)

## Setup

You'll need an OpenAI API key for the chat model:
```bash
cp .env.example .env
# Edit .env to add your OPENAI_API_KEY
```

## Run

```bash
npm start
```

Open http://localhost:3000 and try:
1. "Search for refund policy" → instant result
2. "Send an email to the customer" → check dashboard to approve
3. "Export all customer data" → blocked

## Approve Requests

When the agent tries to send an email, approve it at:
https://app.sidclaw.com/dashboard/approvals

## View Traces

See the complete audit trail at:
https://app.sidclaw.com/dashboard/audit
