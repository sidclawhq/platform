import { Page } from '@playwright/test';

export async function loginAsNewUser(page: Page, name: string, email: string, password: string) {
  await page.goto('/signup');
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}
