import { test as setup } from '@playwright/test';
import { execSync } from 'child_process';

const API_URL = 'http://localhost:4000';

setup('reset database and create test data', async () => {
  // Run migrations on database
  execSync('cd apps/api && npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  });

  // Seed database (idempotent)
  execSync('cd apps/api && npx prisma db seed', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  });
});

setup('create admin session', async ({ browser }) => {
  const page = await browser.newPage();

  // Try dev-login endpoint (auto-creates session for first admin user)
  const response = await page.goto(`${API_URL}/api/v1/auth/dev-login`);

  if (response?.ok() || response?.status() === 302) {
    // Dev login redirects to dashboard — wait for it
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  } else {
    // Fall back to email signup
    await page.goto('http://localhost:3000/signup');
    await page.fill('input[name="name"]', 'E2E Admin');
    await page.fill('input[name="email"]', 'e2e-admin@test.com');
    await page.fill('input[name="password"]', 'E2ETest2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  }

  // Save authentication state
  await page.context().storageState({ path: 'tests/browser/.auth/admin.json' });
  await page.close();
});
