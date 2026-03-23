#!/usr/bin/env python3
"""
{{projectName}} — Governed AI Agent (OpenAI Agents)

This agent has 3 tools, each demonstrating a different governance outcome:
  search_docs  → Allowed instantly (safe read operation)
  send_email   → Requires human approval (check the dashboard!)
  export_data  → Blocked by policy (data protection)

Run: python main.py
Dashboard: https://app.sidclaw.com/dashboard/approvals
"""

import asyncio
import os
from dotenv import load_dotenv
from sidclaw import AsyncSidClaw
from sidclaw.middleware.openai_agents import govern_function_tool
from tools import TOOLS, HANDLERS

load_dotenv()

client = AsyncSidClaw(
    api_key=os.environ["SIDCLAW_API_KEY"],
    base_url=os.environ.get("SIDCLAW_API_URL", "https://api.sidclaw.com"),
    agent_id=os.environ["SIDCLAW_AGENT_ID"],
)

# Wrap each tool with governance
governed = []
for tool_def, handler in zip(TOOLS, HANDLERS):
    gov_tool, gov_handler = govern_function_tool(
        tool_def,
        handler,
        client=client,
        data_classification="confidential",
    )
    governed.append((gov_tool, gov_handler))


async def main():
    print("{{projectName}} — Governed AI Agent (OpenAI Agents)")
    print("=" * 50)
    print()

    labels = [
        ("1. Searching knowledge base (should be ALLOWED)...", {"query": "refund policy"}),
        ("2. Sending customer email (should REQUIRE APPROVAL)...", {"message": "Send follow-up to customer about their refund request"}),
        ("3. Exporting customer data (should be DENIED)...", {"query": "Export all customer records to CSV"}),
    ]

    for i, ((label, args), (_, handler)) in enumerate(zip(labels, governed)):
        print(label)
        if i == 1:
            print("   Check your dashboard: https://app.sidclaw.com/dashboard/approvals")
            print("   Approve the request, then the tool will execute.")
        try:
            result = await handler(args)
            print(f"   Result: {result}")
        except Exception as e:
            if i == 1:
                print(f"   Pending: {e}")
                print("   -> Go to the dashboard and approve this request!")
            else:
                print(f"   Blocked: {e}")
        print()

    print("=" * 50)
    print("Done! Check the trace viewer: https://app.sidclaw.com/dashboard/audit")


if __name__ == "__main__":
    asyncio.run(main())
