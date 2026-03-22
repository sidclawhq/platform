import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.describe('Responsive Design', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 720 },
    { name: 'tablet', width: 768, height: 1024 },
  ];

  for (const viewport of viewports) {
    test(`dashboard loads at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');
      // Core content should be visible at every viewport
      await expect(page.locator('text=Agents')).toBeVisible();
    });

    test(`no horizontal overflow at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');
      await page.waitForTimeout(1000);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  }
});
