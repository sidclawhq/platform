/**
 * GitHub Check Run integration for SidClaw.
 *
 * Creates a GitHub Check Run with Approve/Deny actions when an evaluation
 * returns `approval_required`. Used in GitHub Actions workflows.
 *
 * @example
 * ```typescript
 * import { createApprovalCheckRun } from '@sidclaw/sdk/github';
 *
 * const decision = await client.evaluate({ ... });
 * if (decision.decision === 'approval_required') {
 *   await createApprovalCheckRun(decision, {
 *     token: process.env.GITHUB_TOKEN!,
 *     owner: 'myorg',
 *     repo: 'myrepo',
 *     sha: process.env.GITHUB_SHA!,
 *   });
 *   await client.waitForApproval(decision.approval_request_id!);
 * }
 * ```
 */

export interface GitHubCheckRunConfig {
  /** GitHub token (e.g., GITHUB_TOKEN from Actions) */
  token: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Commit SHA */
  sha: string;
}

export interface ApprovalContext {
  /** Agent name (shown in the check run) */
  agent_name?: string;
  /** Operation being performed */
  operation?: string;
  /** Target system */
  target_integration?: string;
  /** Risk classification */
  risk_classification?: string;
}

interface ApprovalDecision {
  trace_id: string;
  approval_request_id: string | null;
  reason: string;
  policy_rule_id: string | null;
}

/**
 * Create a GitHub Check Run with Approve/Deny action buttons.
 *
 * The check run is created in `in_progress` status with the approval request ID
 * as the `external_id`. When a reviewer clicks Approve or Deny, GitHub sends a
 * `check_run.requested_action` webhook that the SidClaw API handles.
 */
export async function createApprovalCheckRun(
  decision: ApprovalDecision,
  config: GitHubCheckRunConfig,
  context?: ApprovalContext,
): Promise<void> {
  if (!decision.approval_request_id) {
    throw new Error('Cannot create check run: no approval_request_id in decision');
  }

  const body = {
    name: 'SidClaw Governance',
    head_sha: config.sha,
    status: 'in_progress',
    external_id: decision.approval_request_id,
    output: {
      title: 'Approval Required',
      summary: 'An AI agent action requires human approval before proceeding.',
      text: [
        context?.agent_name ? `**Agent:** ${context.agent_name}` : null,
        `**Action:** \`${context?.operation ?? 'unknown'}\` → \`${context?.target_integration ?? 'unknown'}\``,
        context?.risk_classification ? `**Risk:** ${context.risk_classification.toUpperCase()}` : null,
        '',
        `**Reason:** ${decision.reason}`,
        '',
        'Approve or deny this action using the buttons below, or visit the [SidClaw Dashboard](https://app.sidclaw.com/dashboard/approvals).',
        '',
        `Trace ID: \`${decision.trace_id}\``,
      ].filter(Boolean).join('\n'),
    },
    actions: [
      {
        label: 'Approve',
        description: 'Allow this agent action to proceed',
        identifier: 'approve',
      },
      {
        label: 'Deny',
        description: 'Block this agent action',
        identifier: 'deny',
      },
    ],
  };

  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/check-runs`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'SidClaw-SDK',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.text().catch(() => '');
    throw new Error(`Failed to create GitHub check run: ${response.status} ${error}`);
  }
}
