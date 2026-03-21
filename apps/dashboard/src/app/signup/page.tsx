'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function SignupContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOAuth = (provider: 'github' | 'google') => {
    window.location.href = `${API_URL}/api/v1/auth/${provider}?redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard?onboarding=true')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message ?? 'Signup failed. Please try again.');
        return;
      }

      // Store API key for onboarding display
      if (data.api_key) {
        sessionStorage.setItem('onboarding_api_key', data.api_key);
      }

      window.location.href = '/dashboard?onboarding=true';
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = formError ?? (urlError === 'provider_mismatch'
    ? 'An account with this email already exists using a different sign-in method.'
    : urlError
      ? 'Something went wrong. Please try again.'
      : null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#E4E4E7]">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-[#71717A]">
            Get started with Agent Identity
          </p>
        </div>

        {displayError && (
          <div className="rounded-md border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3 text-center text-sm text-[#EF4444]">
            {displayError}
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleOAuth('github')}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#27272A] bg-[#18181B] px-4 py-2.5 text-sm font-medium text-[#E4E4E7] transition-colors hover:bg-[#27272A]"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
            </svg>
            Continue with GitHub
          </button>

          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-[#27272A] bg-[#18181B] px-4 py-2.5 text-sm font-medium text-[#E4E4E7] transition-colors hover:bg-[#27272A]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#27272A]" />
          <span className="text-xs text-[#71717A]">or</span>
          <div className="h-px flex-1 bg-[#27272A]" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[#A1A1AA]">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#A1A1AA]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#A1A1AA]">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#E4E4E7] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] transition-colors hover:bg-[#D4D4D8] disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#71717A]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#3B82F6] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
          <div className="text-sm text-[#71717A]">Loading...</div>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
