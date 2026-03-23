"""Multi-tool agent with governance and monitoring."""
from langchain_sidclaw import govern_tools, GovernanceCallbackHandler
from sidclaw import SidClaw

client = SidClaw(
    api_key="ai_your_key_here",
    agent_id="your-agent-id",
)

# Option 1: Enforce governance on tools
# governed = govern_tools(my_tools, client=client, data_classification="confidential")

# Option 2: Monitor-only via callback handler
# handler = GovernanceCallbackHandler(client=client)
# agent = create_tool_calling_agent(llm, tools, prompt, callbacks=[handler])

print("langchain-sidclaw multi-tool example — install langchain to run")
