# Task: Stripe Billing, Upgrade Prompts & Usage Tracking

## Context

You are working on the **SidClaw** platform. Read these files first:

1. `research/2026-03-20-product-development-plan.md` — Overview for product understanding.
2. `apps/api/prisma/schema.prisma` — current database schema (Tenant has `plan` and `stripe_customer_id` fields).
3. `apps/api/src/middleware/rate-limit.ts` — plan-based rate limiting (understands plan tiers).
4. `apps/api/src/routes/tenant.ts` — tenant settings endpoints.
5. `apps/dashboard/src/` — dashboard (for upgrade prompts).
6. `apps/landing/src/components/pricing.tsx` — pricing page (Free $0, Team $499/mo, Enterprise custom).

**The problem:** Users can sign up for free but there's no way to pay. The Team plan says "$499/month" on the landing page but the "Start Team Trial" button just sends an email. We need self-serve billing so free users can upgrade without human intervention.

**Pricing from the landing page:**
- **Free:** $0/month — 5 agents, 10 policies/agent, 2 API keys, 7-day retention
- **Team:** $499/month — 50 agents, unlimited policies, 10 API keys, 90-day retention
- **Enterprise:** Custom — unlimited everything, self-hosted, SSO, SLA

## What To Do

This task has 4 parts: Stripe setup, API billing endpoints, dashboard upgrade flow, and usage tracking.

---

### Part 1: Stripe Product Setup

Before writing code, create the Stripe products and prices. Do this via the Stripe CLI or dashboard:

```bash
# Install Stripe CLI if needed
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Create the Team product and price
stripe products create \
  --name="SidClaw Team" \
  --description="50 agents, unlimited policies, 10 API keys, 90-day retention, email support"

# Note the product ID (prod_...), then create the price:
stripe prices create \
  --product=prod_XXXXX \
  --unit-amount=49900 \
  --currency=usd \
  --recurring[interval]=month

# Note the price ID (price_...)
```

If `stripe` CLI is not available, create products/prices via the Stripe dashboard at `dashboard.stripe.com` and note the IDs.

Store the IDs as environment variables:

```
STRIPE_SECRET_KEY=sk_test_...        # or sk_live_... for production
STRIPE_PUBLISHABLE_KEY=pk_test_...   # or pk_live_... for production
STRIPE_TEAM_PRICE_ID=price_...       # the Team plan monthly price
STRIPE_WEBHOOK_SECRET=whsec_...      # webhook signing secret (created below)
```

---

### Part 2: API — Billing Service & Endpoints

#### Install Stripe SDK

```bash
cd apps/api
npm install stripe
```

#### Create Billing Service (`apps/api/src/services/billing-service.ts`)

