"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function Hero() {
  const [copiedNpm, setCopiedNpm] = useState(false);
  const [copiedPip, setCopiedPip] = useState(false);

  function copyNpmInstall() {
    navigator.clipboard.writeText("npm install @sidclaw/sdk");
    setCopiedNpm(true);
    setTimeout(() => setCopiedNpm(false), 2000);
  }

  function copyPipInstall() {
    navigator.clipboard.writeText("pip install sidclaw");
    setCopiedPip(true);
    setTimeout(() => setCopiedPip(false), 2000);
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
        <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <div className="inline-flex items-center gap-3 rounded-lg border border-border-default bg-surface-1 px-4 py-2">
            <code className="font-mono text-sm text-text-muted">
              npm install @sidclaw/sdk
            </code>
            <button
              onClick={copyNpmInstall}
              className="text-text-muted transition-colors hover:text-text-primary"
              aria-label="Copy npm install command"
            >
              {copiedNpm ? (
                <Check className="h-4 w-4 text-accent-green" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="inline-flex items-center gap-3 rounded-lg border border-border-default bg-surface-1 px-4 py-2">
            <code className="font-mono text-sm text-text-muted">
              pip install sidclaw
            </code>
            <button
              onClick={copyPipInstall}
              className="text-text-muted transition-colors hover:text-text-primary"
              aria-label="Copy pip install command"
            >
              {copiedPip ? (
                <Check className="h-4 w-4 text-accent-green" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-8 mx-auto max-w-xl">
          <div className="text-xs uppercase tracking-wider text-[#71717A] mb-2 text-left">5 lines to govern any tool</div>
          <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-5 text-left font-mono text-sm leading-relaxed">
            <div className="text-[#71717A]">{"// Before: your agent calls tools directly"}</div>
            <div className="text-[#E4E4E7]">
              <span className="text-[#C084FC]">await</span> <span className="text-[#60A5FA]">sendEmail</span>(customer, subject, body);
            </div>
            <div className="mt-3 text-[#71717A]">{"// After: one wrapper, full governance"}</div>
            <div className="text-[#E4E4E7]">
              <span className="text-[#C084FC]">const</span> governed = <span className="text-[#60A5FA]">withGovernance</span>(client, {"{"}<br />
              <span className="ml-4 text-[#A1A1AA]">operation</span>: <span className="text-[#22C55E]">&apos;send_email&apos;</span>,<br />
              <span className="ml-4 text-[#A1A1AA]">data_classification</span>: <span className="text-[#22C55E]">&apos;confidential&apos;</span>,<br />
              {"}"}, sendEmail);
            </div>
            <div className="mt-3 text-[#E4E4E7]">
              <span className="text-[#C084FC]">await</span> <span className="text-[#60A5FA]">governed</span>(customer, subject, body);
            </div>
            <div className="text-[#71717A]">{"// → Policy evaluates → Approval if needed → Trace recorded"}</div>
          </div>
          <p className="text-xs text-[#71717A] mt-2">
            Also available in Python: <code className="font-mono">pip install sidclaw</code>
            {' '}<a href="https://docs.sidclaw.com/docs/quickstart" className="text-[#3B82F6] hover:underline">Python quick start →</a>
          </p>
        </div>
      </div>
    </section>
  );
}
