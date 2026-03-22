import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { expectNoHorizontalOverflow } from '../helpers/assertions';

const LANDING_URL = 'http://localhost:3002';

test.describe('Landing Page', () => {
  test('loads with hero section containing approval/accountability/agentic', async ({ page }) => {
    await page.goto(LANDING_URL);

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    const text = await h1.textContent();
    expect(text?.toLowerCase()).toContain('approval');
    expect(text?.toLowerCase()).toContain('accountability');
    expect(text?.toLowerCase()).toContain('agentic');
  });

  test('"Get Started Free" button links to signup', async ({ page }) => {
    await page.goto(LANDING_URL);

    const cta = page.locator('a', { hasText: 'Get Started Free' });
    await expect(cta).toBeVisible();

    const href = await cta.getAttribute('href');
    expect(href).toContain('signup');
  });

  test('"View on GitHub" links to github.com/sidclawhq', async ({ page }) => {
    await page.goto(LANDING_URL);

    const ghLink = page.locator('a', { hasText: 'View on GitHub' });
    await expect(ghLink).toBeVisible();

    const href = await ghLink.getAttribute('href');
    expect(href).toContain('github.com/sidclawhq');
  });

  test('pricing section shows "5 agents" text', async ({ page }) => {
    await page.goto(LANDING_URL);

    const pricing = page.locator('#pricing');
    await expect(pricing).toBeVisible();

    await expect(pricing.locator('text=5 agents')).toBeVisible();
  });

  test('has dark theme (#0A0A0B background)', async ({ page }) => {
    await page.goto(LANDING_URL);

    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    // #0A0A0B => rgb(10, 10, 11)
    expect(bgColor).toBe('rgb(10, 10, 11)');
  });

  test('is responsive at 375px width (no horizontal scroll)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(LANDING_URL);

    // Wait for content to render
    await expect(page.locator('h1')).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test('stats cite NeuralTrust source', async ({ page }) => {
    await page.goto(LANDING_URL);

    const citation = page.locator('text=NeuralTrust');
    await expect(citation).toBeVisible();
  });
});