```typescript
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-18.acacia',  // use latest stable API version
});

const TEAM_PRICE_ID = process.env.STRIPE_TEAM_PRICE_ID!;

export class BillingService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get or create a Stripe customer for a tenant.
   */
  async getOrCreateCustomer(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    if (tenant.stripe_customer_id) {
      return tenant.stripe_customer_id;
    }

    // Find the admin user for this tenant (for email)
    const admin = await this.prisma.user.findFirst({
      where: { tenant_id: tenantId, role: 'admin' },
    });

    const customer = await stripe.customers.create({
      metadata: { tenant_id: tenantId },
      email: admin?.email,
      name: tenant.name,
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { stripe_customer_id: customer.id },
    });

    return customer.id;
  }

  /**
   * Create a Stripe Checkout session for upgrading to Team plan.
   * Returns the checkout URL to redirect the user to.
   */
  async createCheckoutSession(tenantId: string, returnUrl: string): Promise<string> {
    const customerId = await this.getOrCreateCustomer(tenantId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: TEAM_PRICE_ID, quantity: 1 }],
      success_url: `${returnUrl}?upgrade=success`,
      cancel_url: `${returnUrl}?upgrade=cancelled`,
      metadata: { tenant_id: tenantId },
      subscription_data: {
        metadata: { tenant_id: tenantId },
      },
    });

    return session.url!;
  }

  /**
   * Create a Stripe Customer Portal session for managing subscription.
   * Returns the portal URL.
   */
  async createPortalSession(tenantId: string, returnUrl: string): Promise<string> {
    const customerId = await this.getOrCreateCustomer(tenantId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * Handle Stripe webhook events.
   * Called from the webhook endpoint after signature verification.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        if (tenantId) {
          await this.upgradeTenant(tenantId, 'team');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenant_id;
        if (tenantId) {
          if (subscription.status === 'active') {
            await this.upgradeTenant(tenantId, 'team');
          } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            await this.downgradeTenant(tenantId, 'free');
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenant_id;
        if (tenantId) {
          await this.downgradeTenant(tenantId, 'free');
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const tenant = await this.prisma.tenant.findFirst({
          where: { stripe_customer_id: customerId },
        });
        if (tenant) {
          // Don't immediately downgrade — Stripe retries. Just log.
          console.warn(`Payment failed for tenant ${tenant.id}`);
        }
        break;
      }
    }
  }

  private async upgradeTenant(tenantId: string, plan: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
    });
    console.log(`Tenant ${tenantId} upgraded to ${plan}`);
  }

  private async downgradeTenant(tenantId: string, plan: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
    });
    console.log(`Tenant ${tenantId} downgraded to ${plan}`);
  }

  /**
   * Get current subscription status for a tenant.
   */
  async getSubscriptionStatus(tenantId: string): Promise<{
    plan: string;
    status: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    if (!tenant.stripe_customer_id || tenant.plan === 'free') {
      return { plan: tenant.plan, status: null, current_period_end: null, cancel_at_period_end: false };
    }

    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: tenant.stripe_customer_id,
        status: 'active',
        limit: 1,
      });

      const sub = subscriptions.data[0];
      if (!sub) {
        return { plan: tenant.plan, status: null, current_period_end: null, cancel_at_period_end: false };
      }

      return {
        plan: tenant.plan,
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
      };
    } catch {
      return { plan: tenant.plan, status: null, current_period_end: null, cancel_at_period_end: false };
    }
  }
}
```

#### API Routes (`apps/api/src/routes/billing.ts`)

```typescript
import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { BillingService } from '../services/billing-service';
import { requireRole } from '../middleware/require-role';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-18.acacia',
});

export async function billingRoutes(app: FastifyInstance) {
  const billingService = new BillingService(app.prisma);

  // POST /api/v1/billing/checkout — create Stripe Checkout session
  // Admin only
  app.post('/billing/checkout', {
    preHandler: [requireRole('admin')],
  }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:3000';
    const returnUrl = `${dashboardUrl}/dashboard/settings`;

    const checkoutUrl = await billingService.createCheckoutSession(tenantId, returnUrl);
    return reply.send({ url: checkoutUrl });
  });

  // POST /api/v1/billing/portal — create Stripe Customer Portal session
  // Admin only — for managing existing subscription
  app.post('/billing/portal', {
    preHandler: [requireRole('admin')],
  }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:3000';
    const returnUrl = `${dashboardUrl}/dashboard/settings`;

    const portalUrl = await billingService.createPortalSession(tenantId, returnUrl);
    return reply.send({ url: portalUrl });
  });

  // GET /api/v1/billing/status — get subscription status
  app.get('/billing/status', async (request, reply) => {
    const tenantId = request.tenantId!;
    const status = await billingService.getSubscriptionStatus(tenantId);
    return reply.send({ data: status });
  });

  // POST /api/v1/billing/webhook — Stripe webhook endpoint
  // NO AUTH — Stripe calls this directly. Verify signature instead.
  app.post('/billing/webhook', {
    config: { rawBody: true },  // need raw body for signature verification
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return reply.status(400).send({ error: 'Missing signature or webhook secret' });
    }

    let event: Stripe.Event;
    try {
      // Get raw body — Fastify may need configuration for this
      const rawBody = (request as any).rawBody ?? request.body;
      event = stripe.webhooks.constructEvent(
        typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody),
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    await billingService.handleWebhookEvent(event);
    return reply.status(200).send({ received: true });
  });
}
```

Register the routes in `server-plugins.ts`:

```typescript
import { billingRoutes } from './routes/billing';

// In registerPlugins:
await app.register(billingRoutes, { prefix: '/api/v1' });
```

