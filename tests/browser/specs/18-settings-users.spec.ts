import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Settings — Users', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/users');
    // Wait for the user table to load
    await page.waitForSelector('table', { timeout: 15000 });
  });

  test('shows user table', async ({ page }) => {
    // The table should be visible with headers
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Should have column headers
    await expect(table.locator('th', { hasText: 'Name' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Email' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Role' })).toBeVisible();

    // Should have at least one user row (the current logged-in user)
    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('current user has "(you)" marker', async ({ page }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Look for the "(you)" marker in the table
    const youMarker = table.locator('text=(you)');
    await expect(youMarker).toBeVisible({ timeout: 5000 });

    // The row with "(you)" should also have a dash in the actions column
    // instead of a Remove button, indicating it's the current user
  });
});
