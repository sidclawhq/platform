'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { api } from '@/lib/api-client';

interface BillingContextValue {
  currentPlan: string;
  showUpgradePrompt: (limitName: string, current: number, max: number) => void;
}

const BillingContext = createContext<BillingContextValue>({ currentPlan: 'free', showUpgradePrompt: () => {} });

export function BillingProvider({ children }: { children: ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState('free');
  const [upgradeState, setUpgradeState] = useState<{
    isOpen: boolean;
    limitName: string;
    current: number;
    max: number;
  }>({ isOpen: false, limitName: '', current: 0, max: 0 });

  // Fetch current plan on mount
  useEffect(() => {
    api.get<{ data: { plan: string } }>('/api/v1/billing/status')
      .then((res) => setCurrentPlan(res.data.plan))
      .catch(() => {}); // silently fail — defaults to free
  }, []);

  const showUpgradePrompt = useCallback((limitName: string, current: number, max: number) => {
    setUpgradeState({ isOpen: true, limitName, current, max });
  }, []);

  // Listen for plan-limit events dispatched by the API client on 402 responses
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { limitName: string; current: number; max: number };
      showUpgradePrompt(detail.limitName, detail.current, detail.max);
    };
    window.addEventListener('sidclaw:plan-limit', handler);
    return () => window.removeEventListener('sidclaw:plan-limit', handler);
  }, [showUpgradePrompt]);

  return (
    <BillingContext.Provider value={{ currentPlan, showUpgradePrompt }}>
      {children}
      <UpgradeModal
        isOpen={upgradeState.isOpen}
        onClose={() => setUpgradeState(prev => ({ ...prev, isOpen: false }))}
        limitName={upgradeState.limitName}
        current={upgradeState.current}
        max={upgradeState.max}
        currentPlan={currentPlan}
      />
    </BillingContext.Provider>
  );
}

export function useBilling() {
  return useContext(BillingContext);
}
