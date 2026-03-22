import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.describe('Navigation & Breadcrumbs', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  const sidebarLinks: { name: string; selector: string; expectedPath: string }[] = [
    { name: 'overview', selector: selectors.sidebar.overview, expectedPath: '/dashboard' },
    { name: 'agents', selector: selectors.sidebar.agents, expectedPath: '/dashboard/agents' },
    { name: 'policies', selector: selectors.sidebar.policies, expectedPath: '/dashboard/policies' },
    { name: 'approvals', selector: selectors.sidebar.approvals, expectedPath: '/dashboard/approvals' },
    { name: 'audit', selector: selectors.sidebar.audit, expectedPath: '/dashboard/audit' },
    { name: 'architecture', selector: selectors.sidebar.architecture, expectedPath: '/dashboard/architecture' },
    { name: 'settings', selector: selectors.sidebar.settings, expectedPath: '/dashboard/settings' },
  ];

  for (const link of sidebarLinks) {
    test(`sidebar "${link.name}" link navigates to ${link.expectedPath}`, async ({ page }) => {
      await page.goto('/dashboard');
      await page.click(link.selector);
      await page.waitForURL(`**${link.expectedPath}**`, { timeout: 5000 });
      // Page should render content without crash
      const bodyText = await page.textContent('body');
      expect(bodyText?.length).toBeGreaterThan(10);
    });
  }

  test('breadcrumbs show correct hierarchy on agent detail', async ({ page }) => {
    await page.goto('/dashboard/agents');
    const rows = page.locator(selectors.agents.row);
    const count = await rows.count();
    if (count === 0) {
      test.skip(true, 'No agent rows to test breadcrumbs');
      return;
    }
    await rows.first().click();
    await page.waitForURL(/agents\/.+/);

    await expect(page.locator(selectors.common.breadcrumbs)).toBeVisible();
    await expect(page.locator(selectors.common.breadcrumbs)).toContainText('Agents');
  });

  test('breadcrumb link navigates back to list', async ({ page }) => {
    await page.goto('/dashboard/agents');
    const rows = page.locator(selectors.agents.row);
    const count = await rows.count();
    if (count === 0) {
      test.skip(true, 'No agent rows to test breadcrumb navigation');
      return;
    }
    await rows.first().click();
    await page.waitForURL(/agents\/.+/);

    await page.locator(selectors.common.breadcrumbs).locator('a:text("Agents")').click();
    await expect(page).toHaveURL(/\/dashboard\/agents$/);
  });
});