**Important — Skip auth for webhook endpoint:** The billing webhook (`POST /api/v1/billing/webhook`) is called by Stripe, not by users. It must be excluded from the auth middleware. Update `apps/api/src/middleware/auth.ts`:

```typescript
// Add to the skip list alongside /health and /api/v1/auth/*:
if (request.url.startsWith('/api/v1/billing/webhook')) {
  return;  // Skip auth — signature verified in the route handler
}
```

**Important — Raw body for Stripe:** Stripe requires the raw request body for signature verification. Fastify parses JSON by default. You need to configure Fastify to preserve the raw body for the webhook route. Add to `server.ts` or `server-plugins.ts`:

```typescript
// Before registering routes, add raw body support:
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = JSON.parse(body as string);
    // Store raw body for Stripe webhook verification
    (req as any).rawBody = body;
    done(null, json);
  } catch (err) {
    done(err as Error, undefined);
  }
});
```

Or use `@fastify/raw-body` plugin:

```bash
npm install @fastify/raw-body
```

```typescript
import rawBody from '@fastify/raw-body';
await app.register(rawBody, { global: false, runFirst: true });
```

#### Create Stripe Webhook

After deploying, register the webhook in Stripe:

```bash
# For local development:
stripe listen --forward-to localhost:4000/api/v1/billing/webhook

# For production, create via dashboard or CLI:
stripe webhook_endpoints create \
  --url="https://api.sidclaw.com/api/v1/billing/webhook" \
  --enabled-events="checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed"
```

