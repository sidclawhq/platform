import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.describe('Global Search', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('typing in search shows results dropdown', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'Customer');
    await expect(page.locator(selectors.search.results)).toBeVisible({ timeout: 3000 });
  });

  test('search results grouped by category', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'Customer');
    await page.waitForSelector(selectors.search.results);
    // Should have category headers — Agents is expected since "Customer Communications Agent" exists in seed data
    await expect(page.locator(selectors.search.results).locator('text=Agents')).toBeVisible();
  });

  test('clicking result navigates to detail', async ({ page }) => {
    await page.goto('/dashboard');
    const startUrl = page.url();
    await page.fill(selectors.search.input, 'Customer');
    await page.waitForSelector(selectors.search.resultItem);
    await page.locator(selectors.search.resultItem).first().click();
    // Should navigate away from the dashboard overview
    await page.waitForTimeout(1000);
    expect(page.url()).not.toBe(startUrl);
  });

  test('no results message for unmatched query', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'xyznonexistent');
    await expect(page.locator('text=No results')).toBeVisible({ timeout: 3000 });
  });

  test('search closes on Escape key', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'Customer');
    await page.waitForSelector(selectors.search.results);
    await page.keyboard.press('Escape');
    await expect(page.locator(selectors.search.results)).not.toBeVisible();
  });
});
