"""Pydantic AI × SidClaw — minimal governed agent."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

from pydantic_ai import Agent, RunContext
from sidclaw import SidClaw
from sidclaw.middleware.pydantic_ai import governance_dependency


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing env var: {name}")
    return value


client = SidClaw(
    api_key=_require("SIDCLAW_API_KEY"),
    agent_id=_require("SIDCLAW_AGENT_ID"),
    api_url=os.environ.get("SIDCLAW_BASE_URL", "https://api.sidclaw.com"),
)


@dataclass
class Deps:
    db: dict[str, dict]
    governance: object


agent: Agent[Deps, str] = Agent(
    "openai:gpt-4o-mini",
    deps_type=Deps,
    system_prompt=(
        "You are a helpful customer support agent. Use tools to look up "
        "accounts and send emails. Be concise."
    ),
)


@agent.tool
async def lookup_account(ctx: RunContext[Deps], account_id: str) -> str:
    """Look up an account record. Read-only."""
    return str(ctx.deps.db.get(account_id, {"error": "not found"}))


@agent.tool
async def send_email(
    ctx: RunContext[Deps], to: str, subject: str, body: str
) -> str:
    """Send an email — governed by SidClaw."""
    await governance_dependency(
        client,
        operation="send_email",
        target_integration="email_service",
        resource_scope="customer_emails",
        data_classification="confidential",
    )(ctx.run_ctx, {"to": to, "subject": subject, "body": body})
    print(f"[mock email_service] to={to} subject={subject}")
    return f"Email sent to {to}"


if __name__ == "__main__":
    _require("OPENAI_API_KEY")
    deps = Deps(
        db={
            "acct-123": {"id": "acct-123", "name": "Acme Corp", "status": "active"},
        },
        governance=client,
    )
    result = agent.run_sync(
        "Look up acct-123 and send them a brief 'hello' check-in email at hi@acme.example.",
        deps=deps,
    )
    print("Agent output:", result.data)