Note the webhook signing secret (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET`.

---

### Part 3: Dashboard — Upgrade Flow & Prompts

#### Upgrade Modal (`apps/dashboard/src/components/billing/UpgradeModal.tsx`)

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitName: string;   // e.g., "agents", "API keys"
  current: number;
  max: number;
}

export function UpgradeModal({ isOpen, onClose, limitName, current, max }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { url } = await api.post<{ url: string }>('/api/v1/billing/checkout', {});
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-[#2A2A2E] bg-[#111113] p-6">
        <h2 className="text-lg font-medium text-[#E4E4E7]">
          Upgrade to Team
        </h2>

        <p className="mt-3 text-sm text-[#A1A1AA]">
          You've reached <span className="text-[#F59E0B] font-medium">{current}/{max} {limitName}</span> on
          the Free plan.
        </p>

        <div className="mt-4 rounded-lg bg-[#0A0A0B] border border-[#2A2A2E] p-4">
          <div className="text-sm font-medium text-[#E4E4E7]">Team Plan — $499/month</div>
          <ul className="mt-2 space-y-1 text-sm text-[#A1A1AA]">
            <li>50 agents (10x more)</li>
            <li>Unlimited policies</li>
            <li>10 API keys</li>
            <li>90-day trace retention</li>
            <li>Email support</li>
          </ul>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded bg-[#1A1A1D] px-4 py-2 text-sm font-medium text-[#A1A1AA]"
          >
            Not now
          </button>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 rounded bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Upgrade Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Integrate Upgrade Prompts

Update the API client to detect 402 responses and trigger the upgrade modal:

Create `apps/dashboard/src/lib/billing-context.tsx`:

```typescript
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { UpgradeModal } from '@/components/billing/UpgradeModal';

interface BillingContextValue {
  showUpgradePrompt: (limitName: string, current: number, max: number) => void;
}

const BillingContext = createContext<BillingContextValue>({ showUpgradePrompt: () => {} });

export function BillingProvider({ children }: { children: ReactNode }) {
  const [upgradeState, setUpgradeState] = useState<{
    isOpen: boolean;
    limitName: string;
    current: number;
    max: number;
  }>({ isOpen: false, limitName: '', current: 0, max: 0 });

  const showUpgradePrompt = (limitName: string, current: number, max: number) => {
    setUpgradeState({ isOpen: true, limitName, current, max });
  };

  return (
    <BillingContext.Provider value={{ showUpgradePrompt }}>
      {children}
      <UpgradeModal
        isOpen={upgradeState.isOpen}
        onClose={() => setUpgradeState(prev => ({ ...prev, isOpen: false }))}
        limitName={upgradeState.limitName}
        current={upgradeState.current}
        max={upgradeState.max}
      />
    </BillingContext.Provider>
  );
}

export function useBilling() {
  return useContext(BillingContext);
}
```

Wrap the dashboard layout with `BillingProvider`:

```typescript
// In apps/dashboard/src/app/dashboard/layout.tsx:
import { BillingProvider } from '@/lib/billing-context';

// Wrap children:
<BillingProvider>
  {children}
</BillingProvider>
```

Update the API client (`apps/dashboard/src/lib/api-client.ts`) to detect 402 and trigger the upgrade prompt:

```typescript
// In the request method, after checking response status:
if (response.status === 402) {
  const errorBody = await response.json().catch(() => ({}));
  // Dispatch a custom event that BillingProvider listens to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sidclaw:plan-limit', {
      detail: {
        limitName: errorBody.details?.limit ?? 'resources',
        current: errorBody.details?.current ?? 0,
        max: errorBody.details?.max ?? 0,
      },
    }));
  }
  throw new ApiError(errorBody);
}
```

In `BillingProvider`, listen for this event:

```typescript
useEffect(() => {
  const handler = (e: CustomEvent) => {
    showUpgradePrompt(e.detail.limitName, e.detail.current, e.detail.max);
  };
  window.addEventListener('sidclaw:plan-limit', handler as EventListener);
  return () => window.removeEventListener('sidclaw:plan-limit', handler as EventListener);
}, []);
```

#### Settings — Billing Section

Add a billing section to the settings page. Create `apps/dashboard/src/app/dashboard/settings/billing/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function BillingPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/billing/status')
      .then((res: any) => setStatus(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    const { url } = await api.post<{ url: string }>('/api/v1/billing/checkout', {});
    window.location.href = url;
  };

  const handleManage = async () => {
    const { url } = await api.post<{ url: string }>('/api/v1/billing/portal', {});
    window.location.href = url;
  };

  if (loading) return <div className="text-[#71717A]">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-[#E4E4E7]">Billing</h1>

      <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#E4E4E7]">
              Current Plan: <span className="text-[#3B82F6] uppercase">{status?.plan ?? 'free'}</span>
            </div>
            {status?.current_period_end && (
              <div className="mt-1 text-xs text-[#71717A]">
                {status.cancel_at_period_end
                  ? `Cancels on ${new Date(status.current_period_end).toLocaleDateString()}`
                  : `Renews on ${new Date(status.current_period_end).toLocaleDateString()}`
                }
              </div>
            )}
          </div>

          {status?.plan === 'free' ? (
            <button
              onClick={handleUpgrade}
              className="rounded bg-[#3B82F6] px-6 py-2 text-sm font-medium text-white"
            >
              Upgrade to Team — $499/mo
            </button>
          ) : (
            <button
              onClick={handleManage}
              className="rounded border border-[#2A2A2E] px-6 py-2 text-sm font-medium text-[#A1A1AA]"
            >
              Manage Subscription
            </button>
          )}
        </div>
      </div>

      {/* Plan comparison */}
      <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-6">
        <h2 className="text-sm font-medium text-[#E4E4E7] mb-4">Plan Comparison</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[#71717A] uppercase">
              <th className="text-left py-2">Feature</th>
              <th className="text-center py-2">Free</th>
              <th className="text-center py-2">Team</th>
              <th className="text-center py-2">Enterprise</th>
            </tr>
          </thead>
          <tbody className="text-[#A1A1AA]">
            <tr className="border-t border-[#2A2A2E]"><td className="py-2">Agents</td><td className="text-center">5</td><td className="text-center">50</td><td className="text-center">Unlimited</td></tr>
            <tr className="border-t border-[#2A2A2E]"><td className="py-2">Policies per agent</td><td className="text-center">10</td><td className="text-center">Unlimited</td><td className="text-center">Unlimited</td></tr>
            <tr className="border-t border-[#2A2A2E]"><td className="py-2">API keys</td><td className="text-center">2</td><td className="text-center">10</td><td className="text-center">Unlimited</td></tr>
            <tr className="border-t border-[#2A2A2E]"><td className="py-2">Trace retention</td><td className="text-center">7 days</td><td className="text-center">90 days</td><td className="text-center">Custom</td></tr>
            <tr className="border-t border-[#2A2A2E]"><td className="py-2">Webhooks</td><td className="text-center">1</td><td className="text-center">10</td><td className="text-center">Unlimited</td></tr>
            <tr className="border-t border-[#2A2A2E]"><td className="py-2">Support</td><td className="text-center">Community</td><td className="text-center">Email</td><td className="text-center">Dedicated + SLA</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Add "Billing" to the settings sub-navigation (in the settings layout):

```typescript
{ label: 'Billing', href: '/dashboard/settings/billing' }
```

#### Success/Cancel Handling

In the settings page (or wherever the Stripe checkout redirects back to), detect the `?upgrade=success` query param:

```typescript
// In settings page or dashboard layout:
const searchParams = useSearchParams();
useEffect(() => {
  if (searchParams.get('upgrade') === 'success') {
    toast.success('Welcome to the Team plan! Your limits have been upgraded.');
    // Remove the query param
    window.history.replaceState({}, '', window.location.pathname);
  }
  if (searchParams.get('upgrade') === 'cancelled') {
    toast.info('Upgrade cancelled. You can upgrade anytime from Settings.');
    window.history.replaceState({}, '', window.location.pathname);
  }
}, [searchParams]);
```

---

### Part 4: Usage Tracking — Admin Dashboard

Create a simple admin-only page that shows you (the platform operator) usage across all tenants.

#### API Endpoint (`apps/api/src/routes/admin.ts`)

```typescript
// GET /api/v1/admin/usage — platform-wide usage stats
// This is a SUPER ADMIN endpoint — only accessible with a special admin API key
// NOT accessible to regular tenant admins

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/usage', async (request, reply) => {
    // Verify super admin — use a special env var
    const authHeader = request.headers.authorization;
    const superAdminKey = process.env.SUPER_ADMIN_KEY;
    if (!superAdminKey || authHeader !== `Bearer ${superAdminKey}`) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const oneDayAgo = new Date(Date.now() - 86400000);

    // All tenants with usage
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        created_at: true,
        stripe_customer_id: true,
        _count: {
          select: {
            users: true,
            agents: true,
            policy_rules: true,
            api_keys: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Enrich with evaluation counts
    const enriched = await Promise.all(tenants.map(async (tenant) => {
      const [tracesToday, tracesWeek, lastTrace] = await Promise.all([
        prisma.auditTrace.count({
          where: { tenant_id: tenant.id, started_at: { gte: oneDayAgo } },
        }),
        prisma.auditTrace.count({
          where: { tenant_id: tenant.id, started_at: { gte: sevenDaysAgo } },
        }),
        prisma.auditTrace.findFirst({
          where: { tenant_id: tenant.id },
          orderBy: { started_at: 'desc' },
          select: { started_at: true },
        }),
      ]);

      return {
        ...tenant,
        agents: tenant._count.agents,
        users: tenant._count.users,
        policies: tenant._count.policy_rules,
        api_keys: tenant._count.api_keys,
        traces_today: tracesToday,
        traces_this_week: tracesWeek,
        last_active: lastTrace?.started_at?.toISOString() ?? null,
        is_paying: tenant.plan !== 'free',
      };
    }));

    // Summary stats
    const summary = {
      total_tenants: tenants.length,
      paying_tenants: tenants.filter(t => t.plan !== 'free').length,
      free_tenants: tenants.filter(t => t.plan === 'free').length,
      total_traces_today: enriched.reduce((sum, t) => sum + t.traces_today, 0),
      total_traces_week: enriched.reduce((sum, t) => sum + t.traces_this_week, 0),
      active_today: enriched.filter(t => t.traces_today > 0).length,
      active_this_week: enriched.filter(t => t.traces_this_week > 0).length,
    };

    return reply.send({ summary, tenants: enriched });
  });
}
```

Register: `await app.register(adminRoutes, { prefix: '/api/v1' });`

Set `SUPER_ADMIN_KEY` in Railway env vars (generate a strong random key).

This gives you a simple way to check usage:

```bash
curl -H "Authorization: Bearer <super_admin_key>" https://api.sidclaw.com/api/v1/admin/usage | jq '.summary'
```

---

### Part 5: Environment Configuration

Add to `apps/api/src/config.ts`:

```typescript
// Stripe (optional — billing disabled if not set)
stripeSecretKey: z.string().optional(),
stripeTeamPriceId: z.string().optional(),
stripeWebhookSecret: z.string().optional(),
superAdminKey: z.string().optional(),
```

Add to `apps/api/.env.example`:

```
# Stripe Billing (optional — billing features disabled if not set)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_TEAM_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Platform Admin
SUPER_ADMIN_KEY=               # generate with: openssl rand -hex 32
```

Add to `apps/dashboard/.env.local`:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Graceful degradation:** If `STRIPE_SECRET_KEY` is not set, the billing endpoints should return 501 (Not Implemented) with a message "Billing not configured." The upgrade modal should show "Contact hello@sidclaw.com to upgrade" instead of the Stripe checkout button.

---

### Part 6: Update Landing Page Pricing Links

Update `apps/landing/src/components/pricing.tsx`:

- "Get Started" (Free) → `https://app.sidclaw.com/signup` (already correct)
- "Start Team Trial" → `https://app.sidclaw.com/signup` (sign up first, then upgrade from settings)
  - Or better: `https://app.sidclaw.com/signup?plan=team` — and after signup, auto-redirect to Stripe Checkout
- "Contact Sales" (Enterprise) → `mailto:hello@sidclaw.com` (keep as-is)

For the `?plan=team` flow: after signup creates the tenant, if `plan=team` is in the URL, immediately create a Stripe Checkout session and redirect. This creates a seamless "sign up and pay" flow.

---

### Part 7: Integration Tests

Create `apps/api/src/__tests__/integration/billing.test.ts`:

```typescript
describe('Billing', () => {
  describe('POST /api/v1/billing/checkout', () => {
    it('returns checkout URL for free tenant (mock Stripe)');
    it('requires admin role');
    it('returns 501 when Stripe not configured');
  });

  describe('POST /api/v1/billing/webhook', () => {
    it('upgrades tenant on checkout.session.completed');
    it('downgrades tenant on subscription.deleted');
    it('rejects invalid signature');
    it('skips auth middleware');
  });

  describe('GET /api/v1/billing/status', () => {
    it('returns free status for free tenant');
    it('returns subscription details for paying tenant');
  });

  describe('GET /api/v1/admin/usage', () => {
    it('returns usage summary for super admin');
    it('returns 403 without super admin key');
    it('includes per-tenant metrics');
  });
});
```

**Note:** Mock the Stripe SDK in tests — don't make real Stripe API calls. Use `vi.mock('stripe')`.

---

## Acceptance Criteria

- [ ] Stripe products/prices created (Team plan $499/mo)
- [ ] `POST /api/v1/billing/checkout` creates Stripe Checkout session and returns URL
- [ ] `POST /api/v1/billing/portal` creates Customer Portal session
- [ ] `POST /api/v1/billing/webhook` handles checkout.completed, subscription.updated/deleted
- [ ] Webhook verifies Stripe signature
- [ ] Webhook endpoint skips auth middleware
- [ ] Tenant plan updates to 'team' after successful checkout
- [ ] Tenant plan reverts to 'free' after subscription cancellation
- [ ] Dashboard: 402 responses trigger UpgradeModal with plan comparison
- [ ] Dashboard: Settings > Billing page shows current plan + upgrade/manage buttons
- [ ] Dashboard: Upgrade button redirects to Stripe Checkout
- [ ] Dashboard: Success redirect shows toast
- [ ] `GET /api/v1/billing/status` returns subscription details
- [ ] `GET /api/v1/admin/usage` returns platform-wide usage (super admin only)
- [ ] Billing features gracefully degrade when Stripe not configured
- [ ] Landing page "Start Team Trial" links to signup flow
- [ ] All integration tests pass (mocked Stripe)
- [ ] `turbo test` passes
- [ ] `turbo build` succeeds

## Constraints

- Do NOT modify the Prisma schema (stripe_customer_id already exists on Tenant)
- Do NOT implement Enterprise billing (that's manual sales)
- Do NOT implement metered/usage-based billing (flat $499/mo is sufficient)
- Mock Stripe in all tests — no real Stripe API calls
- Follow code style: files in `kebab-case.ts`, strict TypeScript
