#!/usr/bin/env python3
"""
{{projectName}} — Governed AI Agent

This agent has 3 tools, each demonstrating a different governance outcome:
  search_docs  → Allowed instantly (safe read operation)
  send_email   → Requires human approval (check the dashboard!)
  export_data  → Blocked by policy (data protection)

Run: python main.py
Dashboard: https://app.sidclaw.com/dashboard/approvals
"""

import os
from dotenv import load_dotenv
from sidclaw import SidClaw
from sidclaw.middleware.langchain import govern_tools
from tools import search_docs, send_email, export_data

load_dotenv()

agent_id = os.environ.get("SIDCLAW_AGENT_ID", "")
if not agent_id:
    print("Error: SIDCLAW_AGENT_ID is not set in .env")
    print("  1. Go to https://app.sidclaw.com/dashboard/agents")
    print("  2. Create an agent")
    print("  3. Copy the agent ID into .env as SIDCLAW_AGENT_ID")
    exit(1)

client = SidClaw(
    api_key=os.environ["SIDCLAW_API_KEY"],
    base_url=os.environ.get("SIDCLAW_API_URL", "https://api.sidclaw.com"),
    agent_id=agent_id,
)

# Wrap tools with governance — no changes to tool code
raw_tools = [search_docs, send_email, export_data]
governed_tools = govern_tools(raw_tools, client=client, data_classification="confidential")

def main():
    print("{{projectName}} — Governed AI Agent")
    print("=" * 50)
    print()

    # Tool 1: Allowed
    print("1. Searching knowledge base (should be ALLOWED)...")
    try:
        result = governed_tools[0].invoke("refund policy")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"   Error: {e}")

    print()

    # Tool 2: Requires Approval
    print("2. Sending customer email (should REQUIRE APPROVAL)...")
    print("   Check your dashboard: https://app.sidclaw.com/dashboard/approvals")
    print("   Approve the request, then the tool will execute.")
    try:
        result = governed_tools[1].invoke("Send follow-up to customer about their refund request")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"   Pending: {e}")
        print("   -> Go to the dashboard and approve this request!")

    print()

    # Tool 3: Denied
    print("3. Exporting customer data (should be DENIED)...")
    try:
        result = governed_tools[2].invoke("Export all customer records to CSV")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"   Blocked: {e}")

    print()
    print("=" * 50)
    print("Done! Check the trace viewer: https://app.sidclaw.com/dashboard/audit")

if __name__ == "__main__":
    main()
