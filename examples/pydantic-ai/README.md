# Pydantic AI × SidClaw Governance

Pydantic AI agent where a tool is gated by SidClaw policies via the
`sidclaw.middleware.pydantic_ai` integration.

## Setup

```bash
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py
```
