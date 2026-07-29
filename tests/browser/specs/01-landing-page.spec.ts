import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { expectNoHorizontalOverflow } from '../helpers/assertions';

const LANDING_URL = 'http://localhost:3002';

test.describe('Landing Page', () => {
  test('loads with V2 hero: "the missing control plane for agentic AI"', async ({ page }) => {
    await page.goto(LANDING_URL);

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    const text = await h1.textContent();
    expect(text?.toLowerCase()).toContain('control plane');
    expect(text?.toLowerCase()).toContain('agentic');
  });

  test('"Start Free" CTA links to signup', async ({ page }) => {
    await page.goto(LANDING_URL);

    const cta = page.locator('a', { hasText: 'Start Free' }).first();
    await expect(cta).toBeVisible();

    const href = await cta.getAttribute('href');
    expect(href).toContain('signup');
  });

  test('links to github.com/sidclawhq', async ({ page }) => {
    await page.goto(LANDING_URL);

    // Multiple GitHub links exist (nav, developer section, footer) — assert
    // at least one resolves to the org.
    const ghLink = page.locator('a[href*="github.com/sidclawhq"]').first();
    await expect(ghLink).toBeVisible();
  });

  test('compliance bar names FINRA and the EU AI Act', async ({ page }) => {
    // The V2 page has no pricing section; the compliance trust bar is its
    // regulated-market signal.
    await page.goto(LANDING_URL);

    await expect(page.locator('text=FINRA').first()).toBeVisible();
    await expect(page.locator('text=EU AI Act').first()).toBeVisible();
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

  test('hero pitches identity, policy, approval, and audit', async ({ page }) => {
    // The V2 page dropped the NeuralTrust stat; the four-primitives pitch is
    // the stable content anchor.
    await page.goto(LANDING_URL);

    const heroCopy = page.locator('text=tamper-evident audit').first();
    await expect(heroCopy).toBeVisible();
  });
});
