"""Basic LangChain tool governance example."""
from langchain_sidclaw import govern_tools
from sidclaw import SidClaw

# Initialize SidClaw client
client = SidClaw(
    api_key="ai_your_key_here",
    agent_id="your-agent-id",
)

# Wrap your LangChain tools with governance
# governed = govern_tools(my_tools, client=client, data_classification="confidential")
# agent = create_tool_calling_agent(llm, governed, prompt)

print("langchain-sidclaw basic example — install langchain to run")
