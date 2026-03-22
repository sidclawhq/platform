import { test, expect, type Page } from '@playwright/test';

// Helper: wait for the demo to finish setup (loading screen disappears)
async function waitForDemoReady(page: Page) {
  await page.waitForSelector('h2:has-text("Patient Chart")', { timeout: 30000 });
}

// Helper: wait for auto-evaluations to complete
async function waitForAutoEvaluations(page: Page) {
  await expect(page.locator('text=ALLOWED').first()).toBeVisible({ timeout: 15000 });
  // Give the second evaluation a moment to arrive
  await page.waitForTimeout(2000);
}

test.describe('Demo Healthcare — MedAssist Health', () => {

  test.describe('Page Load & Layout', () => {
    test('loads at localhost:3005 with split-screen layout', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      // Left side: patient chart header
      await expect(page.getByRole('heading', { name: /Patient Chart/ })).toBeVisible();

      // Right side: governance panel
      await expect(page.getByRole('heading', { name: 'Governance Activity' })).toBeVisible();

      // Header branding
      await expect(page.getByText('SidClaw', { exact: true })).toBeVisible();
      await expect(page.getByText('Interactive Demo — Clinical AI')).toBeVisible();
    });

    test('HIPAA disclaimer visible in footer', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      await expect(page.getByText('no real PHI is stored or transmitted')).toBeVisible();
      await expect(page.getByText('Not for clinical use')).toBeVisible();
    });
  });

  test.describe('Patient Header', () => {
    test('shows patient name, DOB, MRN, physician, insurance', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      await expect(page.getByRole('heading', { name: 'Sarah Martinez' })).toBeVisible();
      await expect(page.getByText('MRN-847291', { exact: true })).toBeVisible();
      await expect(page.getByText('Dr. James Liu').first()).toBeVisible();
      await expect(page.getByText('Blue Cross Premium')).toBeVisible();
      await expect(page.getByText(/47y/).first()).toBeVisible();
    });

    test('shows allergies in red', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      await expect(page.getByText('Allergies:').first()).toBeVisible();
      const allergiesText = page.getByText('Penicillin, Sulfa drugs');
      await expect(allergiesText).toBeVisible();

      // Verify red color — #EF4444 = rgb(239, 68, 68)
      const color = await allergiesText.evaluate((el) => getComputedStyle(el).color);
      expect(color).toContain('239');
    });
  });

  test.describe('Vitals Panel', () => {
    test('shows 6 vital signs', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      await expect(page.getByText('Current Vitals')).toBeVisible();

      // Scope vitals checks to the vitals section
      const vitalsSection = page.locator('div', { hasText: 'Current Vitals' }).filter({ has: page.locator('text=SpO2') });

      await expect(vitalsSection.getByText('BP').first()).toBeVisible();
      await expect(vitalsSection.getByText('HR').first()).toBeVisible();
      await expect(vitalsSection.getByText('Temp').first()).toBeVisible();
      await expect(vitalsSection.getByText('SpO2').first()).toBeVisible();
      await expect(vitalsSection.getByText('RR').first()).toBeVisible();
      await expect(vitalsSection.getByText('BMI').first()).toBeVisible();
    });

    test('BP shows elevated status with amber color', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      // Find the BP vital inside the vitals section
      const vitalsSection = page.locator('div', { hasText: 'Current Vitals' }).filter({ has: page.locator('text=SpO2') });
      const bpValue = vitalsSection.getByText('142/88').first();
      await expect(bpValue).toBeVisible();

      // Verify amber color — #F59E0B = rgb(245, 158, 11)
      const color = await bpValue.evaluate((el) => getComputedStyle(el).color);
      expect(color).toContain('245');
    });
  });

  test.describe('Conditions List', () => {
    test('shows 3 active conditions with ICD-10 codes', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      await expect(page.getByText('Active Conditions')).toBeVisible();

      const conditionsSection = page.locator('div', { hasText: 'Active Conditions' }).filter({ has: page.locator('text=I10') });
      await expect(conditionsSection.getByText('Essential Hypertension')).toBeVisible();
      await expect(conditionsSection.getByText('(I10)')).toBeVisible();
      await expect(conditionsSection.getByText('Type 2 Diabetes Mellitus')).toBeVisible();
      await expect(conditionsSection.getByText('(E11.9)')).toBeVisible();
      // Use first() since "Hyperlipidemia" appears in both conditions and medications
      await expect(conditionsSection.getByText(/Hyperlipidemia/).first()).toBeVisible();
      await expect(conditionsSection.getByText('(E78.5)')).toBeVisible();
    });
  });

  test.describe('Medications List', () => {
    test('shows 2 current medications and antihypertensive warning', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      const medsHeading = page.getByRole('heading', { name: 'Current Medications' });
      await expect(medsHeading).toBeVisible();

      // Scope to the card containing "Current Medications" heading
      const medsCard = medsHeading.locator('..');
      await expect(medsCard.getByText('Metformin 500mg BID')).toBeVisible();
      await expect(medsCard.getByText('Atorvastatin 20mg Daily')).toBeVisible();
      await expect(medsCard.getByText('No antihypertensive prescribed')).toBeVisible();
    });
  });

  test.describe('Recent Labs', () => {
    test('shows 5 lab results with out-of-range highlighting', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      await expect(page.getByText('Recent Lab Results')).toBeVisible();

      // Lab names in the table
      const labTable = page.locator('table');
      await expect(labTable.getByText('HbA1c')).toBeVisible();
      await expect(labTable.getByText('LDL Cholesterol')).toBeVisible();
      await expect(labTable.getByText('Fasting Glucose')).toBeVisible();
      await expect(labTable.getByText('Creatinine')).toBeVisible();
      await expect(labTable.getByText('Blood Pressure (office)')).toBeVisible();

      // Verify normal creatinine shows green check
      const creatinineRow = labTable.locator('tr', { hasText: 'Creatinine' });
      await expect(creatinineRow.getByText(/normal/)).toBeVisible();
    });
  });

  test.describe('Auto-Run Evaluations', () => {
    test('generates ALLOWED traces on page load (view_chart and search_literature)', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      // Wait for governance panel to populate with auto-run evaluations
      // The auto-evaluations fire after setup, and the governance panel polls every 2s
      await expect(page.getByText('view_chart').first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText('search_literature').first()).toBeVisible({ timeout: 10000 });

      // Should have at least 2 ALLOWED traces
      const allowedCount = await page.locator('text=ALLOWED').count();
      expect(allowedCount).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Clinical Actions — Approval Required', () => {
    test('"Order CMP + HbA1c" triggers APPROVAL REQUIRED card', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);
      await waitForAutoEvaluations(page);

      // Click the order labs button
      const orderButton = page.locator('button', { hasText: 'Order comprehensive metabolic panel' });
      await expect(orderButton).toBeVisible();
      await orderButton.click();

      // Should show "Awaiting approval..." state on the button
      await expect(page.getByText('Awaiting approval...').first()).toBeVisible({ timeout: 10000 });

      // Approval card should appear on right side
      await expect(page.getByText('APPROVAL REQUIRED').first()).toBeVisible({ timeout: 10000 });

      // Activity log should show pending message
      await expect(page.getByText('Lab order pending physician approval')).toBeVisible({ timeout: 5000 });
    });

    test('"Send care plan" triggers APPROVAL REQUIRED card', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);
      await waitForAutoEvaluations(page);

      const sendButton = page.locator('button', { hasText: 'Send updated care plan' });
      await expect(sendButton).toBeVisible();
      await sendButton.click();

      await expect(page.getByText('Awaiting approval...').first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('APPROVAL REQUIRED').first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Patient communication pending review')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Clinical Actions — Denied', () => {
    test('"Prescribe Lisinopril" is immediately BLOCKED', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);
      await waitForAutoEvaluations(page);

      const prescribeButton = page.locator('button', { hasText: 'Prescribe Lisinopril' });
      await expect(prescribeButton).toBeVisible();
      await prescribeButton.click();

      // Button shows blocked state
      await expect(page.getByText('Physician must order directly').first()).toBeVisible({ timeout: 10000 });

      // Activity log shows blocked message
      await expect(page.getByText('AI cannot prescribe medications')).toBeVisible({ timeout: 5000 });

      // Governance panel shows BLOCKED trace
      await expect(page.getByText('BLOCKED').first()).toBeVisible({ timeout: 10000 });
    });

    test('"Increase Metformin" is immediately BLOCKED', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);
      await waitForAutoEvaluations(page);

      const modifyButton = page.locator('button', { hasText: 'Increase Metformin' });
      await expect(modifyButton).toBeVisible();
      await modifyButton.click();

      await expect(page.getByText('Physician must order directly').first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Treatment plan modifications require physician clinical judgment')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Approval Flow', () => {
    test('approving lab order removes approval card and shows trace', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);
      await waitForAutoEvaluations(page);

      // Trigger lab order
      const orderButton = page.locator('button', { hasText: 'Order comprehensive metabolic panel' });
      await orderButton.click();

      // Wait for approval card to appear
      await expect(page.getByText('APPROVAL REQUIRED').first()).toBeVisible({ timeout: 10000 });

      // Verify approval card has order_labs operation
      await expect(page.getByText('order_labs').first()).toBeVisible();

      // Click Approve button
      const approveButton = page.getByRole('button', { name: 'Approve' }).first();
      await expect(approveButton).toBeVisible();
      await approveButton.click();

      // After approval, the "APPROVAL REQUIRED" card should disappear
      // and the pending count should go to 0
      await expect(page.getByText('0 pending')).toBeVisible({ timeout: 15000 });

      // The order_labs trace should remain visible in the governance panel
      await expect(page.getByText('order_labs').first()).toBeVisible();
    });
  });

  test.describe('Activity Log', () => {
    test('shows initial clinical activity entries with timestamps', async ({ page }) => {
      await page.goto('/');
      await waitForDemoReady(page);

      await expect(page.getByText('Clinical Activity')).toBeVisible();
      await expect(page.getByText('Retrieved patient chart')).toBeVisible();
      await expect(page.getByText(/Reviewed vitals/)).toBeVisible();
      await expect(page.getByText(/Reviewed medications/)).toBeVisible();
      await expect(page.getByText(/Reviewed labs/)).toBeVisible();
      await expect(page.getByText('Clinical finding')).toBeVisible();
    });
  });

  test.describe('No Console Errors', () => {
    test('no CORS errors or uncaught exceptions', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().toLowerCase().includes('cors')) {
          errors.push(`CORS error: ${msg.text()}`);
        }
      });

      await page.goto('/');
      await waitForDemoReady(page);
      await waitForAutoEvaluations(page);

      // Trigger one action to exercise the proxy
      const orderButton = page.locator('button', { hasText: 'Order comprehensive metabolic panel' });
      await orderButton.click();
      await expect(page.getByText('APPROVAL REQUIRED').first()).toBeVisible({ timeout: 10000 });

      // Filter out known non-critical errors
      const criticalErrors = errors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  });
});
