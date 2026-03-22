import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Settings — General', () => {
  test('loads current settings with name input populated', async ({ page }) => {
    await page.goto('/dashboard/settings/general');

    // Wait for loading to finish
    const nameInput = page.locator('input#name');
    await expect(nameInput).toBeVisible({ timeout: 15000 });

    // The name input should have a value (workspace name from seed data)
    const value = await nameInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('save changes shows toast', async ({ page }) => {
    await page.goto('/dashboard/settings/general');

    // Wait for form to load
    const nameInput = page.locator('input#name');
    await expect(nameInput).toBeVisible({ timeout: 15000 });

    // Get current name and modify it slightly
    const currentName = await nameInput.inputValue();
    const newName = currentName.endsWith(' ') ? currentName.trimEnd() : currentName + ' ';
    await nameInput.fill(newName);

    // Click save
    const saveButton = page.locator(selectors.settings.saveButton);
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Verify toast appears
    const toast = page.locator(selectors.common.toast);
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Settings saved');

    // Restore original name
    await nameInput.fill(currentName);
    await saveButton.click();
    await expect(page.locator(selectors.common.toast)).toBeVisible({ timeout: 10000 });
  });

  test('changes persist after reload', async ({ page }) => {
    await page.goto('/dashboard/settings/general');

    const nameInput = page.locator('input#name');
    await expect(nameInput).toBeVisible({ timeout: 15000 });

    // Set a distinctive name
    const testName = `E2E Test Workspace ${Date.now()}`;
    await nameInput.fill(testName);

    // Save
    const saveButton = page.locator(selectors.settings.saveButton);
    await saveButton.click();

    // Wait for save confirmation
    const toast = page.locator(selectors.common.toast);
    await expect(toast).toBeVisible({ timeout: 10000 });

    // Reload the page
    await page.reload();

    // Verify the name persisted
    const reloadedNameInput = page.locator('input#name');
    await expect(reloadedNameInput).toBeVisible({ timeout: 15000 });
    await expect(reloadedNameInput).toHaveValue(testName);

    // Restore to a sensible default
    await reloadedNameInput.fill('Development Workspace');
    await page.locator(selectors.settings.saveButton).click();
    await expect(page.locator(selectors.common.toast)).toBeVisible({ timeout: 10000 });
  });
});
