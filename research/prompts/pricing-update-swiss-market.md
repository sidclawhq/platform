# Task: Update Pricing for Swiss Market

## Context

You are working on the **SidClaw** platform. The pricing is being updated to target the Swiss enterprise market. You may have just completed or be in the middle of Stripe billing integration. Apply these changes on top of whatever billing work is already done.

Read these files to understand current state:
1. `apps/landing/src/components/pricing.tsx` — current landing page pricing
2. `apps/api/src/services/billing-service.ts` — Stripe billing service (if it exists)
3. `apps/api/src/middleware/rate-limit.ts` — plan-based rate limits (if they exist)
4. `apps/dashboard/src/components/billing/UpgradeModal.tsx` — upgrade modal (if it exists)
5. `apps/dashboard/src/app/dashboard/settings/billing/page.tsx` — billing settings (if it exists)

## Pricing Changes

The old pricing was: Free ($0) → Team ($499/mo) → Enterprise (custom).

The new pricing is **4 tiers in CHF** (Swiss Francs):

| Tier | Price | Agents | Policies | API Keys | Retention | Webhooks | Support | Key Feature |
|------|-------|--------|----------|----------|-----------|----------|---------|-------------|
| **Free** | CHF 0/mo | 5 | 10/agent | 2 | 7 days | 1 | Community | — |
| **Starter** | CHF 199/mo | 15 | 50/agent | 5 | 30 days | 3 | Email | — |
| **Business** | CHF 999/mo | 100 | Unlimited | 20 | 90 days | 10 | Priority email | SSO/OIDC |
| **Enterprise** | From CHF 3,000/mo | Unlimited | Unlimited | Unlimited | Custom | Unlimited | Dedicated + SLA | Self-hosted, compliance docs |

## Changes Required

### 1. Landing Page Pricing (`apps/landing/src/components/pricing.tsx`)

Replace the current 3-tier pricing with 4 tiers. Use CHF currency symbol. Updated content:

**Free tier (standard card):**
- Price: CHF 0/month
- Features: 5 agents, 10 policies per agent, 2 API keys, 7-day trace retention, 1 webhook, Community support
- Button: "Get Started" → `https://app.sidclaw.com/signup`
- Subtext: "No credit card required"

**Starter tier (standard card, NEW):**
- Price: CHF 199/month
- Features: 15 agents, 50 policies per agent, 5 API keys, 30-day retention, 3 webhooks, Email support
- Button: "Start Starter" → `https://app.sidclaw.com/signup?plan=starter`
- Subtext: "Cancel anytime"

**Business tier (highlighted card, "Most Popular" badge — was "Team"):**
- Price: CHF 999/month
- Subtext: "For production teams"
- Features: 100 agents, Unlimited policies, 20 API keys, 90-day retention, 10 webhooks, SSO/OIDC, Priority email support
- Button: "Start Business" → `mailto:hello@sidclaw.com` (or signup with plan=business)

**Enterprise tier (standard card):**
- Price: "From CHF 3,000/mo"
- Subtext: "Self-hosted or cloud"
- Features: Unlimited agents, Unlimited policies, Unlimited API keys, Custom retention, Unlimited webhooks, Self-hosted in your VPC, Dedicated support & SLA, Compliance documentation, FINMA/EU AI Act mapping
- Button: "Contact Sales" → `mailto:hello@sidclaw.com`

**Add a banner below the pricing cards:**
```
🏴 Founding Customer Offer
First 10 customers get 50% off the first year.
Contact hello@sidclaw.com to claim your spot.
```

Style the banner: `bg-accent-amber/10 border border-accent-amber/30 rounded-lg p-4 text-center text-sm`

**Note:** Add "FINMA" to the Enterprise features list (alongside EU AI Act). Swiss buyers will look for this.

### 2. Plan Limits in API

Update the plan limits wherever they are defined. Search for `FREE_PLAN_LIMITS`, `TEAM_PLAN_LIMITS`, or similar constants and update:

