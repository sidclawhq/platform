'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Toaster } from 'sonner';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { AuthProvider } from '@/lib/auth-context';
import { BillingProvider } from '@/lib/billing-context';
import { OnboardingKeyDialog } from '@/components/onboarding/OnboardingKeyDialog';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { api } from '@/lib/api-client';

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === 'true';

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  useEffect(() => {
    if (!isOnboarding) return;

    // Check sessionStorage first (email signup stores it there)
    const storedKey = sessionStorage.getItem('onboarding_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setShowKeyDialog(true);
      setShowChecklist(true);
      sessionStorage.removeItem('onboarding_api_key');
      return;
    }

    // For OAuth signups, fetch the key from the API
    api.get<{ data: { api_key: string } }>('/api/v1/auth/onboarding-key')
      .then((res) => {
        if (res.data.api_key) {
          setApiKey(res.data.api_key);
          setShowKeyDialog(true);
          setShowChecklist(true);
        }
      })
      .catch(() => {
        // Key may have already been shown, just show checklist
        setShowChecklist(true);
      });
  }, [isOnboarding]);

  const handleDismissKeyDialog = useCallback(() => {
    setShowKeyDialog(false);
    setApiKey(null);

    // Mark copy_api_key step as complete
    api.updateOnboarding({ copy_api_key: true }).catch(() => {});

    // Clean onboarding param from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('onboarding');
    window.history.replaceState({}, '', url.toString());
  }, []);

  return (
    <>
      <div className="flex h-screen bg-surface-0">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto p-6">
            {showChecklist && <OnboardingChecklist />}
            {children}
          </main>
        </div>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: 'var(--surface-1)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              fontSize: '13px',
            },
          }}
        />
      </div>
      {showKeyDialog && apiKey && (
        <OnboardingKeyDialog apiKey={apiKey} onDismiss={handleDismissKeyDialog} />
      )}
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <BillingProvider>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-surface-0">
              <div className="text-sm text-text-secondary">Loading...</div>
            </div>
          }
        >
          <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </Suspense>
      </BillingProvider>
    </AuthProvider>
  );
}
