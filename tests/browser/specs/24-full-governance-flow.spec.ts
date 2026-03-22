import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { getDevApiKey, createAgentViaAPI, createPolicyViaAPI, evaluateViaAPI } from '../helpers/api';

test.describe('Full Governance Flow', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('create agent -> create policy -> evaluate -> approve in dashboard -> verify trace', async ({ page }) => {
    const apiKey = await getDevApiKey();

    // 1. Create agent via API
    const agent = await createAgentViaAPI(apiKey, {
      name: 'Full Flow Agent',
      description: 'Testing complete governance flow end-to-end',
      owner_name: 'Flow Test Owner',
      owner_role: 'Platform Engineer',
      team: 'Platform',
      authority_model: 'hybrid',
      identity_mode: 'service_identity',
      delegation_model: 'self',
    });
    const agentId = agent.data?.id ?? agent.id;
    expect(agentId).toBeTruthy();

    // 2. Create approval_required policy via API
    const policy = await createPolicyViaAPI(apiKey, {
      agent_id: agentId,
      policy_name: 'Full Flow Approval Policy',
      operation: 'full_flow_action',
      target_integration: 'full_flow_service',
      resource_scope: 'flow_data',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Full governance flow test requires human review.',
    });
    expect(policy).toBeTruthy();

    // 3. Evaluate via API (simulating SDK call) -> expect approval_required
    const evaluation = await evaluateViaAPI(apiKey, {
      agent_id: agentId,
      operation: 'full_flow_action',
      target_integration: 'full_flow_service',
      resource_scope: 'flow_data',
      data_classification: 'confidential',
      context: { test: 'full_governance_flow', timestamp: new Date().toISOString() },
    });
    expect(evaluation.decision).toBe('approval_required');
    expect(evaluation.approval_request_id).toBeTruthy();

    // 4. Navigate to approvals queue, find the approval card with "full_flow" text
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);

    const approvalCard = page.locator(selectors.approvals.queueCard).filter({ hasText: /full_flow/i });
    await expect(approvalCard.first()).toBeVisible({ timeout: 5000 });
    await approvalCard.first().click();

    // 5. Verify detail panel shows context
    await expect(page.locator(selectors.approvals.detailPanel)).toBeVisible();
    await expect(page.locator(selectors.approvals.detailPanel).locator('text=full_governance_flow')).toBeVisible();

    // 6. Approve with note
    await page.fill(selectors.approvals.noteInput, 'Full flow test approved via E2E');
    await page.click(selectors.approvals.approveButton);
    await expect(page.locator(selectors.common.toast)).toBeVisible();

    // 7. Navigate to audit, find the trace with "full_flow" text
    await page.goto('/dashboard/audit');
    await page.waitForSelector(selectors.traces.listItem);

    const traceItem = page.locator(selectors.traces.listItem).filter({ hasText: /full_flow/i });
    await expect(traceItem.first()).toBeVisible({ timeout: 5000 });
    await traceItem.first().click();

    // 8. Verify event timeline has events
    await expect(page.locator(selectors.traces.detail)).toBeVisible();
    const events = page.locator(selectors.traces.eventRow);
    const eventCount = await events.count();
    expect(eventCount).toBeGreaterThanOrEqual(3);

    // 9. Verify outcome badge shows completed/approved
    await expect(page.locator(selectors.traces.outcomeBadge)).toContainText(/completed|approved/i);
  });
});
