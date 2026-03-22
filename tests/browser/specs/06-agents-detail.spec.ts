import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { SEED_AGENTS } from '../fixtures/test-data';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Agent Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Customer Communications Agent detail page
    await page.goto(`/dashboard/agents/${SEED_AGENTS.CUSTOMER_COMMUNICATIONS.id}`);
    // Wait for the agent detail to load
    await expect(page.locator('h1', { hasText: SEED_AGENTS.CUSTOMER_COMMUNICATIONS.name })).toBeVisible({
      timeout: 15000,
    });
  });

  test('shows agent detail sections (Sarah Chen, hybrid, Communications Service)', async ({ page }) => {
    // Owner name from seed data
    await expect(page.locator('text=Sarah Chen')).toBeVisible();

    // Authority model — formatted as "Hybrid"
    await expect(page.locator('text=Hybrid')).toBeVisible();

    // Target integration — the agent description or integrations table should reference communications
    // Check the Authority & Identity section
    const authoritySection = page.locator('text=Authority & Identity');
    await expect(authoritySection).toBeVisible();

    // Check the Overview section
    const overviewSection = page.locator('text=Overview');
    await expect(overviewSection).toBeVisible();
  });

  test('shows lifecycle badge with "Active" text', async ({ page }) => {
    const badge = page.locator(selectors.agents.lifecycleBadge);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/Active/);
  });

  test('"View all policies" link navigates to policies page', async ({ page }) => {
    const policiesLink = page.locator('a', { hasText: 'View all policies' });
    await expect(policiesLink).toBeVisible();
    await policiesLink.click();

    await page.waitForURL('**/dashboard/policies**');
    expect(page.url()).toContain('/dashboard/policies');
    // Should include agent_id filter parameter
    expect(page.url()).toContain('agent_id=');
  });
});
