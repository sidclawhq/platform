import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.describe('Settings - Audit Export', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('audit export page loads with date pickers', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-export');
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });
});
