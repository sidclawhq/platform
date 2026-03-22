import { test, expect } from '@playwright/test';
import { selectors } from '../helpers/selectors';
import { SEED_AGENTS } from '../fixtures/test-data';

test.use({ storageState: 'tests/browser/.auth/admin.json' });

test.describe('Policy Test & Version History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/policies');
    await expect(page.locator('h1', { hasText: 'Policies' })).toBeVisible({ timeout: 15000 });
    // Wait for policy cards to load
    await expect(page.locator(selectors.policies.card).first()).toBeVisible({ timeout: 15000 });
  });

  test('test policy dry-run shows result', async ({ page }) => {
    // Click "Test" on the first policy card
    const firstCard = page.locator(selectors.policies.card).first();
    await firstCard.locator(selectors.policies.testButton).click();

    // Test modal should open
    const testModal = page.locator(selectors.policies.testModal);
    await expect(testModal).toBeVisible();
    await expect(testModal.locator('text=Test Policy Evaluation')).toBeVisible();

    // The test modal should be pre-filled with values from the policy card.
    // Ensure required fields have values (agent, operation, etc.)
    // If any field is empty, fill it in.
    const agentSelect = testModal.locator('select').first();
    const agentValue = await agentSelect.inputValue();
    if (!agentValue) {
      await agentSelect.selectOption({ label: SEED_AGENTS.CUSTOMER_COMMUNICATIONS.name });
    }

    // Verify operation field is pre-filled
    const operationInput = testModal.locator('input[type="text"]').first();
    const operationValue = await operationInput.inputValue();
    if (!operationValue) {
      await operationInput.fill('send');
    }

    // Target integration
    const targetInput = testModal.locator('input[type="text"]').nth(1);
    const targetValue = await targetInput.inputValue();
    if (!targetValue) {
      await targetInput.fill('communications_service');
    }

    // Resource scope
    const scopeInput = testModal.locator('input[type="text"]').nth(2);
    const scopeValue = await scopeInput.inputValue();
    if (!scopeValue) {
      await scopeInput.fill('customer_emails');
    }

    // Data classification
    const classificationSelect = testModal.locator('select').last();
    const classificationValue = await classificationSelect.inputValue();
    if (!classificationValue) {
      await classificationSelect.selectOption('internal');
    }

    // Click "Run Test"
    await testModal.locator('button', { hasText: 'Run Test' }).click();

    // Wait for result to appear
    const testResult = page.locator(selectors.policies.testResult);
    await expect(testResult).toBeVisible({ timeout: 15000 });

    // The result should contain a decision (allow, approval_required, or deny)
    const resultText = await testResult.textContent();
    expect(resultText?.toLowerCase()).toMatch(/allow|approval.required|deny|no matching policy/);
  });

  test('version history shows changes', async ({ page }) => {
    // Click "History" on the first policy card
    const firstCard = page.locator(selectors.policies.card).first();
    await firstCard.locator(selectors.policies.historyButton).click();

    // Slide-over panel should open with version history
    await expect(page.locator('text=Version History')).toBeVisible({ timeout: 10000 });

    // Should show current version number
    await expect(page.locator('text=Current Version')).toBeVisible();
    await expect(page.locator('text=/v\\d+/')).toBeVisible();

    // Should show at least the initial version entry or "No changes recorded" message
    const hasVersions = await page.locator('text=/v\\d+.*initial|Changed by|Created by/').count();
    const hasNoChanges = await page.locator('text=No changes recorded').count();

    expect(hasVersions + hasNoChanges).toBeGreaterThan(0);
  });
});
