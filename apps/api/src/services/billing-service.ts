import Stripe from 'stripe';
import { PrismaClient } from '../generated/prisma/index.js';

function getStripe(): Stripe | null {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) return null;
  return new Stripe(key);
}

const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env['STRIPE_STARTER_PRICE_ID'],
  business: process.env['STRIPE_BUSINESS_PRICE_ID'],
};

export class BillingService {
  constructor(private readonly prisma: PrismaClient) {}

  private requireStripe(): Stripe {
    const stripe = getStripe();
    if (!stripe) {
      throw Object.assign(new Error('Billing not configured'), { statusCode: 501 });
    }
    return stripe;
  }

  /**
   * Get or create a Stripe customer for a tenant.
   */
  async getOrCreateCustomer(tenantId: string): Promise<string> {
    const stripe = this.requireStripe();
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
   * Create a Stripe Checkout session for upgrading to a paid plan.
   * Returns the checkout URL to redirect the user to.
   */
  async createCheckoutSession(tenantId: string, plan: 'starter' | 'business', returnUrl: string): Promise<string> {
    const stripe = this.requireStripe();
    const customerId = await this.getOrCreateCustomer(tenantId);

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      throw new Error(`Price not configured for plan: ${plan}`);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}?upgrade=success`,
      cancel_url: `${returnUrl}?upgrade=cancelled`,
      metadata: { tenant_id: tenantId, plan },
      subscription_data: {
        metadata: { tenant_id: tenantId, plan },
      },
    });

    return session.url!;
  }

  /**
   * Create a Stripe Customer Portal session for managing subscription.
   * Returns the portal URL.
   */
  async createPortalSession(tenantId: string, returnUrl: string): Promise<string> {
    const stripe = this.requireStripe();
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
        const plan = session.metadata?.plan;
        if (tenantId && plan) {
          await this.upgradeTenant(tenantId, plan);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenant_id;
        const plan = subscription.metadata?.plan;
        if (tenantId) {
          if (subscription.status === 'active' && plan) {
            await this.upgradeTenant(tenantId, plan);
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

    const stripe = getStripe();
    if (!stripe) {
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

      const firstItem = sub.items?.data[0];
      const periodEnd = firstItem?.current_period_end;

      return {
        plan: tenant.plan,
        status: sub.status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      };
    } catch {
      return { plan: tenant.plan, status: null, current_period_end: null, cancel_at_period_end: false };
    }
  }
}
