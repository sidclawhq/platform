import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { SEED_AGENTS } from '../fixtures/test-data';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Agent Registry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/agents');
    // Wait for the agent table to load
    await expect(page.locator(selectors.agents.table)).toBeVisible({ timeout: 15000 });
  });

  test('loads agent table', async ({ page }) => {
    await expect(page.locator(selectors.agents.table)).toBeVisible();
    // Should have at least one agent row
    const rows = page.locator(selectors.agents.row);
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(1);
  });

  test('shows seed agents (Customer Communications, Internal Knowledge Retrieval, Case Operations)', async ({ page }) => {
    await expect(
      page.locator(selectors.agents.row, { hasText: SEED_AGENTS.CUSTOMER_COMMUNICATIONS.name })
    ).toBeVisible();

    await expect(
      page.locator(selectors.agents.row, { hasText: SEED_AGENTS.KNOWLEDGE_RETRIEVAL.name })
    ).toBeVisible();

    await expect(
      page.locator(selectors.agents.row, { hasText: SEED_AGENTS.CASE_OPERATIONS.name })
    ).toBeVisible();
  });

  test('search by agent name filters results', async ({ page }) => {
    // Type "Customer" in the search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Customer');

    // Wait for debounced filter to apply
    await page.waitForTimeout(500);

    // Customer Communications should be visible
    await expect(
      page.locator(selectors.agents.row, { hasText: SEED_AGENTS.CUSTOMER_COMMUNICATIONS.name })
    ).toBeVisible();

    // Case Operations should NOT be visible
    await expect(
      page.locator(selectors.agents.row, { hasText: SEED_AGENTS.CASE_OPERATIONS.name })
    ).not.toBeVisible();
  });

  test('click agent row navigates to agent detail page', async ({ page }) => {
    const firstRow = page.locator(selectors.agents.row).first();
    await firstRow.click();

    // Should navigate to an agent detail page
    await page.waitForURL('**/dashboard/agents/**');
    expect(page.url()).toMatch(/\/dashboard\/agents\/.+/);
  });
});
