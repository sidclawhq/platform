import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Dashboard Overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    // Wait for the overview page to load data
    await expect(page.locator('h1', { hasText: 'Dashboard Overview' })).toBeVisible();
  });

  test('shows stat cards (Agents, Policies, Pending text)', async ({ page }) => {
    // The OverviewStats component renders stat cards with uppercase labels
    await expect(page.locator('text=Agents').first()).toBeVisible();
    await expect(page.locator('text=Policies').first()).toBeVisible();
    await expect(page.locator('text=Pending').first()).toBeVisible();
  });

  test('system health shows "Healthy"', async ({ page }) => {
    // SystemHealthIndicator component
    await expect(page.locator('text=System Health')).toBeVisible();
    await expect(page.locator('text=Healthy').first()).toBeVisible();
  });

  test('"View all approvals" link navigates to /approvals', async ({ page }) => {
    const approvalsLink = page.locator('a', { hasText: 'View all approvals' });
    await expect(approvalsLink).toBeVisible();
    await approvalsLink.click();

    await page.waitForURL('**/dashboard/approvals**');
    expect(page.url()).toContain('/dashboard/approvals');
  });

  test('"View all traces" link navigates to /audit', async ({ page }) => {
    const tracesLink = page.locator('a', { hasText: 'View all traces' });
    await expect(tracesLink).toBeVisible();
    await tracesLink.click();

    await page.waitForURL('**/dashboard/audit**');
    expect(page.url()).toContain('/dashboard/audit');
  });
});
