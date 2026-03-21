"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CTAFooter() {
  const [copied, setCopied] = useState(false);

  function copyInstall() {
    navigator.clipboard.writeText("npm install @sidclaw/sdk");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="px-6 py-24 border-t border-border-default">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Get started in 2 minutes
        </h2>
        <div className="mt-10">
          <a
            href="https://app.sidclaw.com/signup"
            className="inline-block rounded-lg bg-accent-blue px-8 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Create Free Account
          </a>
        </div>
        <p className="mt-6 text-sm text-text-muted">or</p>
        <div className="mt-4 inline-flex items-center gap-3 rounded-lg border border-border-default bg-surface-1 px-4 py-2">
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
