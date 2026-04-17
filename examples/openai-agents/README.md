# OpenAI Agents SDK × SidClaw Governance

Tool wrapping example using the official OpenAI Agents SDK (`openai-agents`)
with SidClaw's `governOpenAITool` middleware. Each tool the agent calls is
evaluated by your SidClaw policy engine before executing.

## Requirements

- Node 18+
- An OpenAI API key (`OPENAI_API_KEY`)
- A SidClaw instance (`SIDCLAW_BASE_URL`, `SIDCLAW_API_KEY`)
- An agent registered in SidClaw (`SIDCLAW_AGENT_ID`)

## Install

```bash
cp .env.example .env      # fill in keys
npm install
npm start
```

## What this shows

Three tools with increasing risk:

| Tool | Policy suggestion |
|------|-------------------|
| `search_knowledge_base` | allow |
| `send_email` | approval_required |
| `delete_account` | deny |

When the agent wants to `send_email`, SidClaw holds the action until a human
approves from the dashboard. When it wants to `delete_account`, the policy
blocks it outright.
