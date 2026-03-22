import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: ['**/node_modules/**', '**/e2e/**'],
  timeout: 60000,
  retries: 1,
  workers: 1, // sequential — tests share state (database, sessions)
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://localhost:3000',
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
      command: 'cd apps/dashboard && npm run dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: 'global-setup.ts',
    },
    {
      name: 'e2e',
      dependencies: ['setup'],
      testMatch: 'specs/**/*.spec.ts',
    },
  ],
});
