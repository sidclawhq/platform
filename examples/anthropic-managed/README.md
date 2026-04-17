# Anthropic Claude Managed Agents × SidClaw Governance

Uses Anthropic's Claude Managed Agents feature with the `@sidclaw/mcp-tools`
MCP server attached. The agent gets governance tools (evaluate, record,
approve, policies) that it can call directly to self-govern.

## Setup

```bash
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent.py
```
