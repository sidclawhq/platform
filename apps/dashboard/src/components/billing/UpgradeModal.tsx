'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitName: string;
  current: number;
  max: number;
  currentPlan: string;
}

const LIMIT_LABELS: Record<string, string> = {
  max_agents: 'agents',
  max_policies_per_agent: 'policies per agent',
  max_api_keys: 'API keys',
  max_webhook_endpoints: 'webhook endpoints',
  max_users: 'users',
};

interface UpgradeTarget {
  plan: string;
  name: string;
  price: string;
  features: string[];
}

function getUpgradeTarget(currentPlan: string): UpgradeTarget | null {
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
      return null; // Enterprise is manual
    default:
      return null;
  }
}

export function UpgradeModal({ isOpen, onClose, limitName, current, max, currentPlan }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const displayName = LIMIT_LABELS[limitName] ?? limitName.replace(/_/g, ' ');
  const target = getUpgradeTarget(currentPlan);

  const handleUpgrade = async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>('/api/v1/billing/checkout', { plan: target.plan });
      window.location.href = url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      if (message.includes('not configured') || message.includes('501')) {
        setError('Contact hello@sidclaw.com to upgrade.');
      } else {
        setError(message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-border-default bg-surface-1 p-6">
        {target ? (
          <>
            <h2 className="text-lg font-medium text-text-primary">
              Upgrade to {target.name}
            </h2>

            <p className="mt-3 text-sm text-text-secondary">
              You&apos;ve reached <span className="text-accent-amber font-medium">{current}/{max} {displayName}</span> on
              the {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan.
            </p>

            <div className="mt-4 rounded-lg bg-surface-0 border border-border-default p-4">
              <div className="text-sm font-medium text-text-primary">{target.name} Plan — {target.price}</div>
              <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                {target.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>

            {error && (
              <p className="mt-3 text-sm text-accent-red">{error}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded bg-surface-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Not now
              </button>
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="flex-1 rounded bg-accent-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {loading ? 'Redirecting...' : `Upgrade to ${target.name}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-medium text-text-primary">
              Plan Limit Reached
            </h2>

            <p className="mt-3 text-sm text-text-secondary">
              You&apos;ve reached <span className="text-accent-amber font-medium">{current}/{max} {displayName}</span> on
              the {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan.
            </p>

            <p className="mt-3 text-sm text-text-secondary">
              Contact{' '}
              <a href="mailto:hello@sidclaw.com" className="text-accent-blue hover:underline">
                hello@sidclaw.com
              </a>{' '}
              for Enterprise pricing.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="rounded bg-surface-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
