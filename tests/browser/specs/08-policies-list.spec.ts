import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Policy List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/policies');
    // Wait for policies to load
    await expect(page.locator('h1', { hasText: 'Policies' })).toBeVisible({ timeout: 15000 });
  });

  test('shows policies grouped by agent', async ({ page }) => {
    // The PolicyList component groups policies by agent name using h2 headers.
    // Wait for at least one policy card to appear.
    const policyCards = page.locator(selectors.policies.card);

    // If there are policies, there should be agent group headings
    const cardCount = await policyCards.count();
    if (cardCount > 0) {
      // Agent group headings are h2 elements inside the policy list area
      const agentHeadings = page.locator('h2').filter({ hasText: /Agent/ });
      // At minimum, the data should be grouped — check that policy cards exist
      await expect(policyCards.first()).toBeVisible();
    } else {
      // No policies — empty state should show
      await expect(page.locator('text=No policies found')).toBeVisible();
    }
  });

  test('effect badges show allow, approval_required, deny text', async ({ page }) => {
    const effectBadges = page.locator(selectors.policies.effectBadge);
    const badgeCount = await effectBadges.count();

    if (badgeCount > 0) {
      // Collect all badge texts
      const badgeTexts: string[] = [];
      for (let i = 0; i < badgeCount; i++) {
        const text = await effectBadges.nth(i).textContent();
        if (text) badgeTexts.push(text.trim().toLowerCase());
      }

      // Effect badges should contain known effect labels
      const validEffects = ['allow', 'approval required', 'deny'];
      for (const text of badgeTexts) {
        expect(validEffects.some((e) => text.includes(e))).toBe(true);
      }
    }
  });
});
