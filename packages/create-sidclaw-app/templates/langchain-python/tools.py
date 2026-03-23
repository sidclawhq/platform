"""Demo tools for the governed agent."""
from langchain_core.tools import tool

@tool
def search_docs(query: str) -> str:
    """Search the internal knowledge base for documentation and policies."""
    # Mock implementation
    return f"Found 3 results for '{query}': 1. Refund Policy v2.1, 2. Returns FAQ, 3. Customer Guide"

@tool
def send_email(message: str) -> str:
    """Send an email to a customer. Requires governance approval."""
    # Mock implementation — in production this would actually send
    return f"Email sent: {message[:100]}"

@tool
def export_data(query: str) -> str:
    """Export customer data records. Blocked by data protection policy."""
    # This should never execute — the policy blocks it
    return f"Exported data for: {query}"
