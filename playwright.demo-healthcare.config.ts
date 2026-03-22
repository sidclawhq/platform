import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser/specs/demo',
  testMatch: 'demo-healthcare.spec.ts',
  timeout: 60000,
  retries: 1,
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://localhost:3005',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: 'cd apps/api && npm run dev',
      port: 4000,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'cd apps/demo-healthcare && npm run dev',
      port: 3005,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
