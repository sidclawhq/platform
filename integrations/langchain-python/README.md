# langchain-sidclaw

[![PyPI version](https://img.shields.io/pypi/v/langchain-sidclaw)](https://pypi.org/project/langchain-sidclaw/)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**SidClaw governance integration for LangChain** — policy evaluation, human approval, and audit trails for AI agent tools.

## What it does

Wraps your LangChain tools with governance. Before any tool executes:
- **Allowed** actions run immediately
- **High-risk** actions require human approval (reviewer gets a notification)
- **Prohibited** actions are blocked before execution
- Every decision is logged with a tamper-proof audit trail

## Installation

```bash
pip install langchain-sidclaw
```

## Quick Start

### Option 1: Enforce policies (recommended)

```python
from langchain_sidclaw import govern_tools
from sidclaw import SidClaw

client = SidClaw(
    api_key="ai_...",
    base_url="https://api.sidclaw.com",
    agent_id="your-agent-id",
)

# Wrap your existing tools — no changes to tool code
governed = govern_tools(my_tools, client=client, data_classification="confidential")

# Use governed tools in your agent
agent = create_tool_calling_agent(llm, governed, prompt)
```

### Option 2: Monitor only (audit without blocking)

```python
from langchain_sidclaw import GovernanceCallbackHandler

handler = GovernanceCallbackHandler(client=client)
agent = create_tool_calling_agent(llm, tools, prompt, callbacks=[handler])
# Every tool call is logged to SidClaw, but nothing is blocked
```

## Configure policies

Create policies in the [SidClaw dashboard](https://app.sidclaw.com) or via API. Example policy effects:

| Policy Effect | Behavior |
|---------------|----------|
| `allow` | Tool executes immediately |
| `approval_required` | Blocks until a human approves in the dashboard |
| `deny` | Raises `ActionDeniedError`, tool never executes |

## Links

- [SidClaw Website](https://sidclaw.com)
- [Documentation](https://docs.sidclaw.com/docs/integrations/langchain)
- [Dashboard](https://app.sidclaw.com)
- [GitHub](https://github.com/sidclawhq/platform)
