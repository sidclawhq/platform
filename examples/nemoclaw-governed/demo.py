#!/usr/bin/env python3
"""
NemoClaw + SidClaw Governance Demo (Python)

Demonstrates governing tool execution inside an NVIDIA NemoClaw sandbox
using SidClaw policies. Three tools, three different outcomes:

  - search_docs   -> allowed (internal docs, safe read operation)
  - send_email    -> approval_required (outbound communication, needs review)
  - export_data   -> denied (restricted data, prohibited by policy)

Usage:
  SIDCLAW_API_KEY=<key> SIDCLAW_AGENT_ID=<id> python demo.py
"""
import os
import sys

from sidclaw import SidClaw
from sidclaw._errors import ActionDeniedError
from sidclaw.middleware.nemoclaw import (
    NemoClawGovernanceConfig,
    govern_nemoclaw_tools,
)


API_KEY = os.environ.get("SIDCLAW_API_KEY")
API_URL = os.environ.get("SIDCLAW_API_URL", "https://api.sidclaw.com")
AGENT_ID = os.environ.get("SIDCLAW_AGENT_ID")

if not API_KEY:
    print("Error: SIDCLAW_API_KEY environment variable is required.", file=sys.stderr)
    print("Find it in deployment/.env.development (created by prisma db seed).", file=sys.stderr)
    sys.exit(1)

if not AGENT_ID:
    print("Error: SIDCLAW_AGENT_ID environment variable is required.", file=sys.stderr)
    print('Run "npm run seed" first and set the agent ID it prints.', file=sys.stderr)
    sys.exit(1)

SEPARATOR = "\u2500" * 60


# ---------------------------------------------------------------------------
# Mock NemoClaw tools (simulating sandbox tool execution)
# ---------------------------------------------------------------------------


class MockTool:
    """Simple duck-typed tool matching NemoClaw's tool interface."""

    def __init__(self, name: str, description: str, handler):
        self.name = name
        self.description = description
        self._handler = handler

    def execute(self, **kwargs):
        return self._handler(**kwargs)


search_docs_tool = MockTool(
    name="search_docs",
    description="Search internal documentation",
    handler=lambda query="": f'Found 3 results for "{query}": [Getting Started, API Reference, Troubleshooting]',
)

send_email_tool = MockTool(
    name="send_email",
    description="Send an email to a recipient",
    handler=lambda to="", subject="", body="": f'Email sent to {to}: "{subject}"',
)

export_data_tool = MockTool(
    name="export_data",
    description="Export user data in bulk",
    handler=lambda format="json", userId="": f"Exported data for {userId} as {format}",
)


# ---------------------------------------------------------------------------
# Main demo
# ---------------------------------------------------------------------------


def main():
    client = SidClaw(api_key=API_KEY, agent_id=AGENT_ID, api_url=API_URL)

    config = NemoClawGovernanceConfig(
        sandbox_name="demo-sandbox",
        data_classification={
            "search_docs": "internal",
            "send_email": "confidential",
            "export_data": "restricted",
        },
    )

    governed_tools = govern_nemoclaw_tools(client, [search_docs_tool, send_email_tool, export_data_tool], config)

    tool_calls = [
        {
            "tool_name": "search_docs",
            "args": {"query": "deployment guide"},
            "description": "Search internal docs (should be ALLOWED)",
        },
        {
            "tool_name": "send_email",
            "args": {"to": "alice@example.com", "subject": "Follow-up", "body": "Hello from the sandbox agent!"},
            "description": "Send email (should require APPROVAL)",
        },
        {
            "tool_name": "export_data",
            "args": {"format": "csv", "userId": "user-42"},
            "description": "Export user data (should be DENIED)",
        },
    ]

    print(SEPARATOR)
    print("  NemoClaw + SidClaw Governance Demo (Python)")
    print(SEPARATOR)
    print(f"  API:      {API_URL}")
    print(f"  Agent:    {AGENT_ID}")
    print(f"  Sandbox:  demo-sandbox")
    print()

    for call in tool_calls:
        print(SEPARATOR)
        print(f"  Tool: {call['tool_name']}")
        print(f"  {call['description']}")
        print(f"  Input: {call['args']}")
        print()

        tool = next((t for t in governed_tools if t.name == call["tool_name"]), None)
        if not tool:
            print(f"  Tool not found: {call['tool_name']}")
            continue

        try:
            print("  Evaluating governance policy...")
            result = tool.execute(**call["args"])
            print(f"  ALLOWED - Result: {result}")
        except ActionDeniedError as e:
            reason = str(e)
            is_approval = "Approval required" in reason
            if is_approval:
                print(f"  APPROVAL REQUIRED - {reason}")
                print(f"  Trace ID: {e.trace_id}")
                dashboard_url = API_URL.replace("api.", "app.")
                print(f"  Review in dashboard: {dashboard_url}/dashboard/approvals")
            else:
                print(f"  DENIED - {reason}")
                print(f"  Trace ID: {e.trace_id}")

        print()

    print(SEPARATOR)
    print("  View all traces in the dashboard:")
    dashboard_url = API_URL.replace("api.", "app.")
    print(f"  {dashboard_url}/dashboard/audit")
    print(SEPARATOR)


if __name__ == "__main__":
    main()