```typescript
const PLAN_LIMITS = {
  free: {
    max_agents: 5,
    max_policies_per_agent: 10,
    max_api_keys: 2,
    max_webhook_endpoints: 1,
    max_users: 3,
    trace_retention_days: 7,
    rate_limit_evaluate_per_min: 100,
  },
  starter: {
    max_agents: 15,
    max_policies_per_agent: 50,
    max_api_keys: 5,
    max_webhook_endpoints: 3,
    max_users: 10,
    trace_retention_days: 30,
    rate_limit_evaluate_per_min: 500,
  },
  business: {
    max_agents: 100,
    max_policies_per_agent: Infinity,  // unlimited
    max_api_keys: 20,
    max_webhook_endpoints: 10,
    max_users: 50,
    trace_retention_days: 90,
    rate_limit_evaluate_per_min: 5000,
  },
  enterprise: {
    max_agents: Infinity,
    max_policies_per_agent: Infinity,
    max_api_keys: Infinity,
    max_webhook_endpoints: Infinity,
    max_users: Infinity,
    trace_retention_days: 365,
    rate_limit_evaluate_per_min: 50000,
  },
};
```

Update any references to "team" plan → "business" throughout the codebase:
- Search for `plan === 'team'` and change to `plan === 'business'`
- Search for `'team'` in plan-related constants, rate limiting, etc.
- The database `plan` column values should now be: `'free'`, `'starter'`, `'business'`, `'enterprise'`

### 3. Rate Limiting Tiers

Update rate limit tiers if they exist (in `apps/api/src/middleware/rate-limit.ts` or similar):

```typescript
const RATE_LIMIT_TIERS = {
  free:       { evaluate: 100,   read: 300,   write: 60 },
  starter:    { evaluate: 500,   read: 1500,  write: 300 },
  business:   { evaluate: 5000,  read: 15000, write: 3000 },
  enterprise: { evaluate: 50000, read: 150000, write: 30000 },
};
```

### 4. Stripe Products & Prices

If Stripe billing is already set up, update or create the Stripe products:

**If billing service exists:**
- Rename the Team product to "SidClaw Business" (or create a new one)
- Create a new "SidClaw Starter" product

**Stripe prices needed:**

```bash
# Starter product
stripe products create --name="SidClaw Starter" \
  --description="15 agents, 50 policies/agent, 5 API keys, 30-day retention"

stripe prices create \
  --product=prod_STARTER_ID \
  --unit-amount=19900 \
  --currency=chf \
  --recurring[interval]=month

# Business product (replaces old Team)
stripe products create --name="SidClaw Business" \
  --description="100 agents, unlimited policies, 20 API keys, 90-day retention, SSO"

stripe prices create \
  --product=prod_BUSINESS_ID \
  --unit-amount=99900 \
  --currency=chf \
  --recurring[interval]=month
```

**If you can't run Stripe CLI**, create these via the Stripe Dashboard at `dashboard.stripe.com`. Note the price IDs.

**Update environment variables:**
```
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
```

If there was a `STRIPE_TEAM_PRICE_ID`, rename it to `STRIPE_BUSINESS_PRICE_ID` and update all references.

### 5. Billing Service Updates

If `billing-service.ts` exists, update it to support two plans:

```typescript
const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  business: process.env.STRIPE_BUSINESS_PRICE_ID,
};

async createCheckoutSession(tenantId: string, plan: 'starter' | 'business', returnUrl: string): Promise<string> {
  const priceId = PRICE_IDS[plan];
  if (!priceId) throw new Error(`Price not configured for plan: ${plan}`);
  // ... rest of checkout session creation
}
```

Update the checkout API endpoint to accept a `plan` parameter:

```typescript
// POST /api/v1/billing/checkout
// Request: { plan: 'starter' | 'business' }
app.post('/billing/checkout', async (request, reply) => {
  const { plan } = request.body as { plan: string };
  if (!['starter', 'business'].includes(plan)) {
    return reply.status(400).send({ error: 'Invalid plan. Use starter or business.' });
  }
  const url = await billingService.createCheckoutSession(tenantId, plan as any, returnUrl);
  return reply.send({ url });
});
```

### 6. Upgrade Modal Updates

If `UpgradeModal.tsx` exists, update it to show the appropriate next tier:

```typescript
// Determine the upgrade target based on current plan
function getUpgradeTarget(currentPlan: string): { plan: string; name: string; price: string; features: string[] } | null {
  switch (currentPlan) {
    case 'free':
      return {
        plan: 'starter',
        name: 'Starter',
        price: 'CHF 199/month',
        features: ['15 agents', '50 policies per agent', '5 API keys', '30-day retention', 'Email support'],
      };
    case 'starter':
      return {
        plan: 'business',
        name: 'Business',
        price: 'CHF 999/month',
        features: ['100 agents', 'Unlimited policies', '20 API keys', '90-day retention', 'SSO/OIDC', 'Priority support'],
      };
    case 'business':
      return null;  // Enterprise is manual — show "Contact Sales"
    default:
      return null;
  }
}
```

