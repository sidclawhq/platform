"""Demo tools for the governed agent (OpenAI Agents format)."""


async def search_docs_handler(args: dict) -> str:
    """Search the internal knowledge base for documentation and policies."""
    query = args.get("query", "")
    return f"Found 3 results for '{query}': 1. Refund Policy v2.1, 2. Returns FAQ, 3. Customer Guide"


async def send_email_handler(args: dict) -> str:
    """Send an email to a customer. Requires governance approval."""
    message = args.get("message", "")
    return f"Email sent: {message[:100]}"


async def export_data_handler(args: dict) -> str:
    """Export customer data records. Blocked by data protection policy."""
    query = args.get("query", "")
    return f"Exported data for: {query}"


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_docs",
            "description": "Search the internal knowledge base for documentation and policies.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Search query"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send an email to a customer. Requires governance approval.",
            "parameters": {
                "type": "object",
                "properties": {"message": {"type": "string", "description": "Email message"}},
                "required": ["message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "export_data",
            "description": "Export customer data records. Blocked by data protection policy.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Export query"}},
                "required": ["query"],
            },
        },
    },
]

HANDLERS = [search_docs_handler, send_email_handler, export_data_handler]
