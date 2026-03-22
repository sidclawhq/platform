import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Trace Export', () => {
  test('export single trace as JSON triggers download with matching filename', async ({ page }) => {
    await page.goto('/dashboard/audit');

    // Wait for trace list to load and select first trace
    const traceItems = page.locator(selectors.traces.listItem);
    await expect(traceItems.first()).toBeVisible({ timeout: 15000 });
    await traceItems.first().click();

    // Wait for detail panel to load
    const traceDetail = page.locator(selectors.traces.detail);
    await expect(traceDetail).toBeVisible({ timeout: 10000 });

    // Find the export JSON button
    const exportButton = page.locator(selectors.traces.exportJsonButton);
    await expect(exportButton).toBeVisible({ timeout: 5000 });

    // Listen for download event before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    await exportButton.click();

    const download = await downloadPromise;

    // Verify the filename matches the expected pattern: trace-{id}.json
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^trace-.+\.json$/);
  });
});
