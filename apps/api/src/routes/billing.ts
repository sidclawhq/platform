import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { BillingService } from '../services/billing-service.js';
import { requireRole } from '../middleware/require-role.js';
import { prisma } from '../db/client.js';

export async function billingRoutes(app: FastifyInstance) {
  const billingService = new BillingService(prisma);

  // POST /api/v1/billing/checkout — create Stripe Checkout session
  // Admin only
  app.post('/billing/checkout', {
    preHandler: [requireRole('admin')],
  }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const { plan } = (request.body as { plan?: string }) ?? {};

    if (!plan || !['starter', 'business'].includes(plan)) {
      return reply.status(400).send({
        error: 'validation_error',
        message: 'Invalid plan. Use starter or business.',
        status: 400,
      });
    }

    const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000';
    const returnUrl = `${dashboardUrl}/dashboard/settings/billing`;

    try {
      const checkoutUrl = await billingService.createCheckoutSession(tenantId, plan as 'starter' | 'business', returnUrl);
      return reply.send({ url: checkoutUrl });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 501) {
        return reply.status(501).send({
          error: 'billing_not_configured',
          message: 'Billing not configured. Contact hello@sidclaw.com to upgrade.',
          status: 501,
        });
      }
      throw err;
    }
  });

  // POST /api/v1/billing/portal — create Stripe Customer Portal session
  // Admin only — for managing existing subscription
  app.post('/billing/portal', {
    preHandler: [requireRole('admin')],
  }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000';
    const returnUrl = `${dashboardUrl}/dashboard/settings/billing`;

    try {
      const portalUrl = await billingService.createPortalSession(tenantId, returnUrl);
      return reply.send({ url: portalUrl });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 501) {
        return reply.status(501).send({
          error: 'billing_not_configured',
          message: 'Billing not configured. Contact hello@sidclaw.com to manage subscription.',
          status: 501,
        });
      }
      throw err;
    }
  });

  // GET /api/v1/billing/status — get subscription status
  app.get('/billing/status', async (request, reply) => {
    const tenantId = request.tenantId!;
    const status = await billingService.getSubscriptionStatus(tenantId);
    return reply.send({ data: status });
  });

  // POST /api/v1/billing/webhook — Stripe webhook endpoint
  // NO AUTH — Stripe calls this directly. Verify signature instead.
  app.post('/billing/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

    if (!sig || !webhookSecret) {
      return reply.status(400).send({ error: 'Missing signature or webhook secret' });
    }

    const stripeKey = process.env['STRIPE_SECRET_KEY'];
    if (!stripeKey) {
      return reply.status(501).send({ error: 'Billing not configured' });
    }

    const stripe = new Stripe(stripeKey);

    let event: Stripe.Event;
    try {
      // Use raw body stored by the custom content type parser
      const rawBody = (request as unknown as Record<string, unknown>).rawBody as string | undefined;
      const bodyStr = rawBody ?? (typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
      event = stripe.webhooks.constructEvent(bodyStr, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    await billingService.handleWebhookEvent(event);
    return reply.status(200).send({ received: true });
  });
}
