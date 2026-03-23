"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function Hero() {
  const [copiedCli, setCopiedCli] = useState(false);

  function copyCliCommand() {
    navigator.clipboard.writeText("npx create-sidclaw-app my-agent");
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
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

        {/* Performance badge */}
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-border-default bg-surface-1 px-5 py-2 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-green" />
            {"<"}50ms overhead
          </span>
          <span className="text-border-default">·</span>
          <span>Open source SDK</span>
          <span className="text-border-default">·</span>
          <span>TypeScript + Python</span>
        </div>

        {/* Primary: create-sidclaw-app */}
        <div className="mt-8 rounded-lg border border-border-default bg-surface-1 p-6 mx-auto max-w-xl">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-3">
            Try it in 60 seconds
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 font-mono text-base text-text-primary bg-surface-0 px-4 py-3 rounded border border-border-default text-left">
              npx create-sidclaw-app my-agent
            </code>
            <button
              onClick={copyCliCommand}
              className="text-text-muted transition-colors hover:text-text-primary"
              aria-label="Copy create-sidclaw-app command"
            >
              {copiedCli ? (
                <Check className="h-4 w-4 text-accent-green" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="mt-3 text-sm text-text-muted text-left">
            Creates a working governed agent with 3 demo tools. No signup or configuration needed.
          </div>
        </div>

        {/* Secondary: pip version */}
        <div className="mt-3 flex items-center justify-center gap-3 text-sm text-text-muted">
          <span>Python:</span>
          <code className="font-mono text-text-secondary">pip install sidclaw && python -m sidclaw.quickstart</code>
        </div>

        {/* Demo buttons */}
        <div className="mt-6 text-center">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-3">
            or try an interactive demo — no signup needed
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://demo.sidclaw.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border-default bg-surface-1 px-4 py-2.5 text-sm text-text-primary hover:border-accent-amber/50 transition-colors"
            >
              🏦 Finance Demo
            </a>
            <a
              href="https://demo-devops.sidclaw.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border-default bg-surface-1 px-4 py-2.5 text-sm text-text-primary hover:border-accent-blue/50 transition-colors"
            >
              🔧 DevOps Demo
            </a>
            <a
              href="https://demo-health.sidclaw.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border-default bg-surface-1 px-4 py-2.5 text-sm text-text-primary hover:border-accent-green/50 transition-colors"
            >
              🏥 Healthcare Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
