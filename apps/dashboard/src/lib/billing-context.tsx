'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface BillingContextValue {
  currentPlan: string;
  showUpgradePrompt: (limitName: string, current: number, max: number) => void;
}

const BillingContext = createContext<BillingContextValue>({ currentPlan: 'free', showUpgradePrompt: () => {} });

export function BillingProvider({ children }: { children: ReactNode }) {
  return (
    <BillingContext.Provider value={{ currentPlan: 'free', showUpgradePrompt: () => {} }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  return useContext(BillingContext);
}
