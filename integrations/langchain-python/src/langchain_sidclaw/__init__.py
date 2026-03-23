"""LangChain integration for SidClaw governance.

Provides tool governance wrappers that evaluate every LangChain tool call
against SidClaw policies before execution.

Usage:
    from langchain_sidclaw import govern_tools, GovernanceCallbackHandler
    from sidclaw import SidClaw

    client = SidClaw(api_key="ai_...", base_url="https://api.sidclaw.com", agent_id="agent-001")
    governed = govern_tools(my_tools, client=client, data_classification="confidential")

    # Or use the callback handler for logging (non-blocking):
    handler = GovernanceCallbackHandler(client=client)
"""

from sidclaw.middleware.langchain import govern_tool, govern_tools

from ._callbacks import GovernanceCallbackHandler
from ._version import __version__

__all__ = [
    "govern_tool",
    "govern_tools",
    "GovernanceCallbackHandler",
    "__version__",
]
