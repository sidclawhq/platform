import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.describe('CSRF Protection', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('POST without CSRF token is rejected', async ({ page }) => {
    await page.goto('/dashboard');

    // Make a direct fetch POST without CSRF token from the browser context
    const result = await page.evaluate(async () => {
      const res = await fetch('http://localhost:4000/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: 'csrf-test',
          description: 'test',
          owner_name: 'test',
          owner_role: 'test',
          team: 'test',
          authority_model: 'self',
          identity_mode: 'service_identity',
          delegation_model: 'self',
          created_by: 'test',
        }),
      });
      return { status: res.status, body: await res.text() };
    });

    // Should be rejected with 403 (CSRF) or 401 (no auth)
    expect([401, 403]).toContain(result.status);
  });

  test('normal dashboard operations include CSRF token automatically', async ({ page }) => {
    await page.goto('/dashboard/settings/general');

    // Wait for the page to fully load
    await page.waitForSelector(selectors.settings.saveButton, { timeout: 5000 });

    // Attempt to save settings — dashboard should include CSRF token automatically
    await page.click(selectors.settings.saveButton);

    // Should show a success toast, not a CSRF error
    await expect(page.locator(selectors.common.toast)).toBeVisible({ timeout: 5000 });
  });
});
