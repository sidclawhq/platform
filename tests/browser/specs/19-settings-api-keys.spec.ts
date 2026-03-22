import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Settings — API Keys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/api-keys');
    // Wait for the page heading to appear
    await page.waitForSelector('h1', { timeout: 15000 });
  });

  test('lists existing keys', async ({ page }) => {
    // The seed data creates at least one API key
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Should have at least one row in tbody (the seeded dev key)
    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Rows should show key prefix with "..." suffix
    const firstRow = rows.first();
    const prefixCell = firstRow.locator('td').nth(1);
    const prefixText = await prefixCell.textContent();
    expect(prefixText).toContain('...');
  });

  test('create key shows raw key dialog starting with "ai_"', async ({ page }) => {
    // Click the "Create Key" button
    const createButton = page.locator(selectors.settings.createKeyButton);
    await expect(createButton).toBeVisible();
    await createButton.click();

    // The create dialog/modal should appear
    const keyDialog = page.locator(selectors.settings.keyDialog);
    await expect(keyDialog).toBeVisible({ timeout: 5000 });

    // Fill in the key name
    const nameInput = keyDialog.locator('input[type="text"]');
    await nameInput.fill(`E2E Test Key ${Date.now()}`);

    // Select at least one scope — check the "Evaluate" checkbox
    const evaluateCheckbox = keyDialog.locator('label', { hasText: 'Evaluate' }).locator('input[type="checkbox"]');
    await evaluateCheckbox.check();

    // Click Create button
    const createSubmit = keyDialog.locator('button', { hasText: 'Create' });
    await createSubmit.click();

    // The raw key value dialog should appear
    const rawKeyValue = page.locator(selectors.settings.rawKeyValue);
    await expect(rawKeyValue).toBeVisible({ timeout: 10000 });

    // The raw key should start with "ai_"
    const keyText = await rawKeyValue.textContent();
    expect(keyText).toBeTruthy();
    expect(keyText!.startsWith('ai_')).toBe(true);

    // Close the revealed key dialog
    const doneButton = page.locator('button', { hasText: 'Done' });
    await doneButton.click();

    // Verify the dialog closes
    await expect(rawKeyValue).not.toBeVisible({ timeout: 5000 });
  });
});
