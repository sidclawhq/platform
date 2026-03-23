# SidClaw Governance Check — GitHub Action

Evaluate AI agent actions against [SidClaw](https://sidclaw.com) governance policies directly in your GitHub Actions workflows. This action calls the SidClaw policy engine before high-risk operations proceed, blocking denied actions and optionally waiting for human approval.

## How It Works

1. Your workflow triggers this action before a sensitive operation (deploy, merge, database migration, etc.).
2. The action sends the operation details to the SidClaw API for policy evaluation.
3. Based on your configured policies, the API returns one of three decisions:
   - **allow** — The workflow continues immediately.
   - **deny** — The workflow step fails with the policy reason.
   - **approval_required** — The action creates a GitHub Check Run with Approve/Deny buttons, then polls the SidClaw API until a human reviewer decides (or the timeout expires).

## Quick Start

```yaml
name: Deploy with Governance

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      checks: write
    steps:
      - uses: actions/checkout@v4

      - name: Governance check
        id: governance
        uses: sidclawhq/governance-action@v0
        with:
          api-key: ${{ secrets.SIDCLAW_API_KEY }}
          agent-id: ${{ vars.SIDCLAW_AGENT_ID }}
          operation: deploy
          target-integration: production

      - name: Deploy
        if: steps.governance.outputs.decision != 'deny'
        run: ./deploy.sh
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | — | SidClaw API key. Store as a repository secret. |
| `agent-id` | Yes | — | Agent ID registered in SidClaw. |
| `operation` | Yes | — | The operation being performed (e.g., `deploy`, `merge`, `delete`). |
| `target-integration` | Yes | — | The target system (e.g., `production`, `staging`, `database`). |
| `resource-scope` | No | `*` | Scope of the resource (e.g., `production-cluster`, `us-east-1`). |
| `data-classification` | No | `internal` | Data classification: `public`, `internal`, `confidential`, `restricted`. |
| `api-url` | No | `https://api.sidclaw.com` | SidClaw API URL. Override for self-hosted deployments. |
| `wait-for-approval` | No | `true` | When approval is required, wait for a human decision before continuing. |
| `timeout` | No | `300` | Timeout in seconds when waiting for approval. |

## Outputs

| Output | Description |
|--------|-------------|
| `decision` | Policy decision: `allow`, `approval_required`, or `deny`. |
| `trace-id` | SidClaw audit trace ID for this evaluation. |
| `approval-id` | Approval request ID (only set when decision is `approval_required`). |

## Approval Flow

When the policy engine returns `approval_required`:

1. The action creates a **GitHub Check Run** on the commit with **Approve** and **Deny** buttons visible in the PR checks tab.
2. The action begins polling the SidClaw API for the approval decision.
3. A reviewer can approve or deny from either:
   - The GitHub Check Run buttons (routed through SidClaw)
   - The [SidClaw Dashboard](https://app.sidclaw.com/dashboard/approvals)
4. Once decided, the workflow step either succeeds (approved) or fails (denied).

To use Check Run buttons, the workflow must have `checks: write` permission and the `GITHUB_TOKEN` environment variable must be available (it is by default in GitHub Actions).

## Examples

### Deploy with Governance

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      checks: write
    steps:
      - uses: actions/checkout@v4

      - name: Governance check
        id: governance
        uses: sidclawhq/governance-action@v0
        with:
          api-key: ${{ secrets.SIDCLAW_API_KEY }}
          agent-id: ${{ vars.SIDCLAW_AGENT_ID }}
          operation: deploy
          target-integration: production
          data-classification: confidential
          timeout: '600'

      - name: Deploy to production
        run: |
          echo "Trace: ${{ steps.governance.outputs.trace-id }}"
          ./scripts/deploy-production.sh
```

### Merge with Governance

```yaml
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  governance:
    runs-on: ubuntu-latest
    permissions:
      checks: write
    steps:
      - name: Governance check
        id: governance
        uses: sidclawhq/governance-action@v0
        with:
          api-key: ${{ secrets.SIDCLAW_API_KEY }}
          agent-id: ${{ vars.SIDCLAW_AGENT_ID }}
          operation: merge
          target-integration: main-branch
          resource-scope: ${{ github.repository }}
```

### Non-Blocking Governance (Audit Only)

If you want to log the governance decision without blocking the workflow:

```yaml
      - name: Governance check
        id: governance
        uses: sidclawhq/governance-action@v0
        continue-on-error: true
        with:
          api-key: ${{ secrets.SIDCLAW_API_KEY }}
          agent-id: ${{ vars.SIDCLAW_AGENT_ID }}
          operation: deploy
          target-integration: staging
          wait-for-approval: 'false'
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions. Used to create Check Runs with approve/deny buttons. The workflow must have `checks: write` permission. |

## Requirements

- A SidClaw account with at least one registered agent and configured policies.
- An API key stored as a GitHub repository secret (`SIDCLAW_API_KEY`).
- The agent ID stored as a repository variable or secret (`SIDCLAW_AGENT_ID`).

## Documentation

- [SidClaw Documentation](https://docs.sidclaw.com)
- [SDK Reference](https://docs.sidclaw.com/docs/sdk/client)
- [Policy Configuration](https://docs.sidclaw.com/docs/concepts/policies)
- [Approval Workflows](https://docs.sidclaw.com/docs/concepts/approvals)

## License

Apache-2.0
