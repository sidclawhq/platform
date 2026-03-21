'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function LoginContent() {
  const searchParams = useSearchParams();
  const expired = searchParams.get('expired') === 'true';
  const error = searchParams.get('error');

  const handleLogin = () => {
    window.location.href = `${API_URL}/api/v1/auth/login?redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard')}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#E4E4E7]">
            Agent Identity
          </h1>
          <p className="mt-2 text-sm text-[#71717A]">
            Sign in to continue
          </p>
        </div>

        {expired && (
          <div className="rounded-md border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-4 py-3 text-center text-sm text-[#F59E0B]">
            Session expired, please sign in again
          </div>
        )}

        {error && (
          <div className="rounded-md border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3 text-center text-sm text-[#EF4444]">
            Authentication failed. Please try again.
          </div>
        )}

        <button
          type="button"
          onClick={handleLogin}
          className="w-full rounded-md bg-[#E4E4E7] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] transition-colors hover:bg-[#D4D4D8]"
        >
          Sign in with SSO
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="text-sm text-[#71717A]">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