Update the modal to use this function and display the correct upgrade target. If the user is on Business and hits a limit, show "Contact hello@sidclaw.com for Enterprise pricing" instead of a Stripe checkout button.

### 7. Billing Settings Page Updates

If the billing/settings page exists, update the plan comparison table to show all 4 tiers with CHF pricing. Update the upgrade button to show the correct next plan.

### 8. Dashboard — Seed Data

If the seed script creates a default tenant, update it to use the new plan names. The development tenant should be `enterprise` (for testing without limits). Any test tenants should use `free` or `starter`.

Search for `plan: 'team'` in the seed script and any test utilities — change to `plan: 'business'`.

### 9. README Updates

If the root `README.md` has a pricing table, update it:

```markdown
## Pricing

| | Free | Starter | Business | Enterprise |
|--|------|---------|----------|-----------|
| Price | CHF 0/mo | CHF 199/mo | CHF 999/mo | From CHF 3,000/mo |
| Agents | 5 | 15 | 100 | Unlimited |
| Policies per agent | 10 | 50 | Unlimited | Unlimited |
| API keys | 2 | 5 | 20 | Unlimited |
| Trace retention | 7 days | 30 days | 90 days | Custom |
| SSO/OIDC | — | — | ✓ | ✓ |
| Support | Community | Email | Priority | Dedicated + SLA |
| | [Start Free](https://app.sidclaw.com/signup) | [Start Starter](https://app.sidclaw.com/signup?plan=starter) | [Contact](mailto:hello@sidclaw.com) | [Contact](mailto:hello@sidclaw.com) |
```

### 10. Docs Site

If the docs site mentions pricing anywhere, update those references too. Search `apps/docs/` for "499" or "Team plan" or pricing references.

### 11. Webhook Config for Stripe

If the Stripe webhook handler maps `checkout.session.completed` to a plan upgrade, update it to handle both `starter` and `business` plan types:

```typescript
case 'checkout.session.completed': {
  const session = event.data.object;
  const tenantId = session.metadata?.tenant_id;
  const plan = session.metadata?.plan;  // 'starter' or 'business'
  if (tenantId && plan) {
    await this.upgradeTenant(tenantId, plan);
  }
  break;
}
```

Make sure the checkout session creation includes `plan` in metadata:

```typescript
const session = await stripe.checkout.sessions.create({
  // ...
  metadata: { tenant_id: tenantId, plan },
  subscription_data: {
    metadata: { tenant_id: tenantId, plan },
  },
});
```

## Verification

After all changes:

1. `turbo build` succeeds
2. Landing page shows 4 tiers in CHF with correct pricing
3. "Founding Customer" banner appears below pricing
4. FINMA mentioned in Enterprise features
5. No remaining references to "Team" plan (search for `'team'` in plan contexts)
6. Plan limits are correct for all 4 tiers
7. Rate limits updated for 4 tiers
8. If Stripe is configured: checkout works for Starter (CHF 199) and Business (CHF 999)
9. Upgrade modal shows correct next tier based on current plan
10. README pricing table updated

## Acceptance Criteria

- [ ] Landing page: 4 pricing tiers in CHF (0, 199, 999, 3000+)
- [ ] Landing page: Business tier highlighted as "Most Popular"
- [ ] Landing page: "Founding Customer Offer" banner with 50% off messaging
- [ ] Landing page: FINMA in Enterprise features
- [ ] Plan limits: 4 tiers (free, starter, business, enterprise) with correct limits
- [ ] Rate limits: 4 tiers with correct rates
- [ ] All references to "team" plan renamed to "business"
- [ ] Stripe: two prices in CHF (starter CHF 199, business CHF 999) — create via CLI or note for manual creation
- [ ] Billing service: supports `plan` parameter in checkout
- [ ] Upgrade modal: shows correct next tier for each current plan
- [ ] README: pricing table updated with CHF and 4 tiers
- [ ] `turbo build` succeeds
