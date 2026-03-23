# SidClaw Governance for GitHub

**The approval and accountability layer for agentic AI.**

SidClaw Governance brings policy evaluation, human-in-the-loop approval, and tamper-evident audit trails to AI agents running in GitHub Actions. Every agent action is evaluated against your organization's policies before it executes --- and high-risk operations require explicit human approval through GitHub check runs.

## What It Does

When an AI agent in your CI/CD pipeline attempts a sensitive operation (deploying to production, modifying infrastructure, accessing customer data), SidClaw intercepts the action and:

1. **Evaluates** the action against your policy rules (allow, deny, or require approval)
2. **Creates a GitHub check run** if human approval is required, with full context: agent identity, action details, risk classification, and policy match
3. **Blocks the workflow** until a designated reviewer approves or denies via the check run interface
4. **Records an audit trail** with hash-chained integrity --- every decision is traceable and tamper-evident

Actions that match an `allow` policy proceed immediately. Actions that match a `deny` policy fail the workflow. Actions that match a `require_approval` policy create a check run and wait.

## How It Works

```
GitHub Actions Workflow
        |
        v
sidclawhq/governance-action@v1
        |
        v
POST /api/v1/evaluate  ───>  SidClaw Policy Engine
        |                           |
        |                    ┌──────┴──────┐
        |                    |             |
        v                    v             v
   allow: pass         require_approval   deny: fail
                             |
                             v
                    GitHub Check Run
                    (approve / deny)
                             |
                      ┌──────┴──────┐
                      |             |
                      v             v
                   approved      denied
                   continue     fail workflow
```

## Installation

### 1. Install the GitHub App

