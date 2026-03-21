'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface OnboardingState {
  copy_api_key: boolean;
  register_agent: boolean;
  create_policy: boolean;
  run_evaluation: boolean;
  see_trace: boolean;
}

const STEPS: { key: keyof OnboardingState; label: string; href: string }[] = [
  { key: 'copy_api_key', label: 'Copy API key', href: '/dashboard/settings' },
  { key: 'register_agent', label: 'Register agent', href: '/dashboard/agents' },
  { key: 'create_policy', label: 'Create policy', href: '/dashboard/policies' },
  { key: 'run_evaluation', label: 'Run evaluation', href: '/dashboard/agents' },
  { key: 'see_trace', label: 'See trace', href: '/dashboard/audit' },
];

export function OnboardingChecklist() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.getOnboarding()
      .then((res) => setState(res.data))
      .catch(() => {
        // If the endpoint doesn't exist or fails, hide the checklist
        setDismissed(true);
      });
  }, []);

  if (dismissed || !state) return null;

  const allComplete = STEPS.every((step) => state[step.key]);
  if (allComplete) return null;

  const completedCount = STEPS.filter((step) => state[step.key]).length;

  return (
    <div className="mb-6 rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Getting started
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {completedCount} of {STEPS.length} steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="Dismiss checklist"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Steps */}
      <div className="mt-4 flex items-center gap-2">
        {STEPS.map((step, index) => {
          const isComplete = state[step.key];
          return (
            <div key={step.key} className="flex items-center gap-2">
              {index > 0 && (
                <div
                  className={`h-px w-6 ${
                    isComplete ? 'bg-[#22C55E]' : 'bg-[var(--border-default)]'
                  }`}
                />
              )}
              <Link
                href={step.href}
                className="group flex items-center gap-2"
                title={step.label}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                    isComplete
                      ? 'border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)] group-hover:border-[#3B82F6] group-hover:text-[#3B82F6]'
                  }`}
                >
                  {isComplete ? (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`hidden text-xs sm:inline ${
                    isComplete
                      ? 'text-[#22C55E]'
                      : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                  }`}
                >
                  {step.label}
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
