import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { getDevApiKey, createAgentViaAPI } from '../helpers/api';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

let testAgentId: string;

test.describe('Agent Lifecycle Management', () => {
  test.beforeAll(async () => {
    const apiKey = await getDevApiKey();
    const agent = await createAgentViaAPI(apiKey, {
      name: `Lifecycle Test Agent ${Date.now()}`,
      description: 'Agent created for lifecycle E2E tests',
      owner_name: 'E2E Tester',
      owner_role: 'qa_engineer',
      team: 'QA',
      authority_model: 'hybrid',
      identity_mode: 'shared',
      delegation_model: 'supervised',
    });
    testAgentId = agent.data.id;
  });

  test('suspend agent shows confirmation dialog and updates badge to Suspended', async ({ page }) => {
    await page.goto(`/dashboard/agents/${testAgentId}`);
    await expect(page.locator(selectors.agents.lifecycleBadge)).toBeVisible({ timeout: 15000 });
    await expect(page.locator(selectors.agents.lifecycleBadge)).toHaveText(/Active/);

    // Click suspend button
    await page.click(selectors.agents.suspendButton);

    // Confirm dialog appears
    const dialog = page.locator(selectors.agents.confirmDialog);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Suspend');

    // Click confirm
    await page.click(selectors.agents.confirmButton);

    // Wait for dialog to close and badge to update
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator(selectors.agents.lifecycleBadge)).toHaveText(/Suspended/, { timeout: 10000 });
  });

  test('reactivate agent restores to Active', async ({ page }) => {
    await page.goto(`/dashboard/agents/${testAgentId}`);
    await expect(page.locator(selectors.agents.lifecycleBadge)).toBeVisible({ timeout: 15000 });
    await expect(page.locator(selectors.agents.lifecycleBadge)).toHaveText(/Suspended/);

    // Click reactivate button
    await page.click(selectors.agents.reactivateButton);

    // Confirm dialog appears
    const dialog = page.locator(selectors.agents.confirmDialog);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Reactivate');

    // Click confirm
    await page.click(selectors.agents.confirmButton);

    // Wait for badge to update back to Active
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator(selectors.agents.lifecycleBadge)).toHaveText(/Active/, { timeout: 10000 });
  });

  test('revoke agent is permanent (no action buttons after)', async ({ page }) => {
    await page.goto(`/dashboard/agents/${testAgentId}`);
    await expect(page.locator(selectors.agents.lifecycleBadge)).toBeVisible({ timeout: 15000 });
    await expect(page.locator(selectors.agents.lifecycleBadge)).toHaveText(/Active/);

    // Click revoke button
    await page.click(selectors.agents.revokeButton);

    // Confirm dialog appears
    const dialog = page.locator(selectors.agents.confirmDialog);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('permanent');

    // Click confirm
    await page.click(selectors.agents.confirmButton);

    // Wait for badge to update to Revoked
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator(selectors.agents.lifecycleBadge)).toHaveText(/Revoked/, { timeout: 10000 });

    // No suspend/reactivate/revoke buttons should be visible
    await expect(page.locator(selectors.agents.suspendButton)).not.toBeVisible();
    await expect(page.locator(selectors.agents.reactivateButton)).not.toBeVisible();
    await expect(page.locator(selectors.agents.revokeButton)).not.toBeVisible();

    // Should show permanent revocation message
    await expect(page.locator('text=permanently revoked')).toBeVisible();
  });
});
