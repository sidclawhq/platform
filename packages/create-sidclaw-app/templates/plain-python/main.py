#!/usr/bin/env python3
"""
{{projectName}} — Governed AI Agent

This agent has 3 functions, each demonstrating a different governance outcome:
  search_docs  → Allowed instantly (safe read operation)
  send_email   → Requires human approval (check the dashboard!)
  export_data  → Blocked by policy (data protection)

Run: python main.py
Dashboard: https://app.sidclaw.com/dashboard/approvals
"""

import os
from dotenv import load_dotenv
from sidclaw import SidClaw
from sidclaw.middleware import with_governance, GovernanceConfig

load_dotenv()

client = SidClaw(
    api_key=os.environ["SIDCLAW_API_KEY"],
    base_url=os.environ.get("SIDCLAW_API_URL", "https://api.sidclaw.com"),
    agent_id=os.environ["SIDCLAW_AGENT_ID"],
)


@with_governance(client, GovernanceConfig(
    operation="search_docs",
    target_integration="knowledge_base",
    resource_scope="docs",
    data_classification="internal",
))
def search_docs(query: str) -> str:
    """Search the internal knowledge base."""
    return f"Found 3 results for '{query}': 1. Refund Policy v2.1, 2. Returns FAQ, 3. Customer Guide"


@with_governance(client, GovernanceConfig(
    operation="send_email",
    target_integration="email_service",
    resource_scope="emails",
    data_classification="confidential",
))
def send_email(message: str) -> str:
    """Send an email to a customer."""
    return f"Email sent: {message[:100]}"


@with_governance(client, GovernanceConfig(
    operation="export_data",
    target_integration="data_store",
    resource_scope="records",
    data_classification="restricted",
))
def export_data(query: str) -> str:
    """Export customer data records."""
    return f"Exported data for: {query}"


def main():
    print("{{projectName}} — Governed AI Agent")
    print("=" * 50)
    print()

    # Tool 1: Allowed
    print("1. Searching knowledge base (should be ALLOWED)...")
    try:
        result = search_docs("refund policy")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"   Error: {e}")

    print()

    # Tool 2: Requires Approval
    print("2. Sending customer email (should REQUIRE APPROVAL)...")
    print("   Check your dashboard: https://app.sidclaw.com/dashboard/approvals")
    print("   Approve the request, then the function will execute.")
    try:
        result = send_email("Send follow-up to customer about their refund request")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"   Pending: {e}")
        print("   -> Go to the dashboard and approve this request!")

    print()

    # Tool 3: Denied
    print("3. Exporting customer data (should be DENIED)...")
    try:
        result = export_data("Export all customer records to CSV")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"   Blocked: {e}")

    print()
    print("=" * 50)
    print("Done! Check the trace viewer: https://app.sidclaw.com/dashboard/audit")


if __name__ == "__main__":
    main()
