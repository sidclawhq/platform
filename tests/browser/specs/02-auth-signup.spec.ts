import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

// NO storageState — we are testing unauthenticated auth flows

test.describe('Signup Flow', () => {
  test('signup page renders with GitHub/Google OAuth buttons and email/password form', async ({ page }) => {
    await page.goto('/signup');

    // Page title
    await expect(page.locator('h1', { hasText: 'Create your account' })).toBeVisible();

    // OAuth buttons
    const githubButton = page.locator('button', { hasText: 'Continue with GitHub' });
    const googleButton = page.locator('button', { hasText: 'Continue with Google' });
    await expect(githubButton).toBeVisible();
    await expect(googleButton).toBeVisible();

    // Email/password form fields
    await expect(page.locator(selectors.auth.nameInput)).toBeVisible();
    await expect(page.locator(selectors.auth.emailInput)).toBeVisible();
    await expect(page.locator(selectors.auth.passwordInput)).toBeVisible();
    await expect(page.locator(selectors.auth.submitButton)).toBeVisible();
  });

  test('email signup creates account and redirects to dashboard', async ({ page }) => {
    const uniqueEmail = `signup-test-${Date.now()}@test.com`;

    await page.goto('/signup');

    await page.fill(selectors.auth.nameInput, 'Test Signup User');
    await page.fill(selectors.auth.emailInput, uniqueEmail);
    await page.fill(selectors.auth.passwordInput, 'SecurePass2026!');
    await page.click(selectors.auth.submitButton);

    // Should redirect to dashboard after successful signup
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('rejects duplicate email', async ({ page }) => {
    const duplicateEmail = `dup-test-${Date.now()}@test.com`;

    // First signup — should succeed
    await page.goto('/signup');
    await page.fill(selectors.auth.nameInput, 'First User');
    await page.fill(selectors.auth.emailInput, duplicateEmail);
    await page.fill(selectors.auth.passwordInput, 'SecurePass2026!');
    await page.click(selectors.auth.submitButton);
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // Open a new context to avoid carrying the session
    const secondContext = await page.context().browser()!.newContext();
    const secondPage = await secondContext.newPage();

    // Second signup with same email — should show error
    await secondPage.goto('/signup');
    await secondPage.fill(selectors.auth.nameInput, 'Second User');
    await secondPage.fill(selectors.auth.emailInput, duplicateEmail);
    await secondPage.fill(selectors.auth.passwordInput, 'AnotherPass2026!');
    await secondPage.click(selectors.auth.submitButton);

    // Should show error message (not redirect to dashboard)
    const errorBanner = secondPage.locator('text=already exists').or(
      secondPage.locator('[class*="accent-red"], [class*="EF4444"]').first()
    );
    await expect(errorBanner).toBeVisible({ timeout: 10000 });

    await secondContext.close();
  });

  test('rejects weak password (3 chars)', async ({ page }) => {
    await page.goto('/signup');

    await page.fill(selectors.auth.nameInput, 'Weak Pass User');
    await page.fill(selectors.auth.emailInput, `weak-pass-${Date.now()}@test.com`);
    await page.fill(selectors.auth.passwordInput, 'abc');
    await page.click(selectors.auth.submitButton);

    // The HTML5 minLength=8 validation should prevent submission, or the server
    // should return an error. Either way, we should NOT end up at /dashboard.
    // Wait briefly to see if any navigation happens
    await page.waitForTimeout(2000);

    // Should still be on signup page
    expect(page.url()).toContain('/signup');
  });

  test('"Sign in" link navigates to login page', async ({ page }) => {
    await page.goto('/signup');

    const signInLink = page.locator('a', { hasText: 'Sign in' });
    await expect(signInLink).toBeVisible();
    await signInLink.click();

    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });
});
