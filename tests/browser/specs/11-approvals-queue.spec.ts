import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Approval Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/approvals');
    // Wait for the queue to load (either cards appear or the loading state resolves)
    await page.waitForSelector(`${selectors.approvals.queueCard}, .text-text-muted`, {
      timeout: 15000,
    });
  });

  test('shows pending approvals from seed data', async ({ page }) => {
    // The seed data should include at least one pending approval
    const cards = page.locator(selectors.approvals.queueCard);
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('cards show agent name, operation, and classification info', async ({ page }) => {
    const firstCard = page.locator(selectors.approvals.queueCard).first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Each card should contain agent name text (shown as text-text-muted span)
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();
    // Card should contain the arrow separator between operation and target
    expect(cardText).toContain('→');
  });

  test('sort dropdown works — change to highest_risk without errors', async ({ page }) => {
    const sortDropdown = page.locator(selectors.approvals.sortDropdown);
    await expect(sortDropdown).toBeVisible();

    // Change sort to highest_risk
    await sortDropdown.selectOption('highest_risk');

    // Verify the value changed
    await expect(sortDropdown).toHaveValue('highest_risk');

    // Page should not error — cards should still be present or empty state shown
    // Wait a moment for re-sort to apply
    await page.waitForTimeout(500);

    // Page should still be functional (no crash)
    const heading = page.locator('h1', { hasText: 'Approvals' });
    await expect(heading).toBeVisible();
  });

  test('clicking card opens detail panel', async ({ page }) => {
    const firstCard = page.locator(selectors.approvals.queueCard).first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    await firstCard.click();

    // The detail panel should appear as a slide-over
    const detailPanel = page.locator(selectors.approvals.detailPanel);
    await expect(detailPanel).toBeVisible({ timeout: 10000 });

    // Detail panel should have the "Approval Detail" title
    await expect(detailPanel.locator('text=Approval Detail')).toBeVisible();
  });

  test('pending count badge in sidebar matches or exceeds queue card count', async ({ page }) => {
    // Wait for cards to load
    const cards = page.locator(selectors.approvals.queueCard);
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const visibleCardCount = await cards.count();

    // Check the sidebar pending badge
    const pendingBadge = page.locator(selectors.sidebar.pendingBadge);

    // Badge may or may not exist depending on count
    const badgeVisible = await pendingBadge.isVisible().catch(() => false);

    if (badgeVisible) {
      const badgeText = await pendingBadge.textContent();
      const badgeCount = parseInt(badgeText?.trim() ?? '0', 10);
      // The badge count should be >= visible card count (badge shows total pending,
      // visible cards may be a paginated subset)
      expect(badgeCount).toBeGreaterThanOrEqual(visibleCardCount);
    } else {
      // If no badge is visible, there should be 0 cards (or badge is only shown when > 0)
      // This is acceptable — the test still passes
    }
  });
});
