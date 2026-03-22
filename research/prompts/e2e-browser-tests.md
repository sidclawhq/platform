# Task: Comprehensive End-to-End Browser Tests

## Context

You are working on the **Agent Identity & Approval Layer** project (brand: **SidClaw**). Read these files first:

1. `research/2026-03-20-product-development-plan.md` — Overview and CC.3 (Testing Strategy).
2. `apps/dashboard/src/app/` — all dashboard pages.
3. `apps/api/src/routes/` — all API routes (to understand what the dashboard calls).
4. `tests/e2e/` — existing E2E tests (API-level only, no browser tests).

The platform has 589 backend tests but **zero automated browser tests**. This gap allowed a CSRF token bug to reach production. Your job is to create a comprehensive Playwright E2E browser test suite that tests the full stack — dashboard UI → API → database — through the browser, exactly as a real user would.

## Setup

### 1. Install Playwright

```bash
# At the project root
npm install --save-dev @playwright/test
npx playwright install chromium  # just chromium, not all browsers
```

### 2. Playwright Config

Create `playwright.config.ts` at the project root:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  retries: 1,
  workers: 1,  // sequential — tests share state (database, sessions)
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
      testMatch: /global-setup\.ts/,
    },
    {
      name: 'e2e',
      dependencies: ['setup'],
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
```

### 3. Directory Structure

```
tests/browser/
  global-setup.ts                    # Database reset + seed + login state
  helpers/
    auth.ts                          # Login helper, session management
    api.ts                           # Direct API helpers for test setup
    selectors.ts                     # Reusable CSS selectors
    assertions.ts                    # Custom assertion helpers
  fixtures/
    test-data.ts                     # Test data constants
  specs/
    01-landing-page.spec.ts
    02-auth-signup.spec.ts
    03-auth-login.spec.ts
    04-dashboard-overview.spec.ts
    05-agents-registry.spec.ts
    06-agents-detail.spec.ts
    07-agents-lifecycle.spec.ts
    08-policies-list.spec.ts
    09-policies-create-edit.spec.ts
    10-policies-test-versions.spec.ts
    11-approvals-queue.spec.ts
    12-approvals-detail-approve.spec.ts
    13-approvals-detail-deny.spec.ts
    14-traces-list.spec.ts
    15-traces-detail.spec.ts
    16-traces-export.spec.ts
    17-settings-general.spec.ts
    18-settings-users.spec.ts
    19-settings-api-keys.spec.ts
    20-settings-webhooks.spec.ts
    21-settings-audit-export.spec.ts
    22-search.spec.ts
    23-architecture.spec.ts
    24-full-governance-flow.spec.ts
    25-csrf-protection.spec.ts
    26-rbac-viewer.spec.ts
    27-rbac-reviewer.spec.ts
    28-navigation.spec.ts
    29-error-handling.spec.ts
    30-responsive.spec.ts
```

### 4. Global Setup (`global-setup.ts`)

```typescript
import { test as setup } from '@playwright/test';
import { execSync } from 'child_process';

const API_URL = 'http://localhost:4000';

setup('reset database and create test data', async ({ }) => {
  // Run migrations on test database
  execSync('cd apps/api && npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  });

  // Seed database
  execSync('cd apps/api && npx prisma db seed', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  });
});

setup('create admin session', async ({ browser }) => {
  const page = await browser.newPage();

  // Log in via dev-login or signup
  await page.goto('http://localhost:3000/login');

  // Dev mode: there should be a dev-login flow
  // Try navigating to the dev-login endpoint directly
  const response = await page.goto(`${API_URL}/api/v1/auth/dev-login`);
  if (response?.ok()) {
    // Dev login worked — should redirect to dashboard
    await page.waitForURL('**/dashboard**');
  } else {
    // Fall back to email signup
    await page.goto('http://localhost:3000/signup');
    await page.fill('input[name="name"]', 'E2E Admin');
    await page.fill('input[name="email"]', 'e2e-admin@test.com');
    await page.fill('input[name="password"]', 'E2ETest2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  }

  // Save authentication state
  await page.context().storageState({ path: 'tests/browser/.auth/admin.json' });
  await page.close();
});
```

### 5. Auth Helper (`helpers/auth.ts`)

```typescript
import { Page, BrowserContext } from '@playwright/test';

const API_URL = 'http://localhost:4000';

export async function loginAsAdmin(page: Page) {
  // Use stored auth state
  // This is set up via the global setup
}

export async function loginAsNewUser(page: Page, name: string, email: string, password: string) {
  await page.goto('http://localhost:3000/signup');
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**');
}

export async function getApiKey(page: Page): Promise<string> {
  // Navigate to settings, create API key, extract the raw key
  await page.goto('http://localhost:3000/dashboard/settings/api-keys');
  // ... interact with the create key UI
  // Return the raw key value
  return '';
}
```

### 6. API Helper (`helpers/api.ts`)

```typescript
// Direct API calls for test data setup (faster than UI for preconditions)
const API_URL = 'http://localhost:4000';

export async function createAgentViaAPI(apiKey: string, data: {
  name: string;
  description: string;
  owner_name: string;
  owner_role: string;
  team: string;
  authority_model: string;
  identity_mode: string;
  delegation_model: string;
  autonomy_tier?: string;
}) {
  const res = await fetch(`${API_URL}/api/v1/agents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...data, created_by: 'e2e-test' }),
  });
  if (!res.ok) throw new Error(`Create agent failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createPolicyViaAPI(apiKey: string, data: {
  agent_id: string;
  policy_name: string;
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  policy_effect: string;
  rationale: string;
  priority?: number;
}) {
  const res = await fetch(`${API_URL}/api/v1/policies`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...data, modified_by: 'e2e-test' }),
  });
  if (!res.ok) throw new Error(`Create policy failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function evaluateViaAPI(apiKey: string, data: {
  agent_id: string;
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  context?: Record<string, unknown>;
}) {
  const res = await fetch(`${API_URL}/api/v1/evaluate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Evaluate failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getDevApiKey(): Promise<string> {
  // Read from deployment/.env.development
  const fs = await import('fs');
  const env = fs.readFileSync('deployment/.env.development', 'utf-8');
  const match = env.match(/AGENT_IDENTITY_API_KEY=(.+)/);
  if (!match) throw new Error('Dev API key not found');
  return match[1].trim();
}
```

### 7. Selectors (`helpers/selectors.ts`)

```typescript
// Centralized selectors — update here when UI changes instead of across all tests

export const selectors = {
  // Navigation
  sidebar: {
    overview: 'a[href="/dashboard"]',
    agents: 'a[href="/dashboard/agents"]',
    policies: 'a[href="/dashboard/policies"]',
    approvals: 'a[href="/dashboard/approvals"]',
    audit: 'a[href="/dashboard/audit"]',
    architecture: 'a[href="/dashboard/architecture"]',
    settings: 'a[href="/dashboard/settings"]',
    pendingBadge: '[data-testid="pending-approval-badge"]',
  },

  // Auth
  auth: {
    nameInput: 'input[name="name"]',
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    githubButton: '[data-testid="github-oauth"]',
    googleButton: '[data-testid="google-oauth"]',
    logoutButton: '[data-testid="logout"]',
  },

  // Agents
  agents: {
    createButton: '[data-testid="create-agent"]',
    table: '[data-testid="agent-table"]',
    row: '[data-testid="agent-row"]',
    nameInput: 'input[name="name"]',
    descriptionInput: 'textarea[name="description"]',
    ownerNameInput: 'input[name="owner_name"]',
    ownerRoleInput: 'input[name="owner_role"]',
    teamInput: 'input[name="team"]',
    suspendButton: '[data-testid="suspend-agent"]',
    revokeButton: '[data-testid="revoke-agent"]',
    reactivateButton: '[data-testid="reactivate-agent"]',
    confirmDialog: '[data-testid="confirm-dialog"]',
    confirmButton: '[data-testid="confirm-action"]',
    lifecycleBadge: '[data-testid="lifecycle-badge"]',
  },

  // Policies
  policies: {
    createButton: '[data-testid="create-policy"]',
    card: '[data-testid="policy-card"]',
    editButton: '[data-testid="edit-policy"]',
    deactivateButton: '[data-testid="deactivate-policy"]',
    testButton: '[data-testid="test-policy"]',
    historyButton: '[data-testid="policy-history"]',
    effectBadge: '[data-testid="effect-badge"]',
    editorModal: '[data-testid="policy-editor"]',
    testModal: '[data-testid="policy-test-modal"]',
    testResult: '[data-testid="policy-test-result"]',
  },

  // Approvals
  approvals: {
    queueCard: '[data-testid="approval-card"]',
    detailPanel: '[data-testid="approval-detail"]',
    approveButton: '[data-testid="approve-button"]',
    denyButton: '[data-testid="deny-button"]',
    noteInput: '[data-testid="reviewer-note"]',
    riskBadge: '[data-testid="risk-badge"]',
    staleBadge: '[data-testid="stale-badge"]',
    whyFlagged: '[data-testid="why-flagged"]',
    sortDropdown: '[data-testid="sort-dropdown"]',
  },

  // Traces
  traces: {
    list: '[data-testid="trace-list"]',
    listItem: '[data-testid="trace-item"]',
    detail: '[data-testid="trace-detail"]',
    eventTimeline: '[data-testid="event-timeline"]',
    eventRow: '[data-testid="event-row"]',
    exportJsonButton: '[data-testid="export-json"]',
    exportCsvButton: '[data-testid="export-csv"]',
    integrityBadge: '[data-testid="integrity-badge"]',
    outcomeBadge: '[data-testid="outcome-badge"]',
  },

  // Settings
  settings: {
    generalTab: 'a[href="/dashboard/settings/general"]',
    usersTab: 'a[href="/dashboard/settings/users"]',
    apiKeysTab: 'a[href="/dashboard/settings/api-keys"]',
    webhooksTab: 'a[href="/dashboard/settings/webhooks"]',
    auditExportTab: 'a[href="/dashboard/settings/audit-export"]',
    saveButton: '[data-testid="save-settings"]',
    createKeyButton: '[data-testid="create-api-key"]',
    keyDialog: '[data-testid="api-key-dialog"]',
    rawKeyValue: '[data-testid="raw-key-value"]',
    rotateKeyButton: '[data-testid="rotate-key"]',
    deleteKeyButton: '[data-testid="delete-key"]',
  },

  // Search
  search: {
    input: '[data-testid="global-search"]',
    results: '[data-testid="search-results"]',
    resultItem: '[data-testid="search-result-item"]',
  },

  // Common
  common: {
    toast: '[data-sonner-toast]',
    loadingSpinner: '[data-testid="loading"]',
    emptyState: '[data-testid="empty-state"]',
    breadcrumbs: '[data-testid="breadcrumbs"]',
  },
};
```

**IMPORTANT:** The selectors above use `data-testid` attributes. The dashboard components may not have these yet. **You must add `data-testid` attributes to the dashboard components** where needed. Search the dashboard source for each component referenced in the selectors and add the appropriate `data-testid`. For example:

```tsx
// Before:
<button onClick={handleApprove} className="...">Approve</button>

// After:
<button onClick={handleApprove} className="..." data-testid="approve-button">Approve</button>
```

Add `data-testid` attributes to ALL components listed in the selectors object above. This is the only code modification allowed in this task — and it's essential for reliable test selectors.

---

## Test Specifications

### `01-landing-page.spec.ts` — Landing Page

```typescript
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('loads with all 9 sections', async ({ page }) => {
    await page.goto('http://localhost:3002');
    // Hero
    await expect(page.locator('h1')).toContainText(/approval|accountability|agentic/i);
    // CTA buttons
    await expect(page.locator('text=Get Started Free')).toBeVisible();
    await expect(page.locator('text=View on GitHub')).toBeVisible();
    // npm install
    await expect(page.locator('text=npm install @sidclaw/sdk')).toBeVisible();
  });

  test('Get Started Free links to signup', async ({ page }) => {
    await page.goto('http://localhost:3002');
    const link = page.locator('text=Get Started Free').first();
    const href = await link.getAttribute('href');
    expect(href).toContain('signup');
  });

  test('View on GitHub links to correct repo', async ({ page }) => {
    await page.goto('http://localhost:3002');
    const link = page.locator('text=View on GitHub').first();
    const href = await link.getAttribute('href');
    expect(href).toContain('github.com/sidclawhq');
  });

  test('pricing section shows free tier limits', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await expect(page.locator('text=5 agents')).toBeVisible();
  });

  test('has dark theme (#0A0A0B background)', async ({ page }) => {
    await page.goto('http://localhost:3002');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Should be near-black
    expect(bg).toMatch(/rgb\(10,\s*10,\s*11\)|#0[aA]0[aA]0[bB]/);
  });

  test('is responsive at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:3002');
    await expect(page.locator('h1')).toBeVisible();
    // No horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // small tolerance
  });

  test('stats cite NeuralTrust source', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await expect(page.locator('text=NeuralTrust')).toBeVisible();
  });
});
```

### `02-auth-signup.spec.ts` — Signup Flow

```typescript
test.describe('Signup', () => {
  test('signup page renders with all providers', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('text=GitHub')).toBeVisible();
    await expect(page.locator('text=Google')).toBeVisible();
    await expect(page.locator(selectors.auth.emailInput)).toBeVisible();
    await expect(page.locator(selectors.auth.passwordInput)).toBeVisible();
  });

  test('email signup creates account and redirects to dashboard', async ({ page }) => {
    await page.goto('/signup');
    await page.fill(selectors.auth.nameInput, 'Signup Test');
    await page.fill(selectors.auth.emailInput, `signup-${Date.now()}@test.com`);
    await page.fill(selectors.auth.passwordInput, 'TestPass2026!');
    await page.click(selectors.auth.submitButton);
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('rejects duplicate email', async ({ page }) => {
    const email = `dup-${Date.now()}@test.com`;
    // First signup
    await page.goto('/signup');
    await page.fill(selectors.auth.nameInput, 'First');
    await page.fill(selectors.auth.emailInput, email);
    await page.fill(selectors.auth.passwordInput, 'TestPass2026!');
    await page.click(selectors.auth.submitButton);
    await page.waitForURL('**/dashboard**');

    // Logout
    await page.goto('/login');

    // Second signup with same email
    await page.goto('/signup');
    await page.fill(selectors.auth.nameInput, 'Second');
    await page.fill(selectors.auth.emailInput, email);
    await page.fill(selectors.auth.passwordInput, 'TestPass2026!');
    await page.click(selectors.auth.submitButton);
    // Should show error, not redirect
    await expect(page.locator('text=already exists')).toBeVisible({ timeout: 5000 });
  });

  test('rejects weak password', async ({ page }) => {
    await page.goto('/signup');
    await page.fill(selectors.auth.nameInput, 'Weak Pass');
    await page.fill(selectors.auth.emailInput, `weak-${Date.now()}@test.com`);
    await page.fill(selectors.auth.passwordInput, '123');
    await page.click(selectors.auth.submitButton);
    await expect(page.locator('text=8 characters')).toBeVisible({ timeout: 5000 });
  });

  test('sign in link navigates to login page', async ({ page }) => {
    await page.goto('/signup');
    await page.click('text=Sign in');
    await expect(page).toHaveURL(/login/);
  });
});
```

### `03-auth-login.spec.ts` — Login Flow

```typescript
test.describe('Login', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Sign in')).toBeVisible();
  });

  test('shows expired message when redirected with expired=true', async ({ page }) => {
    await page.goto('/login?expired=true');
    await expect(page.locator('text=expired')).toBeVisible();
  });

  test('sign up link navigates to signup page', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Sign up');
    await expect(page).toHaveURL(/signup/);
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    // Create user first via signup
    const email = `login-${Date.now()}@test.com`;
    await page.goto('/signup');
    await page.fill(selectors.auth.nameInput, 'Login Test');
    await page.fill(selectors.auth.emailInput, email);
    await page.fill(selectors.auth.passwordInput, 'TestPass2026!');
    await page.click(selectors.auth.submitButton);
    await page.waitForURL('**/dashboard**');

    // Logout
    // Navigate to login
    await page.goto('/login');

    // Login with email/password (if the login page has email/password form)
    await page.fill(selectors.auth.emailInput, email);
    await page.fill(selectors.auth.passwordInput, 'TestPass2026!');
    await page.click(selectors.auth.submitButton);
    await page.waitForURL('**/dashboard**');
  });

  test('unauthenticated access to dashboard redirects to login', async ({ browser }) => {
    // New context without stored auth
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForURL('**/login**', { timeout: 10000 });
    await context.close();
  });
});
```

### `04-dashboard-overview.spec.ts` — Overview

```typescript
test.describe('Dashboard Overview', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('shows stat cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Agents')).toBeVisible();
    await expect(page.locator('text=Policies')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
  });

  test('system health shows all green', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Healthy')).toBeVisible();
  });

  test('pending approvals list is clickable', async ({ page }) => {
    await page.goto('/dashboard');
    const link = page.locator('text=View all approvals');
    if (await link.isVisible()) {
      await link.click();
      await expect(page).toHaveURL(/approvals/);
    }
  });

  test('recent traces list is clickable', async ({ page }) => {
    await page.goto('/dashboard');
    const link = page.locator('text=View all traces');
    if (await link.isVisible()) {
      await link.click();
      await expect(page).toHaveURL(/audit/);
    }
  });
});
```

### `05-agents-registry.spec.ts` — Agent Registry

```typescript
test.describe('Agent Registry', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('loads agent list', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.waitForSelector(selectors.agents.table, { timeout: 10000 });
  });

  test('shows seed agents', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await expect(page.locator('text=Customer Communications Agent')).toBeVisible();
    await expect(page.locator('text=Internal Knowledge Retrieval Agent')).toBeVisible();
    await expect(page.locator('text=Case Operations Agent')).toBeVisible();
  });

  test('filter by environment', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.selectOption('select[name="environment"]', 'prod');
    // Should still show agents (seed agents are prod)
    await expect(page.locator(selectors.agents.row).first()).toBeVisible();

    await page.selectOption('select[name="environment"]', 'dev');
    // May show empty state or fewer agents
  });

  test('filter by lifecycle state', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.selectOption('select[name="lifecycle_state"]', 'suspended');
    // Should show empty state (no suspended seed agents)
    await expect(page.locator(selectors.common.emptyState)).toBeVisible();
  });

  test('search by agent name', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.fill('input[placeholder*="Search"]', 'Customer');
    await page.waitForTimeout(500); // debounce
    await expect(page.locator('text=Customer Communications Agent')).toBeVisible();
    await expect(page.locator('text=Case Operations Agent')).not.toBeVisible();
  });

  test('click agent row navigates to detail', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.click('text=Customer Communications Agent');
    await expect(page).toHaveURL(/agents\/.+/);
  });
});
```

### `06-agents-detail.spec.ts` — Agent Detail

```typescript
test.describe('Agent Detail', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('shows all 6 sections', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.click('text=Customer Communications Agent');
    await page.waitForURL(/agents\/.+/);

    // Overview section
    await expect(page.locator('text=Sarah Chen')).toBeVisible();
    // Authority section
    await expect(page.locator('text=hybrid')).toBeVisible();
    // Integrations
    await expect(page.locator('text=Communications Service')).toBeVisible();
    // Policy summary
    await expect(page.locator('text=Allow')).toBeVisible();
    // Lifecycle controls
    await expect(page.locator(selectors.agents.suspendButton)).toBeVisible();
  });

  test('policy summary links to filtered policies page', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.click('text=Customer Communications Agent');
    await page.waitForURL(/agents\/.+/);

    await page.click('text=View all policies');
    await expect(page).toHaveURL(/policies\?agent_id=/);
  });

  test('shows lifecycle badge with correct status', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.click('text=Customer Communications Agent');
    await page.waitForURL(/agents\/.+/);

    await expect(page.locator(selectors.agents.lifecycleBadge)).toContainText('Active');
  });
});
```

### `07-agents-lifecycle.spec.ts` — Agent Lifecycle

```typescript
test.describe('Agent Lifecycle', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  let agentId: string;

  test.beforeAll(async () => {
    // Create a test agent via API for lifecycle testing
    const apiKey = await getDevApiKey();
    const result = await createAgentViaAPI(apiKey, {
      name: 'Lifecycle Test Agent',
      description: 'Agent for lifecycle E2E tests',
      owner_name: 'Test Owner',
      owner_role: 'Test Role',
      team: 'Test Team',
      authority_model: 'self',
      identity_mode: 'service_identity',
      delegation_model: 'self',
    });
    agentId = result.data.id;
  });

  test('suspend agent shows confirmation and updates state', async ({ page }) => {
    await page.goto(`/dashboard/agents/${agentId}`);
    await page.click(selectors.agents.suspendButton);

    // Confirmation dialog
    await expect(page.locator(selectors.agents.confirmDialog)).toBeVisible();
    await expect(page.locator('text=Suspend')).toBeVisible();
    await page.click(selectors.agents.confirmButton);

    // Toast
    await expect(page.locator(selectors.common.toast)).toBeVisible();

    // Badge updates
    await expect(page.locator(selectors.agents.lifecycleBadge)).toContainText('Suspended');

    // Suspend button gone, reactivate appears
    await expect(page.locator(selectors.agents.suspendButton)).not.toBeVisible();
    await expect(page.locator(selectors.agents.reactivateButton)).toBeVisible();
  });

  test('reactivate agent restores to active', async ({ page }) => {
    await page.goto(`/dashboard/agents/${agentId}`);
    await page.click(selectors.agents.reactivateButton);
    await page.click(selectors.agents.confirmButton);

    await expect(page.locator(selectors.agents.lifecycleBadge)).toContainText('Active');
    await expect(page.locator(selectors.agents.suspendButton)).toBeVisible();
  });

  test('revoke agent is permanent', async ({ page }) => {
    await page.goto(`/dashboard/agents/${agentId}`);
    await page.click(selectors.agents.revokeButton);

    await expect(page.locator('text=permanent')).toBeVisible();
    await page.click(selectors.agents.confirmButton);

    await expect(page.locator(selectors.agents.lifecycleBadge)).toContainText('Revoked');
    // No action buttons
    await expect(page.locator(selectors.agents.suspendButton)).not.toBeVisible();
    await expect(page.locator(selectors.agents.revokeButton)).not.toBeVisible();
    await expect(page.locator(selectors.agents.reactivateButton)).not.toBeVisible();
  });
});
```

### `08-policies-list.spec.ts` — Policy List

```typescript
test.describe('Policy List', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('shows policies grouped by agent', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await expect(page.locator('text=Customer Communications Agent')).toBeVisible();
    await expect(page.locator(selectors.policies.card).first()).toBeVisible();
  });

  test('effect badges have correct colors', async ({ page }) => {
    await page.goto('/dashboard/policies');
    // Check for all three effect types
    await expect(page.locator('text=allow').first()).toBeVisible();
    await expect(page.locator('text=approval_required').first()).toBeVisible();
    await expect(page.locator('text=deny').first()).toBeVisible();
  });

  test('filter by agent', async ({ page }) => {
    await page.goto('/dashboard/policies');
    // Select agent filter
    await page.selectOption('select[name="agent"]', { label: /Customer Communications/i });
    await page.waitForTimeout(500);
    // Should show only policies for this agent
  });

  test('filter by effect', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await page.selectOption('select[name="effect"]', 'deny');
    await page.waitForTimeout(500);
    // All visible policies should be deny
  });

  test('URL param agent_id pre-filters', async ({ page }) => {
    // Get agent ID from seed data
    const apiKey = await getDevApiKey();
    const agents = await fetch('http://localhost:4000/api/v1/agents', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }).then(r => r.json());
    const agentId = agents.data[0].id;

    await page.goto(`/dashboard/policies?agent_id=${agentId}`);
    await page.waitForTimeout(1000);
    // Should show filtered policies
  });
});
```

### `09-policies-create-edit.spec.ts` — Policy Create & Edit

```typescript
test.describe('Policy Create & Edit', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('create policy via modal', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await page.click(selectors.policies.createButton);

    // Modal appears
    await expect(page.locator(selectors.policies.editorModal)).toBeVisible();

    // Fill form
    await page.selectOption('select[name="agent_id"]', { index: 1 }); // first agent
    await page.fill('input[name="policy_name"]', 'E2E Test Policy');
    await page.fill('input[name="operation"]', 'e2e_test_op');
    await page.fill('input[name="target_integration"]', 'e2e_test_service');
    await page.fill('input[name="resource_scope"]', 'e2e_data');
    await page.selectOption('select[name="data_classification"]', 'internal');
    await page.selectOption('select[name="effect"]', 'allow');
    await page.fill('textarea[name="rationale"]', 'E2E test policy created by automated browser tests to verify policy creation workflow.');

    // Submit
    await page.click('button:text("Save")');

    // Toast and refresh
    await expect(page.locator(selectors.common.toast)).toBeVisible();
    await expect(page.locator('text=E2E Test Policy')).toBeVisible();
  });

  test('rationale is required (shows error without it)', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await page.click(selectors.policies.createButton);
    await page.selectOption('select[name="agent_id"]', { index: 1 });
    await page.fill('input[name="policy_name"]', 'No Rationale');
    await page.fill('input[name="operation"]', 'test');
    await page.fill('input[name="target_integration"]', 'test');
    await page.fill('input[name="resource_scope"]', 'test');
    await page.selectOption('select[name="data_classification"]', 'internal');
    await page.selectOption('select[name="effect"]', 'allow');
    // Don't fill rationale
    await page.click('button:text("Save")');

    // Should show validation error
    await expect(page.locator('text=rationale')).toBeVisible();
  });

  test('max_session_ttl only shown for approval_required', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await page.click(selectors.policies.createButton);

    // Select allow — TTL should be hidden
    await page.selectOption('select[name="effect"]', 'allow');
    await expect(page.locator('input[name="max_session_ttl"]')).not.toBeVisible();

    // Select approval_required — TTL should appear
    await page.selectOption('select[name="effect"]', 'approval_required');
    await expect(page.locator('input[name="max_session_ttl"]')).toBeVisible();
  });

  test('edit policy updates version', async ({ page }) => {
    await page.goto('/dashboard/policies');
    const editButton = page.locator(selectors.policies.editButton).first();
    await editButton.click();

    await expect(page.locator(selectors.policies.editorModal)).toBeVisible();
    // Change priority
    await page.fill('input[name="priority"]', '200');
    await page.click('button:text("Save")');

    await expect(page.locator(selectors.common.toast)).toBeVisible();
    // Version should increment
  });

  test('deactivate policy removes from list', async ({ page }) => {
    await page.goto('/dashboard/policies');
    const policyText = await page.locator(selectors.policies.card).last().textContent();
    await page.locator(selectors.policies.deactivateButton).last().click();

    // Confirmation
    await page.click('button:text("Confirm")');
    await expect(page.locator(selectors.common.toast)).toBeVisible();
  });
});
```

### `10-policies-test-versions.spec.ts` — Policy Test & Versions

```typescript
test.describe('Policy Test & Versions', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('test policy dry-run shows result', async ({ page }) => {
    await page.goto('/dashboard/policies');

    // Click test button on a policy card
    await page.locator(selectors.policies.testButton).first().click();
    await expect(page.locator(selectors.policies.testModal)).toBeVisible();

    // Run test with pre-filled values
    await page.click('button:text("Run Test")');

    // Result should appear
    await expect(page.locator(selectors.policies.testResult)).toBeVisible({ timeout: 5000 });
    // Should show an effect badge (allow, approval_required, or deny)
  });

  test('version history shows changes', async ({ page }) => {
    await page.goto('/dashboard/policies');

    // Click history on a policy that was edited
    await page.locator(selectors.policies.historyButton).first().click();

    // Version history panel should appear
    // May show "No changes recorded" for unedited policies, or version entries for edited ones
    await page.waitForTimeout(1000);
  });
});
```

### `11-approvals-queue.spec.ts` — Approval Queue

```typescript
test.describe('Approval Queue', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('shows pending approvals from seed data', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    // Seed data has 2 pending approvals
    await expect(page.locator(selectors.approvals.queueCard).first()).toBeVisible({ timeout: 10000 });
  });

  test('cards show agent name, operation, classification', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);
    const card = page.locator(selectors.approvals.queueCard).first();
    await expect(card).toBeVisible();
    // Card should contain some text about the operation
  });

  test('sort dropdown works', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.sortDropdown);
    await page.selectOption(selectors.approvals.sortDropdown, 'risk');
    await page.waitForTimeout(500);
    // Page should not error
  });

  test('clicking card opens detail panel', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);
    await page.locator(selectors.approvals.queueCard).first().click();
    await expect(page.locator(selectors.approvals.detailPanel)).toBeVisible();
  });

  test('pending count badge in sidebar matches queue count', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);
    const cardCount = await page.locator(selectors.approvals.queueCard).count();

    const badge = page.locator(selectors.sidebar.pendingBadge);
    if (await badge.isVisible()) {
      const badgeText = await badge.textContent();
      expect(parseInt(badgeText ?? '0')).toBeGreaterThanOrEqual(cardCount);
    }
  });
});
```

### `12-approvals-detail-approve.spec.ts` — Approve Flow

```typescript
test.describe('Approval - Approve Flow', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  let approvalId: string;

  test.beforeAll(async () => {
    // Create an agent, policy, and trigger an evaluation that requires approval
    const apiKey = await getDevApiKey();
    const agent = await createAgentViaAPI(apiKey, {
      name: 'Approve Flow Test Agent',
      description: 'For testing approval flow',
      owner_name: 'Agent Owner',
      owner_role: 'Engineering',
      team: 'Platform',
      authority_model: 'self',
      identity_mode: 'service_identity',
      delegation_model: 'self',
    });

    await createPolicyViaAPI(apiKey, {
      agent_id: agent.data.id,
      policy_name: 'Require approval',
      operation: 'approve_test',
      target_integration: 'test_service',
      resource_scope: 'test_data',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Testing the approval flow requires human review for verification.',
    });

    const evaluation = await evaluateViaAPI(apiKey, {
      agent_id: agent.data.id,
      operation: 'approve_test',
      target_integration: 'test_service',
      resource_scope: 'test_data',
      data_classification: 'confidential',
      context: { test: true, reason: 'E2E approval flow test' },
    });

    approvalId = evaluation.approval_request_id;
  });

  test('approval detail shows all 7 sections', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);

    // Find and click the approval we created
    await page.locator(selectors.approvals.queueCard).filter({ hasText: 'approve_test' }).click();

    const detail = page.locator(selectors.approvals.detailPanel);
    await expect(detail).toBeVisible();

    // Why This Was Flagged section
    await expect(detail.locator(selectors.approvals.whyFlagged)).toBeVisible();

    // Approve/Deny buttons
    await expect(detail.locator(selectors.approvals.approveButton)).toBeVisible();
    await expect(detail.locator(selectors.approvals.denyButton)).toBeVisible();
  });

  test('context snapshot shows SDK context', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);
    await page.locator(selectors.approvals.queueCard).filter({ hasText: 'approve_test' }).click();

    // Context should show the { test: true, reason: '...' } we passed
    await expect(page.locator('text=E2E approval flow test')).toBeVisible();
  });

  test('approve with note succeeds', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);
    await page.locator(selectors.approvals.queueCard).filter({ hasText: 'approve_test' }).click();

    // Type a note
    await page.fill(selectors.approvals.noteInput, 'Approved by E2E test — verified context is correct');

    // Click approve
    await page.click(selectors.approvals.approveButton);

    // Toast should appear
    await expect(page.locator(selectors.common.toast)).toContainText(/approved/i, { timeout: 5000 });

    // Card should disappear from queue
    await page.waitForTimeout(1000);
    await expect(page.locator(selectors.approvals.queueCard).filter({ hasText: 'approve_test' })).not.toBeVisible();
  });
});
```

### `13-approvals-detail-deny.spec.ts` — Deny Flow

```typescript
test.describe('Approval - Deny Flow', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test.beforeAll(async () => {
    // Create agent + policy + evaluation that requires approval (same as approve flow)
    // But this time we'll deny it
  });

  test('deny with note succeeds and finalizes trace', async ({ page }) => {
    // Navigate to approvals, find the pending one, click it
    // Fill note: 'Denied by E2E test — insufficient context'
    // Click deny
    // Verify toast shows "Denied"
    // Verify card disappears
    // Navigate to traces — verify the trace shows denied outcome
  });
});
```

### `14-traces-list.spec.ts` — Trace List

```typescript
test.describe('Trace List', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('shows traces with outcome badges', async ({ page }) => {
    await page.goto('/dashboard/audit');
    await page.waitForSelector(selectors.traces.listItem, { timeout: 10000 });
    await expect(page.locator(selectors.traces.listItem).first()).toBeVisible();
  });

  test('filter by agent', async ({ page }) => {
    await page.goto('/dashboard/audit');
    // Select agent filter
  });

  test('filter by outcome', async ({ page }) => {
    await page.goto('/dashboard/audit');
    // Select outcome filter
  });

  test('selecting trace shows detail panel', async ({ page }) => {
    await page.goto('/dashboard/audit');
    await page.waitForSelector(selectors.traces.listItem);
    await page.locator(selectors.traces.listItem).first().click();
    await expect(page.locator(selectors.traces.detail)).toBeVisible();
  });
});
```

### `15-traces-detail.spec.ts` — Trace Detail

```typescript
test.describe('Trace Detail', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('shows event timeline in chronological order', async ({ page }) => {
    await page.goto('/dashboard/audit');
    await page.waitForSelector(selectors.traces.listItem);
    await page.locator(selectors.traces.listItem).first().click();

    await expect(page.locator(selectors.traces.eventTimeline)).toBeVisible();
    const events = page.locator(selectors.traces.eventRow);
    expect(await events.count()).toBeGreaterThan(0);
  });

  test('event rows expand to show metadata', async ({ page }) => {
    await page.goto('/dashboard/audit');
    await page.waitForSelector(selectors.traces.listItem);
    await page.locator(selectors.traces.listItem).first().click();
    await page.locator(selectors.traces.eventRow).first().click();
    // Expanded metadata should be visible
    await page.waitForTimeout(500);
  });

  test('integrity badge shows verified status', async ({ page }) => {
    await page.goto('/dashboard/audit');
    await page.waitForSelector(selectors.traces.listItem);
    await page.locator(selectors.traces.listItem).first().click();

    const badge = page.locator(selectors.traces.integrityBadge);
    if (await badge.isVisible()) {
      await expect(badge).toContainText(/verified|no integrity/i);
    }
  });
});
```

### `16-traces-export.spec.ts` — Trace Export

```typescript
test.describe('Trace Export', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('export single trace as JSON triggers download', async ({ page }) => {
    await page.goto('/dashboard/audit');
    await page.waitForSelector(selectors.traces.listItem);
    await page.locator(selectors.traces.listItem).first().click();

    const downloadPromise = page.waitForEvent('download');
    await page.click(selectors.traces.exportJsonButton);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/trace.*\.json/);
  });

  test('export CSV with date range triggers download', async ({ page }) => {
    await page.goto('/dashboard/audit');
    // Fill date range
    // Click Export CSV
    // Verify download
  });
});
```

### `17-settings-general.spec.ts` — General Settings

```typescript
test.describe('Settings - General', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('loads current settings', async ({ page }) => {
    await page.goto('/dashboard/settings/general');
    await expect(page.locator('input[name="name"]')).toHaveValue(/.+/);
  });

  test('save changes shows toast', async ({ page }) => {
    await page.goto('/dashboard/settings/general');
    await page.fill('input[name="name"]', 'E2E Updated Workspace');
    await page.click(selectors.settings.saveButton);
    await expect(page.locator(selectors.common.toast)).toBeVisible();
  });

  test('changes persist after reload', async ({ page }) => {
    await page.goto('/dashboard/settings/general');
    await page.fill('input[name="name"]', 'Persistent Name Test');
    await page.click(selectors.settings.saveButton);
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('input[name="name"]')).toHaveValue('Persistent Name Test');
  });
});
```

### `18-settings-users.spec.ts` — User Management

```typescript
test.describe('Settings - Users', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('shows user table', async ({ page }) => {
    await page.goto('/dashboard/settings/users');
    await expect(page.locator('table')).toBeVisible();
  });

  test('current user has (you) marker', async ({ page }) => {
    await page.goto('/dashboard/settings/users');
    await expect(page.locator('text=(you)')).toBeVisible();
  });

  test('cannot remove yourself', async ({ page }) => {
    await page.goto('/dashboard/settings/users');
    // The remove button on the current user's row should be disabled or hidden
  });
});
```

### `19-settings-api-keys.spec.ts` — API Key Management

```typescript
test.describe('Settings - API Keys', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('lists existing keys', async ({ page }) => {
    await page.goto('/dashboard/settings/api-keys');
    await expect(page.locator('table')).toBeVisible();
  });

  test('create key shows raw key dialog', async ({ page }) => {
    await page.goto('/dashboard/settings/api-keys');
    await page.click(selectors.settings.createKeyButton);

    // Fill name and scopes
    await page.fill('input[name="name"]', 'E2E Test Key');
    // Select scopes
    await page.click('button:text("Create")');

    // Raw key dialog
    await expect(page.locator(selectors.settings.keyDialog)).toBeVisible();
    const rawKey = await page.locator(selectors.settings.rawKeyValue).textContent();
    expect(rawKey).toMatch(/^ai_/);
  });

  test('key not shown after dialog dismissed', async ({ page }) => {
    await page.goto('/dashboard/settings/api-keys');
    // The key prefix should be visible, but not the full key
    await expect(page.locator('text=ai_')).toBeVisible();
    // No full key visible (64+ chars)
  });

  test('delete key removes from list', async ({ page }) => {
    await page.goto('/dashboard/settings/api-keys');
    const initialCount = await page.locator('tr').count();
    await page.locator(selectors.settings.deleteKeyButton).last().click();
    await page.click('button:text("Confirm")');
    await expect(page.locator(selectors.common.toast)).toBeVisible();
    // Count should decrease
  });
});
```

### `20-settings-webhooks.spec.ts` — Webhook Management

```typescript
test.describe('Settings - Webhooks', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('create webhook shows secret dialog', async ({ page }) => {
    await page.goto('/dashboard/settings/webhooks');
    await page.click('button:text("Create")');

    await page.fill('input[name="url"]', 'https://httpbin.org/post');
    // Select events
    await page.click('button:text("Create")');

    // Secret dialog
    await expect(page.locator('text=secret')).toBeVisible();
  });

  test('webhook appears in list after creation', async ({ page }) => {
    await page.goto('/dashboard/settings/webhooks');
    await expect(page.locator('text=httpbin.org')).toBeVisible();
  });
});
```

### `21-settings-audit-export.spec.ts` — Audit Export

```typescript
test.describe('Settings - Audit Export', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('audit export page loads with date pickers', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-export');
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });
});
```

### `22-search.spec.ts` — Global Search

```typescript
test.describe('Global Search', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('typing in search shows results dropdown', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'Customer');
    await expect(page.locator(selectors.search.results)).toBeVisible({ timeout: 3000 });
  });

  test('search results grouped by category', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'Customer');
    await page.waitForSelector(selectors.search.results);
    // Should have category headers
    await expect(page.locator('text=Agents')).toBeVisible();
  });

  test('clicking result navigates to detail', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'Customer');
    await page.waitForSelector(selectors.search.resultItem);
    await page.locator(selectors.search.resultItem).first().click();
    // Should navigate away from /dashboard
    await page.waitForTimeout(1000);
    expect(page.url()).not.toBe('http://localhost:3000/dashboard');
  });

  test('no results message for unmatched query', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'xyznonexistent');
    await expect(page.locator('text=No results')).toBeVisible({ timeout: 3000 });
  });

  test('search closes on Escape key', async ({ page }) => {
    await page.goto('/dashboard');
    await page.fill(selectors.search.input, 'Customer');
    await page.waitForSelector(selectors.search.results);
    await page.keyboard.press('Escape');
    await expect(page.locator(selectors.search.results)).not.toBeVisible();
  });
});
```

### `23-architecture.spec.ts` — Architecture Page

```typescript
test.describe('Architecture Page', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('renders architecture diagram', async ({ page }) => {
    await page.goto('/dashboard/architecture');
    await expect(page.locator('text=Identity')).toBeVisible();
    await expect(page.locator('text=Policy')).toBeVisible();
    await expect(page.locator('text=Approval')).toBeVisible();
    await expect(page.locator('text=Auditability')).toBeVisible();
  });
});
```

### `24-full-governance-flow.spec.ts` — Complete Governance Flow (CRITICAL)

This is the most important test — it exercises the entire product end-to-end through the browser.

```typescript
test.describe('Full Governance Flow', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('create agent → create policy → evaluate via SDK → approve in dashboard → verify trace', async ({ page }) => {
    const apiKey = await getDevApiKey();

    // 1. Create agent via dashboard
    await page.goto('/dashboard/agents');
    await page.click(selectors.agents.createButton);
    await page.fill('input[name="name"]', 'Full Flow Agent');
    await page.fill('input[name="description"]', 'Testing complete governance flow');
    await page.fill('input[name="owner_name"]', 'Flow Test Owner');
    await page.fill('input[name="owner_role"]', 'Platform Engineer');
    await page.fill('input[name="team"]', 'Platform');
    await page.click('button:text("Register")');
    await expect(page.locator(selectors.common.toast)).toBeVisible();

    // Get agent ID from URL or API
    await page.waitForTimeout(1000);
    const agents = await fetch('http://localhost:4000/api/v1/agents?search=Full+Flow+Agent', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }).then(r => r.json());
    const agentId = agents.data[0].id;

    // 2. Create approval_required policy via dashboard
    await page.goto('/dashboard/policies');
    await page.click(selectors.policies.createButton);
    await page.selectOption('select[name="agent_id"]', { label: /Full Flow Agent/i });
    await page.fill('input[name="policy_name"]', 'Full Flow Approval Policy');
    await page.fill('input[name="operation"]', 'full_flow_action');
    await page.fill('input[name="target_integration"]', 'full_flow_service');
    await page.fill('input[name="resource_scope"]', 'flow_data');
    await page.selectOption('select[name="data_classification"]', 'confidential');
    await page.selectOption('select[name="effect"]', 'approval_required');
    await page.fill('textarea[name="rationale"]', 'Full governance flow test requires human review to validate end-to-end functionality.');
    await page.click('button:text("Save")');
    await expect(page.locator(selectors.common.toast)).toBeVisible();

    // 3. Evaluate via API (simulating SDK call)
    const evaluation = await evaluateViaAPI(apiKey, {
      agent_id: agentId,
      operation: 'full_flow_action',
      target_integration: 'full_flow_service',
      resource_scope: 'flow_data',
      data_classification: 'confidential',
      context: { test: 'full_governance_flow', timestamp: new Date().toISOString() },
    });
    expect(evaluation.decision).toBe('approval_required');
    expect(evaluation.approval_request_id).toBeTruthy();

    // 4. Approve in dashboard
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);

    // Find the approval for our action
    await page.locator(selectors.approvals.queueCard).filter({ hasText: 'full_flow_action' }).click();
    await expect(page.locator(selectors.approvals.detailPanel)).toBeVisible();

    // Verify context snapshot
    await expect(page.locator('text=full_governance_flow')).toBeVisible();

    // Approve
    await page.fill(selectors.approvals.noteInput, 'Full flow test approved');
    await page.click(selectors.approvals.approveButton);
    await expect(page.locator(selectors.common.toast)).toContainText(/approved/i);

    // 5. Record outcome via API (simulating SDK)
    await fetch(`http://localhost:4000/api/v1/traces/${evaluation.trace_id}/outcome`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'success', metadata: { flow: 'complete' } }),
    });

    // 6. Verify trace in dashboard
    await page.goto('/dashboard/audit');
    await page.waitForSelector(selectors.traces.listItem);

    // Find our trace
    await page.locator(selectors.traces.listItem).filter({ hasText: 'full_flow_action' }).click();
    await expect(page.locator(selectors.traces.detail)).toBeVisible();

    // Verify complete event chain
    const events = page.locator(selectors.traces.eventRow);
    const eventCount = await events.count();
    expect(eventCount).toBeGreaterThanOrEqual(7); // trace_initiated through trace_closed

    // Verify outcome badge
    await expect(page.locator(selectors.traces.outcomeBadge)).toContainText(/completed|approved/i);
  });
});
```

### `25-csrf-protection.spec.ts` — CSRF Protection

```typescript
test.describe('CSRF Protection', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('POST without CSRF token is rejected', async ({ page }) => {
    await page.goto('/dashboard');

    // Try a POST without the CSRF token header
    const result = await page.evaluate(async () => {
      const res = await fetch('http://localhost:4000/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: 'csrf-test',
          description: 'test',
          owner_name: 'test',
          owner_role: 'test',
          team: 'test',
          authority_model: 'self',
          identity_mode: 'service_identity',
          delegation_model: 'self',
          created_by: 'test',
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/csrf/i);
  });

  test('normal dashboard operations include CSRF token automatically', async ({ page }) => {
    // This is implicitly tested by all the other tests that do POST/PATCH via the dashboard
    // If CSRF was broken, those tests would fail
    await page.goto('/dashboard/settings/general');
    await page.fill('input[name="name"]', 'CSRF Test');
    await page.click(selectors.settings.saveButton);
    // Should succeed (not 403)
    await expect(page.locator(selectors.common.toast)).toBeVisible();
  });
});
```

### `26-rbac-viewer.spec.ts` — RBAC Viewer Restrictions

```typescript
test.describe('RBAC - Viewer Role', () => {
  // This test needs a viewer user
  // Create one via API or signup, then change role via admin API

  test.beforeAll(async () => {
    // Create viewer user and save auth state to tests/browser/.auth/viewer.json
  });

  test.use({ storageState: 'tests/browser/.auth/viewer.json' });

  test('approve/deny buttons hidden', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);
    await page.locator(selectors.approvals.queueCard).first().click();

    await expect(page.locator(selectors.approvals.approveButton)).not.toBeVisible();
    await expect(page.locator(selectors.approvals.denyButton)).not.toBeVisible();
  });

  test('create agent button hidden', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await expect(page.locator(selectors.agents.createButton)).not.toBeVisible();
  });

  test('create policy button hidden', async ({ page }) => {
    await page.goto('/dashboard/policies');
    await expect(page.locator(selectors.policies.createButton)).not.toBeVisible();
  });

  test('settings shows admin access required', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('text=Admin Access Required')).toBeVisible();
  });

  test('can still view agents, policies, traces', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await expect(page.locator(selectors.agents.table)).toBeVisible();

    await page.goto('/dashboard/policies');
    await expect(page.locator(selectors.policies.card).first()).toBeVisible();

    await page.goto('/dashboard/audit');
    await expect(page.locator(selectors.traces.listItem).first()).toBeVisible();
  });
});
```

### `27-rbac-reviewer.spec.ts` — RBAC Reviewer Permissions

```typescript
test.describe('RBAC - Reviewer Role', () => {
  test.use({ storageState: 'tests/browser/.auth/reviewer.json' });

  test('approve/deny buttons visible', async ({ page }) => {
    await page.goto('/dashboard/approvals');
    await page.waitForSelector(selectors.approvals.queueCard);
    await page.locator(selectors.approvals.queueCard).first().click();

    await expect(page.locator(selectors.approvals.approveButton)).toBeVisible();
    await expect(page.locator(selectors.approvals.denyButton)).toBeVisible();
  });

  test('create agent button hidden', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await expect(page.locator(selectors.agents.createButton)).not.toBeVisible();
  });

  test('lifecycle controls hidden', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.locator(selectors.agents.row).first().click();
    await page.waitForURL(/agents\/.+/);
    await expect(page.locator(selectors.agents.suspendButton)).not.toBeVisible();
  });
});
```

### `28-navigation.spec.ts` — Navigation & Breadcrumbs

```typescript
test.describe('Navigation', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('all sidebar links navigate correctly', async ({ page }) => {
    for (const [name, selector] of Object.entries(selectors.sidebar)) {
      if (name === 'pendingBadge') continue;
      await page.goto('/dashboard');
      await page.click(selector);
      await page.waitForTimeout(500);
      // Should not show error
      await expect(page.locator('text=error')).not.toBeVisible();
    }
  });

  test('breadcrumbs show correct hierarchy on agent detail', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.locator(selectors.agents.row).first().click();
    await page.waitForURL(/agents\/.+/);

    await expect(page.locator(selectors.common.breadcrumbs)).toContainText('Agents');
  });

  test('breadcrumb link navigates back', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.locator(selectors.agents.row).first().click();
    await page.waitForURL(/agents\/.+/);

    await page.locator(selectors.common.breadcrumbs).locator('a:text("Agents")').click();
    await expect(page).toHaveURL(/\/dashboard\/agents$/);
  });
});
```

### `29-error-handling.spec.ts` — Error Handling

```typescript
test.describe('Error Handling', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  test('404 page for non-existent agent', async ({ page }) => {
    await page.goto('/dashboard/agents/nonexistent-id');
    // Should show error or 404 state, not crash
    await page.waitForTimeout(2000);
    // Page should not be blank
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(10);
  });

  test('API errors show toast not crash', async ({ page }) => {
    await page.goto('/dashboard');
    // All pages should handle API errors gracefully
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    // Filter out expected errors (e.g., favicon 404)
    const realErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('404')
    );
    expect(realErrors).toHaveLength(0);
  });
});
```

### `30-responsive.spec.ts` — Responsive Design

```typescript
test.describe('Responsive Design', () => {
  test.use({ storageState: 'tests/browser/.auth/admin.json' });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 720 },
    { name: 'tablet', width: 768, height: 1024 },
  ];

  for (const viewport of viewports) {
    test(`dashboard loads at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');
      await expect(page.locator('text=Agents')).toBeVisible();
      // No horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 5);
    });
  }
});
```

---

## CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
  test-browser:
    runs-on: ubuntu-latest
    needs: [test-api]
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: agent_identity_test
          POSTGRES_USER: agent_identity
          POSTGRES_PASSWORD: agent_identity
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready"
          --health-interval 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://agent_identity:agent_identity@localhost:5433/agent_identity_test
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install chromium
      - name: Run migrations and seed
        run: cd apps/api && npx prisma migrate deploy && npx prisma db seed
      - name: Run browser tests
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

Add script to root `package.json`:

```json
{
  "scripts": {
    "test:browser": "playwright test",
    "test:browser:headed": "playwright test --headed",
    "test:browser:debug": "playwright test --debug"
  }
}
```

---

## Acceptance Criteria

- [ ] Playwright installed and configured
- [ ] `data-testid` attributes added to all referenced dashboard components
- [ ] All 30 test files created with meaningful test cases
- [ ] Global setup: database reset, seed, admin auth state saved
- [ ] Auth helpers: login, signup, API key retrieval
- [ ] API helpers: create agent/policy/evaluation for test setup
- [ ] Centralized selectors in `helpers/selectors.ts`
- [ ] `npx playwright test` — all tests pass
- [ ] Test 24 (full governance flow) passes end-to-end
- [ ] Test 25 (CSRF) verifies protection works
- [ ] Tests 26-27 (RBAC) verify role-based UI hiding
- [ ] CI workflow updated with browser test job
- [ ] Screenshots captured on failure
- [ ] `turbo test` (backend) still passes
- [ ] Total browser test count: 80+ test cases

## Constraints

- **The only code changes allowed** are adding `data-testid` attributes to dashboard components
- Do NOT modify business logic, API routes, or SDK code
- Tests must be deterministic (no flaky timing issues)
- Use Playwright's built-in assertions (`expect`) — no external assertion libraries
- Tests run sequentially (`workers: 1`) since they share database state
- Follow code style: test files in `kebab-case.spec.ts`
