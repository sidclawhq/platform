'use client';

import { useState } from 'react';

interface OnboardingKeyDialogProps {
  apiKey: string;
  onDismiss: () => void;
}

export function OnboardingKeyDialog({ apiKey, onDismiss }: OnboardingKeyDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = apiKey;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Your API Key
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Use this key to authenticate your agents with the Agent Identity API.
        </p>

        {/* API Key Display */}
        <div className="mt-4 rounded-md border border-[var(--border-default)] bg-[var(--surface-0)] p-4">
          <code className="block break-all font-mono text-sm text-[var(--text-primary)]">
            {apiKey}
          </code>
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-1)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-2)]"
        >
          {copied ? (
            <>
              <svg className="h-4 w-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy to clipboard
            </>
          )}
        </button>

        {/* Warning */}
        <div className="mt-4 rounded-md border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-4 py-3 text-sm text-[#F59E0B]">
          This is the only time this key will be displayed. Store it securely.
        </div>

        {/* Dismiss */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--surface-0)] transition-colors hover:opacity-90"
          >
            I&apos;ve copied it
          </button>
        </div>
      </div>
    </div>
  );
}
