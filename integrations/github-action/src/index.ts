import * as core from '@actions/core';
import * as github from '@actions/github';

interface EvaluateResponse {
  decision: 'allow' | 'approval_required' | 'deny';
  trace_id: string;
  approval_request_id: string | null;
  reason: string;
  policy_rule_id: string | null;
}

interface ApprovalStatusResponse {
  id: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  decided_at: string | null;
  approver_name: string | null;
  decision_note: string | null;
}

async function apiRequest(
  method: string,
  url: string,
  apiKey: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

async function createApprovalCheckRun(
  decision: EvaluateResponse,
  context: { operation: string; targetIntegration: string },
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return;

  const octokit = github.getOctokit(token);

  await octokit.rest.checks.create({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    name: 'SidClaw Governance',
    head_sha: github.context.sha,
    status: 'in_progress',
    external_id: decision.approval_request_id!,
    output: {
      title: 'Approval Required',
      summary: 'An AI agent action requires human approval before proceeding.',
      text: [
        `**Action:** \`${context.operation}\` → \`${context.targetIntegration}\``,
        `**Risk:** Requires human review`,
        '',
        `**Reason:** ${decision.reason}`,
        '',
        `Approve or deny this action using the buttons below, or visit the [SidClaw Dashboard](https://app.sidclaw.com/dashboard/approvals).`,
        '',
        `Trace ID: \`${decision.trace_id}\``,
      ].join('\n'),
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
  });
}

async function waitForApproval(
  apiUrl: string,
  apiKey: string,
  approvalRequestId: string,
  timeoutMs: number,
): Promise<ApprovalStatusResponse> {
  const start = Date.now();
  const pollInterval = 3000;

  while (Date.now() - start < timeoutMs) {
    const response = await apiRequest(
      'GET',
      `${apiUrl}/api/v1/approvals/${approvalRequestId}/status`,
      apiKey,
    );

    if (!response.ok) {
      throw new Error(`Failed to check approval status: ${response.status}`);
    }

    const status = (await response.json()) as ApprovalStatusResponse;

    if (status.status === 'approved' || status.status === 'denied') {
      return status;
    }

    if (status.status === 'expired') {
      throw new Error('Approval request expired');
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Approval timed out after ${timeoutMs / 1000}s`);
}

async function run(): Promise<void> {
  try {
    const apiKey = core.getInput('api-key', { required: true });
    const agentId = core.getInput('agent-id', { required: true });
    const operation = core.getInput('operation', { required: true });
    const targetIntegration = core.getInput('target-integration', { required: true });
    const resourceScope = core.getInput('resource-scope') || '*';
    const dataClassification = core.getInput('data-classification') || 'internal';
    const apiUrl = core.getInput('api-url') || 'https://api.sidclaw.com';
    const shouldWaitForApproval = core.getInput('wait-for-approval') !== 'false';
    const timeout = parseInt(core.getInput('timeout') || '300') * 1000;

    core.info(`Evaluating: ${operation} → ${targetIntegration}`);

    const response = await apiRequest('POST', `${apiUrl}/api/v1/evaluate`, apiKey, {
      agent_id: agentId,
      operation,
      target_integration: targetIntegration,
      resource_scope: resourceScope,
      data_classification: dataClassification,
      context: {
        github_repository: `${github.context.repo.owner}/${github.context.repo.repo}`,
        github_actor: github.context.actor,
        github_sha: github.context.sha,
        github_ref: github.context.ref,
        github_workflow: github.context.workflow,
        github_run_id: github.context.runId,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SidClaw API error (${response.status}): ${error}`);
    }

    const decision = (await response.json()) as EvaluateResponse;

    core.setOutput('decision', decision.decision);
    core.setOutput('trace-id', decision.trace_id);

    if (decision.decision === 'allow') {
      core.info(`Allowed: ${decision.reason}`);
      return;
    }

    if (decision.decision === 'deny') {
      core.setFailed(`Blocked by policy: ${decision.reason}`);
      return;
    }

    // approval_required
    core.setOutput('approval-id', decision.approval_request_id);
    core.info(`Approval required: ${decision.reason}`);
    core.info(`  Approval ID: ${decision.approval_request_id}`);
    core.info(`  Dashboard: https://app.sidclaw.com/dashboard/approvals`);

    // Create a GitHub Check Run with approve/deny buttons
    try {
      await createApprovalCheckRun(decision, { operation, targetIntegration });
      core.info('  Check run created with approve/deny buttons');
    } catch (err) {
      core.warning(`Could not create check run: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (shouldWaitForApproval) {
      core.info(`  Waiting for approval (timeout: ${timeout / 1000}s)...`);
      const result = await waitForApproval(apiUrl, apiKey, decision.approval_request_id!, timeout);

      if (result.status === 'approved') {
        core.info(`Approved by ${result.approver_name}`);
      } else if (result.status === 'denied') {
        core.setFailed(`Denied by ${result.approver_name}: ${result.decision_note ?? ''}`);
      }
    } else {
      core.warning('Approval required but wait-for-approval is false. Workflow will continue.');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
