# SidClaw Governance Service for Google ADK

Policy evaluation, human-in-the-loop approval, and tamper-proof audit trails for Google ADK agent tool calls.

## What It Does

The `SidClawGovernanceService` integrates with ADK's `before_tool_callback` and `after_tool_callback` hooks:

1. **Before tool execution** — evaluates the tool call against SidClaw policies
   - **Allow** — tool proceeds immediately
   - **Deny** — returns an error, blocking execution
   - **Approval required** — waits for a human reviewer to approve via dashboard, Slack, Teams, or Telegram
2. **After tool execution** — records the outcome in SidClaw's hash-chain audit trail

## Usage

```python
from sidclaw import AsyncSidClaw
from google.adk_community.governance import (
    SidClawGovernanceConfig,
    SidClawGovernanceService,
)
from google.adk.agents import Agent

# 1. Configure SidClaw client
client = AsyncSidClaw(
    api_key="ai_your_api_key",
    base_url="https://api.sidclaw.com",
    agent_id="my-adk-agent",
)

# 2. Create governance service
governance = SidClawGovernanceService(
    client=client,
    config=SidClawGovernanceConfig(
        default_classification="internal",
        tool_classifications={
            "delete_records": "restricted",
            "send_email": "confidential",
        },
    ),
)

# 3. Attach to agent
agent = Agent(
    name="my-agent",
    model="gemini-2.5-flash",
    instruction="You are a helpful assistant.",
    tools=[search_docs, query_database, delete_records],
    before_tool_callback=governance.before_tool_callback,
    after_tool_callback=governance.after_tool_callback,
)
```

## Configuration

| Field | Default | Description |
|-------|---------|-------------|
| `default_classification` | `"internal"` | Default data classification for all tools |
| `tool_classifications` | `{}` | Per-tool overrides (`{"tool_name": "restricted"}`) |
| `resource_scope` | `"google_adk"` | Resource scope for policy matching |
| `wait_for_approval` | `True` | Wait for human approval or reject immediately |
| `approval_timeout_seconds` | `300.0` | Max seconds to wait for approval |

## Requirements

- Python 3.9+
- `sidclaw` >= 0.1.2 ([PyPI](https://pypi.org/project/sidclaw/))
- `google-adk` ([PyPI](https://pypi.org/project/google-adk/))

## How to Submit (for maintainers)

This integration is ready to be submitted as a PR to [google/adk-python-community](https://github.com/google/adk-python-community). Copy these files into the fork:

```
src/google/adk_community/governance/__init__.py
src/google/adk_community/governance/sidclaw_governance.py
tests/unittests/governance/__init__.py
tests/unittests/governance/test_sidclaw_governance.py
```

Add `"sidclaw>=0.1.2"` to the `dependencies` list in `pyproject.toml`.

Reference: Google maintainer @rohityan invited this submission in [PR #5081](https://github.com/google/adk-python/pull/5081).

## Links

- [SidClaw Documentation](https://docs.sidclaw.com)
- [Google ADK Integrations](https://google.github.io/adk-docs/integrations/)
- [SidClaw Python SDK](https://pypi.org/project/sidclaw/)
