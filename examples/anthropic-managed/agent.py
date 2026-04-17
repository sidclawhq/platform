"""Anthropic Claude Managed Agents × SidClaw governance.

Attaches the `@sidclaw/mcp-tools` server as a remote MCP so the agent can
call sidclaw_evaluate / sidclaw_approve / sidclaw_record directly.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

import anthropic


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing env var: {name}")
    return value


client = anthropic.Anthropic(api_key=_require("ANTHROPIC_API_KEY"))

# Claude Managed Agents support remote MCP servers. Point to the SidClaw
# instance with the governance MCP HTTP transport (/api/mcp). Headers carry
# auth.
sidclaw_base_url = os.environ.get("SIDCLAW_BASE_URL", "https://api.sidclaw.com").rstrip("/")

response = client.beta.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system=(
        "You are a governed customer-support agent. Before any action that "
        "sends data externally, call sidclaw_evaluate with the operation and "
        "risk details. Respect the decision."
    ),
    mcp_servers=[
        {
            "type": "url",
            "url": f"{sidclaw_base_url}/api/mcp",
            "name": "sidclaw",
            "headers": {"x-api-key": _require("SIDCLAW_API_KEY")},
        },
    ],
    messages=[
        {
            "role": "user",
            "content": (
                "A customer named Alice asked us to close their account. "
                "Send them a polite goodbye email at alice@example.com "
                "and record the action."
            ),
        },
    ],
)

print("Agent response:")
for block in response.content:
    if getattr(block, "type", None) == "text":
        print(block.text)
