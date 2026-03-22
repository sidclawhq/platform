'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';

interface BillingStatus {
  plan: string;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

function getNextPlan(current: string): { plan: string; name: string; price: string } | null {
  switch (current) {
    case 'free':
      return { plan: 'starter', name: 'Starter', price: 'CHF 199/mo' };
    case 'starter':
      return { plan: 'business', name: 'Business', price: 'CHF 999/mo' };
    default:
      return null;
  }
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [stripeConfigured, setStripeConfigured] = useState(true);

  useEffect(() => {
    api.get<{ data: BillingStatus }>('/api/v1/billing/status')
      .then((res) => setStatus(res.data))
      .catch(() => setStatus({ plan: 'free', status: null, current_period_end: null, cancel_at_period_end: false }))
      .finally(() => setLoading(false));
  }, []);

  // Handle upgrade success/cancel redirect
  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      toast.success('Plan upgraded! Your limits have been increased.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (searchParams.get('upgrade') === 'cancelled') {
      toast.info('Upgrade cancelled. You can upgrade anytime from Settings.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const handleUpgrade = async (plan: string) => {
    try {
      const { url } = await api.post<{ url: string }>('/api/v1/billing/checkout', { plan });
      window.location.href = url;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 501) {
        setStripeConfigured(false);
        toast.error('Billing not configured. Contact hello@sidclaw.com to upgrade.');
      } else {
        toast.error('Failed to start checkout. Please try again.');
      }
    }
  };

  const handleManage = async () => {
    try {
      const { url } = await api.post<{ url: string }>('/api/v1/billing/portal', {});
      window.location.href = url;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 501) {
        setStripeConfigured(false);
        toast.error('Billing not configured. Contact hello@sidclaw.com to manage subscription.');
      } else {
        toast.error('Failed to open billing portal. Please try again.');
      }
    }
  };

  if (loading) return <div className="text-text-muted">Loading...</div>;

  const currentPlan = status?.plan ?? 'free';
  const nextPlan = getNextPlan(currentPlan);
  const isPaying = currentPlan !== 'free';

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-text-primary">Billing</h1>

      <div className="rounded-lg border border-border-default bg-surface-1 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">
              Current Plan: <span className="text-accent-blue uppercase">{currentPlan}</span>
            </div>
            {status?.current_period_end && (
              <div className="mt-1 text-xs text-text-muted">
                {status.cancel_at_period_end
                  ? `Cancels on ${new Date(status.current_period_end).toLocaleDateString()}`
                  : `Renews on ${new Date(status.current_period_end).toLocaleDateString()}`
                }
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {nextPlan && stripeConfigured && (
              <button
                onClick={() => handleUpgrade(nextPlan.plan)}
                className="rounded bg-accent-blue px-6 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Upgrade to {nextPlan.name} — {nextPlan.price}
              </button>
            )}
            {nextPlan && !stripeConfigured && (
              <a
                href="mailto:hello@sidclaw.com"
                className="rounded bg-accent-blue px-6 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Contact hello@sidclaw.com to Upgrade
              </a>
            )}
            {isPaying && (
              <button
                onClick={handleManage}
                className="rounded border border-border-default px-6 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Manage Subscription
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plan comparison */}
      <div className="rounded-lg border border-border-default bg-surface-1 p-6">
        <h2 className="text-sm font-medium text-text-primary mb-4">Plan Comparison</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-muted uppercase">
              <th className="text-left py-2">Feature</th>
              <th className="text-center py-2">Free</th>
              <th className="text-center py-2">Starter</th>
              <th className="text-center py-2">Business</th>
              <th className="text-center py-2">Enterprise</th>
            </tr>
          </thead>
          <tbody className="text-text-secondary">
            <tr className="border-t border-border-default"><td className="py-2">Price</td><td className="text-center">CHF 0/mo</td><td className="text-center">CHF 199/mo</td><td className="text-center">CHF 999/mo</td><td className="text-center">From CHF 3,000/mo</td></tr>
            <tr className="border-t border-border-default"><td className="py-2">Agents</td><td className="text-center">5</td><td className="text-center">15</td><td className="text-center">100</td><td className="text-center">Unlimited</td></tr>
            <tr className="border-t border-border-default"><td className="py-2">Policies per agent</td><td className="text-center">10</td><td className="text-center">50</td><td className="text-center">Unlimited</td><td className="text-center">Unlimited</td></tr>
            <tr className="border-t border-border-default"><td className="py-2">API keys</td><td className="text-center">2</td><td className="text-center">5</td><td className="text-center">20</td><td className="text-center">Unlimited</td></tr>
            <tr className="border-t border-border-default"><td className="py-2">Trace retention</td><td className="text-center">7 days</td><td className="text-center">30 days</td><td className="text-center">90 days</td><td className="text-center">Custom</td></tr>
            <tr className="border-t border-border-default"><td className="py-2">Webhooks</td><td className="text-center">1</td><td className="text-center">3</td><td className="text-center">10</td><td className="text-center">Unlimited</td></tr>
            <tr className="border-t border-border-default"><td className="py-2">SSO/OIDC</td><td className="text-center">—</td><td className="text-center">—</td><td className="text-center">Yes</td><td className="text-center">Yes</td></tr>
            <tr className="border-t border-border-default"><td className="py-2">Support</td><td className="text-center">Community</td><td className="text-center">Email</td><td className="text-center">Priority</td><td className="text-center">Dedicated + SLA</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