Install **SidClaw Governance** from the [GitHub Marketplace](https://github.com/marketplace/sidclaw-governance) on your organization or repository. Grant the requested permissions (checks, pull requests, actions, statuses, metadata).

### 2. Create a SidClaw account

Sign up at [app.sidclaw.com](https://app.sidclaw.com) and register your AI agent in the agent registry. Define policy rules that match the actions your agent performs.

### 3. Add your API key as a repository secret

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add:

- `SIDCLAW_API_KEY` --- your SidClaw API key (generate one at **Dashboard > Settings > API Keys**)

### 4. Add the governance step to your workflow

```yaml
name: AI Agent Deploy

on:
  workflow_dispatch:
    inputs:
      target:
        description: "Deployment target"
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Evaluate deployment with SidClaw
        id: governance
        uses: sidclawhq/governance-action@v1
        with:
          api-key: ${{ secrets.SIDCLAW_API_KEY }}
          agent-id: agent_deploy_bot
          action: deploy
          resource-type: environment
          resource-id: ${{ inputs.target }}
          parameters: |
            {
              "environment": "${{ inputs.target }}",
              "commit": "${{ github.sha }}",
              "triggered_by": "${{ github.actor }}"
            }
          wait-for-approval: true
          timeout: 600

      - name: Deploy
        if: steps.governance.outputs.decision == 'allow'
        run: ./scripts/deploy.sh ${{ inputs.target }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | Yes | --- | SidClaw API key. Use a repository secret. |
| `agent-id` | Yes | --- | The registered agent identifier in SidClaw. |
| `action` | Yes | --- | The action being performed (e.g., `deploy`, `modify`, `delete`). |
| `resource-type` | No | `""` | Type of resource being acted on (e.g., `environment`, `database`, `service`). |
| `resource-id` | No | `""` | Identifier of the specific resource. |
| `parameters` | No | `"{}"` | JSON string of additional context passed to the policy engine. |
| `wait-for-approval` | No | `true` | Whether to block and wait when approval is required. Set `false` for fire-and-forget evaluation. |
| `timeout` | No | `600` | Maximum seconds to wait for an approval decision. The step fails if the timeout is reached without a decision. |

## Outputs

| Output | Description |
|---|---|
| `decision` | The policy decision: `allow`, `deny`, or `pending`. |
| `trace-id` | The SidClaw audit trace ID for this evaluation. Use this to look up the full audit trail. |
| `approval-id` | The approval request ID, if approval was required. Empty otherwise. |
| `reason` | Human-readable explanation of the decision (e.g., matched policy name). |

## Check Run Experience

When an action requires human approval, SidClaw creates a GitHub check run on the commit:

- **Check name**: `SidClaw Governance: {action} on {resource-type}/{resource-id}`
- **Status**: `in_progress` while waiting for a decision
- **Summary**: Displays the agent identity, action details, risk level, matched policy, and any parameters
- **Actions**: Two buttons appear on the check run --- **Approve** and **Deny**
- **Result**: The check completes as `success` (approved) or `failure` (denied), and the workflow step unblocks accordingly

Reviewers see the full evaluation context directly in the GitHub interface. No context switching to an external tool is required for simple approve/deny decisions. For more complex reviews, the check run summary links to the full approval page in the SidClaw dashboard.

## Permissions

The GitHub App requests these permissions:

| Permission | Access | Purpose |
|---|---|---|
| **Checks** | Write | Create and update check runs for approval gates |
| **Pull requests** | Read | Read PR context for policy evaluation |
| **Actions** | Read | Monitor workflow run status |
| **Statuses** | Write | Set commit statuses reflecting governance decisions |
| **Metadata** | Read | Access repository metadata (required by GitHub for all apps) |

The app subscribes to `check_suite`, `check_run`, and `workflow_run` events to manage the approval lifecycle.

## Repository Configuration

Optionally, add a `.sidclaw.yml` file to your repository root to configure default behavior:

```yaml
# .sidclaw.yml
agent_id: agent_deploy_bot
default_resource_type: environment
notifications:
  slack_channel: "#deployments"
```

This file is read by the GitHub App when processing webhook events. It does not replace workflow-level configuration but provides defaults for repository-wide settings.

## Dashboard Integration

All governance evaluations, approval decisions, and audit trails are visible in the SidClaw dashboard:

- **Approvals**: [app.sidclaw.com/dashboard/approvals](https://app.sidclaw.com/dashboard/approvals)
- **Audit Traces**: [app.sidclaw.com/dashboard/audit](https://app.sidclaw.com/dashboard/audit)
- **Agents**: [app.sidclaw.com/dashboard/agents](https://app.sidclaw.com/dashboard/agents)
- **Policies**: [app.sidclaw.com/dashboard/policies](https://app.sidclaw.com/dashboard/policies)

## Documentation

Full platform documentation is available at [docs.sidclaw.com](https://docs.sidclaw.com):

- [Quickstart](https://docs.sidclaw.com/docs/quickstart)
- [Policy Engine](https://docs.sidclaw.com/docs/concepts/policies)
- [Approval Workflow](https://docs.sidclaw.com/docs/concepts/approvals)
- [Audit Trails](https://docs.sidclaw.com/docs/concepts/audit)
- [SDK Reference](https://docs.sidclaw.com/docs/sdk/client)

## Self-Hosting

SidClaw can be self-hosted for organizations that require on-premises deployment. The GitHub App webhook URL and OAuth credentials are configurable via environment variables:

```bash
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem
GITHUB_APP_WEBHOOK_SECRET=your-webhook-secret
GITHUB_APP_CLIENT_ID=your-client-id
GITHUB_APP_CLIENT_SECRET=your-client-secret
```

Register a custom GitHub App in your organization's settings, point the webhook URL to your self-hosted API instance, and configure the same permissions and events listed in `app.yml`.

See the [self-hosting guide](https://docs.sidclaw.com/docs/platform/self-hosting) for full instructions.

## License

The SidClaw GitHub App and governance action are part of the SidClaw platform, licensed under FSL-1.1 with Apache 2.0 conversion. The SidClaw SDK (`@sidclaw/sdk`) is Apache 2.0.
