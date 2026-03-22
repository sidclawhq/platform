# Atlas Financial — Interactive Demo

AI customer support agent for a fictional fintech company. Demonstrates SidClaw governance with:
- **Allow:** Knowledge base search, account lookup
- **Approval Required:** Customer email sending, case updates
- **Deny:** PII export, account closure

## Run Locally

```bash
# Prerequisites: API running on port 4000, database seeded
npm run dev  # Starts on port 3003
```

Open http://localhost:3003

## Environment Variables

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<key from deployment/.env.development>
ANTHROPIC_API_KEY=<your Anthropic API key>
```

## Production

Deployed at https://demo.sidclaw.com
