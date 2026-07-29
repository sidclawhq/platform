'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setError('Too many reset requests. Please wait a few minutes and try again.');
        return;
      }
      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#E4E4E7]">Reset your password</h1>
          <p className="mt-2 text-sm text-[#71717A]">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="rounded-md border border-[#22C55E]/20 bg-[#22C55E]/5 px-4 py-3 text-center text-sm text-[#22C55E]">
              If an account exists for that address, a reset link is on its way. The link expires in 1 hour.
            </div>
            <p className="text-center text-sm text-[#71717A]">
              <Link href="/login" className="text-[#3B82F6] hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3 text-center text-sm text-[#EF4444]">
                {error}
              </div>
            )}
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-[#E4E4E7] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] transition-colors hover:bg-[#D4D4D8] disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-[#71717A]">
              <Link href="/login" className="text-[#3B82F6] hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
