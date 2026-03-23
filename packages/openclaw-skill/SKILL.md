---
name: sidclaw-governance
description: Add policy evaluation, human approval, and audit trails to any tool. Powered by SidClaw.
version: 1.1.0
homepage: https://github.com/sidclawhq/platform/tree/main/packages/openclaw-skill
metadata:
  openclaw:
    emoji: "🛡️"
    requires:
      env:
        - SIDCLAW_API_KEY
        - SIDCLAW_AGENT_ID
        - SIDCLAW_UPSTREAM_CMD
        - SIDCLAW_UPSTREAM_ARGS
      bins:
        - node
    primaryEnv: SIDCLAW_API_KEY
    os:
      - macos
      - linux
      - windows
---

# SidClaw Governance

You have SidClaw governance enabled. Every tool call is evaluated against security policies before execution.

Source code: https://github.com/sidclawhq/platform — the SDK (@sidclaw/sdk) is open-source under Apache 2.0. You can audit the proxy code at packages/sdk/src/mcp/.

## How governance affects your behavior

When you use a tool, the SidClaw policy engine evaluates whether the action is allowed. There are three possible outcomes:

### 1. ALLOWED
The tool executes normally. No changes to your behavior needed. You may see a brief note in the tool response confirming governance was applied.

### 2. APPROVAL REQUIRED
The tool call is paused pending human review. You will receive an error response containing:
- `type: "approval_required"`
- `approval_request_id`: the ID of the pending approval
- `reason`: why this action requires approval

When this happens:
- Tell the user: "This action requires human approval before I can proceed."
- Share the reason from the policy.
- Direct the user to approve or deny the request in the SidClaw dashboard.
- If the user has the dashboard open, they will see an approval card with full context about what you're trying to do and why it was flagged.
- Do NOT retry the tool call until the user confirms the approval was granted.

### 3. DENIED
The tool call was blocked by policy. You will receive an error response containing:
- `type: "action_denied"`
- `reason`: why this action was blocked

When this happens:
- Tell the user: "This action was blocked by a security policy."
- Share the reason from the policy.
- Do NOT retry the tool call or attempt to work around the block.
- Suggest alternative approaches if possible (e.g., if data export is blocked, suggest viewing the data in the dashboard instead).

## Rules

1. NEVER ignore governance errors. If a tool call is denied, respect the denial.
2. NEVER attempt to circumvent governance by calling tools differently or encoding requests to avoid detection.
3. When approval is required, ALWAYS inform the user and wait for their confirmation.
4. Treat governance responses as authoritative — they reflect security policies set by the organization.
5. If multiple tools are governed, each call is evaluated independently.

## Dashboard

The SidClaw dashboard is available at the URL configured by the administrator. It shows:
- **Approval Queue**: Pending approval requests with full context
- **Audit Trail**: Complete trace of every tool call, policy decision, and outcome
- **Policy Rules**: The security policies governing your actions

If a user asks about governance policies or why an action was blocked, direct them to the SidClaw dashboard for details.
