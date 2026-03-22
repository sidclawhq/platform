"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function Hero() {
  const [copied, setCopied] = useState(false);

  function copyInstall() {
    navigator.clipboard.writeText("npm install @sidclaw/sdk");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="px-6 pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
          The approval and accountability
          <br />
          layer for agentic AI
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary">
          Your agents need identity, policy, and human oversight.
          <br className="hidden sm:block" />
          Not another IAM — the governance layer that&apos;s missing.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="https://app.sidclaw.com/signup"
            className="rounded-lg bg-accent-blue px-8 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Get Started Free
          </a>
          <a
            href="https://github.com/sidclawhq/platform"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border-default px-8 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            View on GitHub
          </a>
        </div>
        <div className="mt-4 text-sm text-[#71717A]">
          or <a href="#demos" className="text-[#3B82F6] hover:underline">try an interactive demo</a> — no signup needed
        </div>
        <div className="mt-8 inline-flex items-center gap-3 rounded-lg border border-border-default bg-surface-1 px-4 py-2">
          <code className="font-mono text-sm text-text-muted">
            npm install @sidclaw/sdk
          </code>
          <button
            onClick={copyInstall}
            className="text-text-muted transition-colors hover:text-text-primary"
            aria-label="Copy install command"
          >
            {copied ? (
              <Check className="h-4 w-4 text-accent-green" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
