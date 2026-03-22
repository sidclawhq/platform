import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { getDevApiKey, createAgentViaAPI, createPolicyViaAPI, evaluateViaAPI } from '../helpers/api';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

let approvalAgentId: string;

test.describe('Approval Detail — Approve Flow', () => {
  test.beforeAll(async () => {
    const apiKey = await getDevApiKey();

    // Create a dedicated agent for this test
    const agent = await createAgentViaAPI(apiKey, {
      name: `E2E Approve Agent ${Date.now()}`,
      description: 'Agent for approve flow E2E test',
      owner_name: 'E2E Tester',
      owner_role: 'engineer',
      team: 'e2e-testing',
      authority_model: 'hybrid',
      identity_mode: 'service_account',
      delegation_model: 'none',
    });
    approvalAgentId = agent.data.id;

    // Create a policy that requires approval
    await createPolicyViaAPI(apiKey, {
      agent_id: approvalAgentId,
      policy_name: `E2E Approve Policy ${Date.now()}`,
      operation: 'send_email',
      target_integration: 'email_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Requires human approval for E2E test',
    });

    // Evaluate to create a pending approval
    await evaluateViaAPI(apiKey, {
      agent_id: approvalAgentId,
      operation: 'send_email',
      target_integration: 'email_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      context: {
        purpose: 'E2E approval flow test',
        message: 'Test email content for browser test',
      },
    });
  });

  test('approval detail shows all sections including why-flagged and action buttons', async ({ page }) => {
    await page.goto('/dashboard/approvals');

    // Wait for queue cards to load
    const cards = page.locator(selectors.approvals.queueCard);
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    // Click the first pending card (most recent should be from our setup)
    await cards.first().click();

    // Wait for detail panel to open
    const detailPanel = page.locator(selectors.approvals.detailPanel);
    await expect(detailPanel).toBeVisible({ timeout: 10000 });

    // Verify the why-flagged section is visible
    const whyFlagged = page.locator(selectors.approvals.whyFlagged);
    await expect(whyFlagged).toBeVisible();
    await expect(whyFlagged).toContainText('Why This Was Flagged');

    // Verify approve/deny buttons are present
    const approveButton = page.locator(selectors.approvals.approveButton);
    const denyButton = page.locator(selectors.approvals.denyButton);
    await expect(approveButton).toBeVisible();
    await expect(denyButton).toBeVisible();
  });

  test('context snapshot shows SDK context text', async ({ page }) => {
    await page.goto('/dashboard/approvals');

    const cards = page.locator(selectors.approvals.queueCard);
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    await cards.first().click();

    const detailPanel = page.locator(selectors.approvals.detailPanel);
    await expect(detailPanel).toBeVisible({ timeout: 10000 });

    // The context snapshot section should contain the SDK context we provided
    await expect(detailPanel.locator('text=E2E approval flow test')).toBeVisible({ timeout: 5000 });
  });

  test('approve with note succeeds — toast appears and card disappears', async ({ page }) => {
    await page.goto('/dashboard/approvals');

    const cards = page.locator(selectors.approvals.queueCard);
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    const initialCount = await cards.count();

    // Click first card to open detail
    await cards.first().click();

    const detailPanel = page.locator(selectors.approvals.detailPanel);
    await expect(detailPanel).toBeVisible({ timeout: 10000 });

    // Wait for approve button to be visible (detail loaded)
    const approveButton = page.locator(selectors.approvals.approveButton);
    await expect(approveButton).toBeVisible({ timeout: 5000 });

    // Add a reviewer note
    const noteInput = page.locator(selectors.approvals.noteInput);
    await noteInput.fill('Approved via E2E browser test');

    // Click approve
    await approveButton.click();

    // Verify success toast appears
    const toast = page.locator(selectors.common.toast);
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Approved');

    // Detail panel should close (the onActionComplete handler closes it and re-fetches)
    await expect(detailPanel).not.toBeVisible({ timeout: 10000 });

    // The queue should have one fewer card (or the approved card should be gone)
    // Wait for the list to refresh
    await page.waitForTimeout(1000);
    const newCount = await cards.count();
    expect(newCount).toBeLessThan(initialCount);
  });
});
