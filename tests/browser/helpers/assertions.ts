import { Page, expect } from '@playwright/test';

/** Assert no console errors on page (filtering out expected noise like favicon 404s) */
export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.waitForTimeout(2000);

  const realErrors = errors.filter(e =>
    !e.includes('favicon') && !e.includes('404') && !e.includes('Failed to load resource')
  );
  expect(realErrors).toHaveLength(0);
}

/** Assert no horizontal overflow on the page */
export async function expectNoHorizontalOverflow(page: Page, tolerance = 5) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + tolerance);
}
