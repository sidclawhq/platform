'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/password-reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Reset link is invalid or has expired.');
        return;
      }
      setDone(true);
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
          <h1 className="text-2xl font-semibold tracking-tight text-[#E4E4E7]">Choose a new password</h1>
        </div>

        {!token ? (
          <div className="space-y-6">
            <div className="rounded-md border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3 text-center text-sm text-[#EF4444]">
              This reset link is missing its token. Use the link from your email, or request a new one.
            </div>
            <p className="text-center text-sm text-[#71717A]">
              <Link href="/forgot-password" className="text-[#3B82F6] hover:underline">
                Request a new link
              </Link>
            </p>
          </div>
        ) : done ? (
          <div className="space-y-6">
            <div className="rounded-md border border-[#22C55E]/20 bg-[#22C55E]/5 px-4 py-3 text-center text-sm text-[#22C55E]">
              Password updated. All existing sessions were signed out.
            </div>
            <p className="text-center text-sm text-[#71717A]">
              <Link href="/login" className="text-[#3B82F6] hover:underline">
                Sign in with your new password
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
              <label htmlFor="password" className="block text-sm font-medium text-[#A1A1AA]">
                New password
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
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-[#A1A1AA]">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                placeholder="Repeat the password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-[#E4E4E7] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] transition-colors hover:bg-[#D4D4D8] disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
