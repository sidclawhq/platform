import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Trace List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/audit');
    // Wait for trace list to load
    const traceList = page.locator(selectors.traces.list);
    await expect(traceList).toBeVisible({ timeout: 15000 });
  });

  test('shows traces with outcome badges', async ({ page }) => {
    const traceItems = page.locator(selectors.traces.listItem);
    await expect(traceItems.first()).toBeVisible({ timeout: 10000 });

    const count = await traceItems.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Each trace item should have an outcome badge
    const firstItem = traceItems.first();
    const outcomeBadge = firstItem.locator(selectors.traces.outcomeBadge);
    await expect(outcomeBadge).toBeVisible();

    // Badge should contain a recognized outcome label
    const badgeText = await outcomeBadge.textContent();
    const validOutcomes = ['Executed', 'Approved', 'Blocked', 'Denied', 'Expired', 'In Progress'];
    const hasValidOutcome = validOutcomes.some((outcome) => badgeText?.includes(outcome));
    expect(hasValidOutcome).toBe(true);
  });

  test('selecting trace shows detail panel', async ({ page }) => {
    const traceItems = page.locator(selectors.traces.listItem);
    await expect(traceItems.first()).toBeVisible({ timeout: 10000 });

    // Click first trace
    await traceItems.first().click();

    // Detail panel should appear on the right
    const traceDetail = page.locator(selectors.traces.detail);
    await expect(traceDetail).toBeVisible({ timeout: 10000 });

    // Detail should show the trace ID
    await expect(traceDetail.locator('text=Trace ID:')).toBeVisible();
  });
});
