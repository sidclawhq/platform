import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Settings — Webhooks', () => {
  test('create webhook shows secret text after submission', async ({ page }) => {
    await page.goto('/dashboard/settings/webhooks');

    // Wait for the page heading
    await page.waitForSelector('h1', { timeout: 15000 });
    await expect(page.locator('h1', { hasText: 'Webhooks' })).toBeVisible();

    // Click "Create Webhook" button
    const createButton = page.locator('button', { hasText: 'Create Webhook' });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // The create modal should appear
    const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Create Webhook' });
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in the webhook URL
    const urlInput = modal.locator('input[type="text"]').first();
    await urlInput.fill('https://httpbin.org/post');

    // Select at least one event — click the "Approvals" category to select all approval events
    const approvalsCategory = modal.locator('button', { hasText: 'Approvals' });
    await approvalsCategory.click();

    // Click the Create button
    const createSubmit = modal.locator('button', { hasText: 'Create' }).last();
    await createSubmit.click();

    // After creation, a secret dialog should appear
    // The dialog contains "Webhook Secret" heading and the actual secret value
    const secretDialog = page.locator('.fixed.inset-0').filter({ hasText: 'Webhook Secret' });
    await expect(secretDialog).toBeVisible({ timeout: 10000 });

    // Verify "secret" text is visible in the dialog (either heading or content)
    await expect(secretDialog.locator('text=Webhook Secret')).toBeVisible();

    // The secret value should be displayed in a code element
    const secretCode = secretDialog.locator('code');
    await expect(secretCode).toBeVisible();
    const secretText = await secretCode.textContent();
    expect(secretText).toBeTruthy();
    expect(secretText!.length).toBeGreaterThan(10);

    // Close the dialog
    const doneButton = secretDialog.locator('button', { hasText: 'Done' });
    await doneButton.click();

    // Verify the dialog closes
    await expect(secretDialog).not.toBeVisible({ timeout: 5000 });
  });
});
