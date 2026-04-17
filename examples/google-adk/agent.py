"""Google ADK × SidClaw — minimal governed tool call."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from google.adk import Agent, LlmAgent
from google.adk.tools import FunctionTool
from sidclaw import SidClaw
from sidclaw.middleware.google_adk import govern_google_adk_tool


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


def send_slack_message_raw(channel: str, text: str) -> dict:
    """Post a message to a Slack channel."""
    print(f"[mock slack] #{channel}: {text}")
    return {"ok": True, "channel": channel, "text": text}


send_slack_message = govern_google_adk_tool(
    client,
    FunctionTool(send_slack_message_raw),
    operation="send_slack_message",
    target_integration="slack",
    resource_scope="channels.public",
    data_classification="internal",
)


agent: LlmAgent = LlmAgent(
    model="gemini-2.0-flash",
    name="ops_assistant",
    description="A DevOps assistant that can notify a Slack channel.",
    instruction=(
        "You are an ops assistant. When the user reports an incident, "
        "summarise it and post to the #incidents channel."
    ),
    tools=[send_slack_message],
)


if __name__ == "__main__":
    _require("GOOGLE_API_KEY")
    # ADK convention: agents are run via `google-adk run` or custom driver.
    # Here we just print the tool schema to prove the wrapping succeeded.
    print("Tools:", [t.name for t in agent.tools])
    print("Run with: google-adk run --agent agent:agent --prompt 'Incident X happened'")
