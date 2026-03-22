import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { loginAsNewUser } from '../helpers/auth';

// NO storageState — we are testing unauthenticated auth flows

test.describe('Login Flow', () => {
  test('login page renders with "Sign in" text', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1', { hasText: 'SidClaw' })).toBeVisible();
    await expect(page.locator('text=Sign in to continue')).toBeVisible();

    // Email and password fields present
    await expect(page.locator(selectors.auth.emailInput)).toBeVisible();
    await expect(page.locator(selectors.auth.passwordInput)).toBeVisible();
    await expect(page.locator(selectors.auth.submitButton)).toBeVisible();
  });

  test('shows expired message with ?expired=true', async ({ page }) => {
    await page.goto('/login?expired=true');

    await expect(page.locator('text=Session expired')).toBeVisible();
  });

  test('"Sign up" link navigates to signup page', async ({ page }) => {
    await page.goto('/login');

    const signUpLink = page.locator('a', { hasText: 'Sign up' });
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();

    await page.waitForURL('**/signup**');
    expect(page.url()).toContain('/signup');
  });

  test('successful login after creating user via signup', async ({ page }) => {
    const email = `login-test-${Date.now()}@test.com`;
    const password = 'LoginTest2026!';

    // Step 1: Create user via signup
    await loginAsNewUser(page, 'Login Test User', email, password);
    expect(page.url()).toContain('/dashboard');

    // Step 2: Clear cookies to simulate logout, then login
    await page.context().clearCookies();
    await page.goto('/login');

    await page.fill(selectors.auth.emailInput, email);
    await page.fill(selectors.auth.passwordInput, password);
    await page.click(selectors.auth.submitButton);

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('unauthenticated access to /dashboard redirects to /login', async ({ browser }) => {
    // Use a completely fresh context with no stored auth
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/dashboard');

    // Should redirect to login page
    await page.waitForURL('**/login**', { timeout: 15000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });
});
