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
  // In CI the Next.js apps run PRODUCTION builds: dev servers compile each
  // page on first hit, and on a 2-core runner those compiles blow the 30s
  // selector timeouts (validation run 30460483491: 35 timeout failures that
  // never reproduce locally). The API keeps its dev server everywhere — tsx
  // has no per-page compile step.
  webServer: [
    {
      command: 'cd apps/api && npm run dev',
      port: 4000,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      // NODE_ENV=production explicitly: the CI job exports
      // NODE_ENV=development for the API's dev auth bypass, and `next build`
      // under development NODE_ENV prerenders with the dev React runtime and
      // dies on /404 with the misleading '<Html> imported outside _document'
      // error (validation run 30464116024).
      command: process.env.CI
        ? 'cd apps/dashboard && NODE_ENV=production npm run build && NODE_ENV=production npm run start'
        : 'cd apps/dashboard && npm run dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: process.env.CI ? 420000 : 30000,
    },
    {
      // The landing-page specs (01-*) target the landing app directly.
      command: process.env.CI
        ? 'cd apps/landing && NODE_ENV=production npm run build && NODE_ENV=production npm run start'
        : 'cd apps/landing && npm run dev',
      port: 3002,
      reuseExistingServer: true,
      timeout: process.env.CI ? 420000 : 60000,
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
      // The demo specs target the vertical demo apps (ports 3003-3005),
      // which this config does not manage. Run them explicitly with the
      // demo apps up: npx playwright test --project=demos
      testIgnore: 'specs/demo/**',
    },
    {
      name: 'demos',
      dependencies: ['setup'],
      testMatch: 'specs/demo/**/*.spec.ts',
    },
  ],
});
