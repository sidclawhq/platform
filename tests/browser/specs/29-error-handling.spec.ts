import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.describe('Error Handling', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('non-existent agent page does not crash', async ({ page }) => {
    await page.goto('/dashboard/agents/nonexistent-id-12345');
    // Wait for page to settle
    await page.waitForTimeout(2000);
    // Page should not be blank — it should show either a 404 state or error message
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(10);
  });

  test('no console errors on dashboard page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    // Filter out expected noise (favicon 404s, resource loading issues)
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource'),
    );
    expect(realErrors).toHaveLength(0);
  });
});
