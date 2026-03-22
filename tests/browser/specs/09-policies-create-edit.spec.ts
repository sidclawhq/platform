import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { SEED_AGENTS } from '../fixtures/test-data';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Policy Create & Edit', () => {
  test('create policy via modal (fill all fields, save, verify toast)', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await expect(page.locator('h1', { hasText: 'Policies' })).toBeVisible({ timeout: 15000 });

    // Click "Create Policy" button
    await page.click(selectors.policies.createButton);

    // Modal should open
    const modal = page.locator(selectors.policies.editorModal);
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Create Policy')).toBeVisible();

    // Fill in form fields
    // Select agent
    await modal.locator('select').first().selectOption({ label: SEED_AGENTS.CUSTOMER_COMMUNICATIONS.name });

    // Policy name
    await modal.locator('input[type="text"]').first().fill('E2E Test Policy');

    // Operation
    const operationInput = modal.locator('input[placeholder*="send"]');
    await operationInput.fill('read');

    // Target integration
    const targetInput = modal.locator('input[placeholder*="communications"]');
    await targetInput.fill('test_service');

    // Resource scope
    const scopeInput = modal.locator('input[placeholder*="customer_emails"]');
    await scopeInput.fill('test_resources');

    // Data classification - select from dropdown
    const classificationSelect = modal.locator('select').filter({ has: page.locator('option[value="internal"]') });
    await classificationSelect.selectOption('internal');

    // Effect - select from dropdown
    const effectSelect = modal.locator('select').filter({ has: page.locator('option[value="allow"]') });
    await effectSelect.selectOption('allow');

    // Priority
    await modal.locator('input[type="number"]').fill('50');

    // Rationale
    await modal.locator('textarea').fill('E2E test rationale — this policy exists for automated testing purposes');

    // Click submit
    await modal.locator('button[type="submit"]', { hasText: 'Create Policy' }).click();

    // Verify toast notification
    const toast = page.locator(selectors.common.toast);
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Policy created');

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('rationale is required (submit without rationale shows error)', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await expect(page.locator('h1', { hasText: 'Policies' })).toBeVisible({ timeout: 15000 });

    await page.click(selectors.policies.createButton);

    const modal = page.locator(selectors.policies.editorModal);
    await expect(modal).toBeVisible();

    // Fill all fields EXCEPT rationale
    await modal.locator('select').first().selectOption({ label: SEED_AGENTS.CUSTOMER_COMMUNICATIONS.name });
    await modal.locator('input[type="text"]').first().fill('No Rationale Policy');
    await modal.locator('input[placeholder*="send"]').fill('read');
    await modal.locator('input[placeholder*="communications"]').fill('test_service');
    await modal.locator('input[placeholder*="customer_emails"]').fill('test_resources');

    const classificationSelect = modal.locator('select').filter({ has: page.locator('option[value="internal"]') });
    await classificationSelect.selectOption('internal');

    const effectSelect = modal.locator('select').filter({ has: page.locator('option[value="allow"]') });
    await effectSelect.selectOption('allow');

    await modal.locator('input[type="number"]').fill('50');

    // Leave rationale empty and submit
    await modal.locator('button[type="submit"]').click();

    // Should show validation error for rationale
    await expect(modal.locator('text=Rationale must be at least 10 characters')).toBeVisible();

    // Modal should remain open
    await expect(modal).toBeVisible();
  });

  test('max_session_ttl only shown for approval_required effect', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await expect(page.locator('h1', { hasText: 'Policies' })).toBeVisible({ timeout: 15000 });

    await page.click(selectors.policies.createButton);

    const modal = page.locator(selectors.policies.editorModal);
    await expect(modal).toBeVisible();

    // With "allow" effect, TTL field should NOT be visible
    const effectSelect = modal.locator('select').filter({ has: page.locator('option[value="allow"]') });
    await effectSelect.selectOption('allow');
    await expect(modal.locator('text=Max Session TTL')).not.toBeVisible();

    // With "deny" effect, TTL field should NOT be visible
    await effectSelect.selectOption('deny');
    await expect(modal.locator('text=Max Session TTL')).not.toBeVisible();

    // With "approval_required" effect, TTL field SHOULD be visible
    await effectSelect.selectOption('approval_required');
    await expect(modal.locator('text=Max Session TTL')).toBeVisible();
  });

  test('edit policy updates version (click edit, change priority, save)', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await expect(page.locator('h1', { hasText: 'Policies' })).toBeVisible({ timeout: 15000 });

    // Wait for at least one policy card
    const firstCard = page.locator(selectors.policies.card).first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // Get the current version text from the first card
    const versionText = await firstCard.locator('text=/v\\d+/').textContent();
    const currentVersion = parseInt(versionText?.replace('v', '') ?? '1', 10);

    // Click the edit button on the first policy card
    await firstCard.locator(selectors.policies.editButton).click();

    // Modal should open with "Edit Policy" title
    const modal = page.locator(selectors.policies.editorModal);
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Edit Policy')).toBeVisible();

    // Change priority
    const priorityInput = modal.locator('input[type="number"]');
    const currentPriority = await priorityInput.inputValue();
    const newPriority = (parseInt(currentPriority, 10) || 100) + 1;
    await priorityInput.fill(String(newPriority));

    // Click update
    await modal.locator('button[type="submit"]', { hasText: 'Update Policy' }).click();

    // Verify toast notification
    const toast = page.locator(selectors.common.toast);
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Policy updated');

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Verify version incremented on the card
    await expect(firstCard.locator(`text=v${currentVersion + 1}`)).toBeVisible({ timeout: 10000 });
  });
});
