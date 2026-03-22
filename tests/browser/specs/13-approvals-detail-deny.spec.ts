import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { getDevApiKey, createAgentViaAPI, createPolicyViaAPI, evaluateViaAPI } from '../helpers/api';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

let denyAgentId: string;

test.describe('Approval Detail — Deny Flow', () => {
  test.beforeAll(async () => {
    const apiKey = await getDevApiKey();

    // Create a dedicated agent for the deny flow test
    const agent = await createAgentViaAPI(apiKey, {
      name: `E2E Deny Agent ${Date.now()}`,
      description: 'Agent for deny flow E2E test',
      owner_name: 'E2E Deny Tester',
      owner_role: 'engineer',
      team: 'e2e-testing',
      authority_model: 'hybrid',
      identity_mode: 'service_account',
      delegation_model: 'none',
    });
    denyAgentId = agent.data.id;

    // Create an approval_required policy
    await createPolicyViaAPI(apiKey, {
      agent_id: denyAgentId,
      policy_name: `E2E Deny Policy ${Date.now()}`,
      operation: 'delete_records',
      target_integration: 'database',
      resource_scope: 'production_tables',
      data_classification: 'restricted',
      policy_effect: 'approval_required',
      rationale: 'Destructive operation requires human approval',
    });

    // Evaluate to create a pending approval
    await evaluateViaAPI(apiKey, {
      agent_id: denyAgentId,
      operation: 'delete_records',
      target_integration: 'database',
      resource_scope: 'production_tables',
      data_classification: 'restricted',
      context: {
        purpose: 'E2E deny flow test',
        reason: 'Testing denial workflow in browser',
      },
    });
  });

  test('deny with note succeeds and card disappears', async ({ page }) => {
    await page.goto('/dashboard/approvals');

    const cards = page.locator(selectors.approvals.queueCard);
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    const initialCount = await cards.count();

    // Click first card to open detail
    await cards.first().click();

    const detailPanel = page.locator(selectors.approvals.detailPanel);
    await expect(detailPanel).toBeVisible({ timeout: 10000 });

    // Wait for deny button to appear
    const denyButton = page.locator(selectors.approvals.denyButton);
    await expect(denyButton).toBeVisible({ timeout: 5000 });

    // Add a reviewer note
    const noteInput = page.locator(selectors.approvals.noteInput);
    await noteInput.fill('Denied via E2E browser test — operation too risky');

    // Click deny
    await denyButton.click();

    // Verify success toast appears
    const toast = page.locator(selectors.common.toast);
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Denied');

    // Detail panel should close
    await expect(detailPanel).not.toBeVisible({ timeout: 10000 });

    // Queue should reflect one fewer pending card
    await page.waitForTimeout(1000);
    const newCount = await cards.count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('navigate to audit — verify trace shows denied outcome', async ({ page }) => {
    // Navigate to the audit/trace page
    await page.goto('/dashboard/audit');

    // Wait for trace list to load
    const traceList = page.locator(selectors.traces.list);
    await expect(traceList).toBeVisible({ timeout: 15000 });

    const traceItems = page.locator(selectors.traces.listItem);
    await expect(traceItems.first()).toBeVisible({ timeout: 10000 });

    // Look for a trace with "Denied" outcome badge
    const deniedBadges = page.locator(`${selectors.traces.listItem} ${selectors.traces.outcomeBadge}`, {
      hasText: 'Denied',
    });

    // There should be at least one denied trace from our deny flow
    await expect(deniedBadges.first()).toBeVisible({ timeout: 10000 });
  });
});
