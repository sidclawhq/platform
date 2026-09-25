import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.describe('Architecture Page', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('renders architecture diagram with four primitives', async ({ page }) => {
    await page.goto('/dashboard/architecture');
    // Match the primitive headings exactly — their descriptions repeat the same words
    for (const name of ['Identity', 'Policy', 'Approval', 'Auditability']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
  });
});
