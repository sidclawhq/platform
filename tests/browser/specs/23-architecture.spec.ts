import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.describe('Architecture Page', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('renders architecture diagram with four primitives', async ({ page }) => {
    await page.goto('/dashboard/architecture');
    await expect(page.locator('text=Identity')).toBeVisible();
    await expect(page.locator('text=Policy')).toBeVisible();
    await expect(page.locator('text=Approval')).toBeVisible();
    await expect(page.locator('text=Auditability')).toBeVisible();
  });
});
