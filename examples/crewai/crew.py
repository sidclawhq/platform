"""CrewAI × SidClaw — minimal governed crew.

Research + report crew where the send_email tool is policy-checked before
every invocation. Uses the `sidclaw.middleware.crewai` helper.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from crewai import Agent, Task, Crew
from crewai.tools import tool
from sidclaw import SidClaw
from sidclaw.middleware.crewai import govern_crewai_tool


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


@tool("search_web")
def search_web(query: str) -> str:
    """Search the public web for the given query."""
    return f"[mock] Top results for '{query}': article A, article B, article C"


@tool("send_email")
def send_email_raw(to: str, subject: str, body: str) -> str:
    """Send an email to the given recipient."""
    print(f"[mock email_service] to={to} subject={subject}")
    return f"Email sent to {to}"


send_email = govern_crewai_tool(
    client,
    send_email_raw,
    operation="send_email",
    target_integration="email_service",
    resource_scope="customer_emails",
    data_classification="confidential",
)


researcher = Agent(
    role="Research Analyst",
    goal="Find credible sources and summarize findings",
    backstory="You are a detail-oriented analyst who cites sources.",
    tools=[search_web],
    verbose=True,
)


reporter = Agent(
    role="Customer Success Reporter",
    goal="Turn research into a customer email",
    backstory="You communicate clearly and concisely.",
    tools=[send_email],
    verbose=True,
)


research_task = Task(
    description="Research the latest SEC AI governance guidance and produce a 5-bullet brief.",
    expected_output="Markdown brief with 5 bullets + 3 source URLs.",
    agent=researcher,
)


send_task = Task(
    description=(
        "Send the brief to compliance@example.com. Subject: "
        "'Weekly SEC AI governance brief'. Body: the markdown from the research task."
    ),
    expected_output="Confirmation the email was sent (or blocked by governance).",
    agent=reporter,
)


if __name__ == "__main__":
    _require("OPENAI_API_KEY")
    crew = Crew(agents=[researcher, reporter], tasks=[research_task, send_task], verbose=True)
    result = crew.kickoff()
    print("\n--- Crew result ---")
    print(result)
