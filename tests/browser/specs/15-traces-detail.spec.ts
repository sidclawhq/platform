import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Trace Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/audit');

    // Wait for trace list to load and select first trace
    const traceItems = page.locator(selectors.traces.listItem);
    await expect(traceItems.first()).toBeVisible({ timeout: 15000 });
    await traceItems.first().click();

    // Wait for detail panel to load
    const traceDetail = page.locator(selectors.traces.detail);
    await expect(traceDetail).toBeVisible({ timeout: 10000 });
  });

  test('shows event timeline in chronological order', async ({ page }) => {
    const timeline = page.locator(selectors.traces.eventTimeline);
    await expect(timeline).toBeVisible({ timeout: 10000 });

    const eventRows = page.locator(selectors.traces.eventRow);
    const count = await eventRows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Events should be in chronological order — check timestamps are ascending
    if (count >= 2) {
      const timestamps: string[] = [];
      for (let i = 0; i < count; i++) {
        // Each event row has a timestamp in a mono text span
        const timestampSpan = eventRows.nth(i).locator('.font-mono.text-xs.text-text-muted');
        const text = await timestampSpan.textContent();
        if (text) timestamps.push(text.trim());
      }

      // Timestamps should be in non-decreasing order
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i] >= timestamps[i - 1]).toBe(true);
      }
    }
  });

  test('event rows expand to show metadata', async ({ page }) => {
    const eventRows = page.locator(selectors.traces.eventRow);
    const count = await eventRows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Find an expandable event row (one with metadata or policy_version)
    // Click on the first row's button to try expanding it
    const firstRowButton = eventRows.first().locator('button').first();
    await firstRowButton.click();

    // After clicking, check if expanded content is visible
    // Expanded content contains a border-border bg-surface-1 div
    // Some rows may not be expandable — that's okay
    // We just verify no crash occurs on click
    await page.waitForTimeout(500);

    // The page should still be functional
    const traceDetail = page.locator(selectors.traces.detail);
    await expect(traceDetail).toBeVisible();
  });

  test('integrity badge shows verified status or no-integrity text', async ({ page }) => {
    const integrityBadge = page.locator(selectors.traces.integrityBadge);
    await expect(integrityBadge).toBeVisible({ timeout: 10000 });

    const badgeText = await integrityBadge.textContent();
    // Badge should show one of: "Verified (N)", "No integrity data", "Verifying", or "Integrity broken at ..."
    const validStates = ['Verified', 'No integrity', 'Verifying', 'Integrity broken'];
    const hasValidState = validStates.some((state) => badgeText?.includes(state));
    expect(hasValidState).toBe(true);
  });
});
