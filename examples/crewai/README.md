# CrewAI × SidClaw Governance

Run a CrewAI crew where every tool call is governed by SidClaw.

## Setup

```bash
cp .env.example .env      # fill in keys
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python crew.py
```

## What this shows

A two-agent crew — a researcher and a reporter — where the reporter's
`send_email` tool is wrapped with SidClaw governance. The policy decides
whether the email actually goes out, pauses for human approval if needed,
and records the decision to the audit trail.
