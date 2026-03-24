"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";

export function V2Hero() {
  const [copiedNpx, setCopiedNpx] = useState(false);
  const [copiedPip, setCopiedPip] = useState(false);

  function copyNpx() {
    navigator.clipboard.writeText("npx create-sidclaw-app my-agent");
    setCopiedNpx(true);
    setTimeout(() => setCopiedNpx(false), 2000);
  }

  function copyPip() {
    navigator.clipboard.writeText("pip install sidclaw");
    setCopiedPip(true);
    setTimeout(() => setCopiedPip(false), 2000);
  }

  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-16 md:pt-40 md:pb-20">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.15) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[900px] text-center">
        {/* H1 */}
        <h1 className="text-[42px] sm:text-[56px] md:text-[68px] font-medium tracking-[-0.04em] leading-[1.05] text-white">
          The missing control plane
          <br />
          <span className="bg-gradient-to-r from-[#93C5FD] via-[#60A5FA] to-[#38BDF8] bg-clip-text text-transparent">
            for agentic AI
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-[560px] text-[17px] sm:text-[19px] leading-[1.6] text-text-muted">
          Enterprise governance infrastructure for AI agents. Identity, policy,
          human approval, and tamper-evident audit — in a single platform.
        </p>

        {/* Dual CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://app.sidclaw.com/signup"
            className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-7 py-3 text-[15px] font-medium text-white hover:bg-[#2563EB] transition-colors shadow-[0_0_30px_rgba(59,130,246,0.2)]"
          >
            Start Free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="mailto:hello@sidclaw.com"
            className="inline-flex items-center gap-2 text-[15px] font-medium text-text-secondary hover:text-white transition-colors group"
          >
            Talk to sales
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* CLI Quick Start — two boxes side by side */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-5">
          {/* npx box */}
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center gap-3 rounded-xl border border-accent-blue/30 bg-surface-1 px-5 py-3">
              <span className="text-[12px] font-medium text-accent-blue">$</span>
              <code className="font-mono text-[14px] text-white">
                npx create-sidclaw-app my-agent
              </code>
              <button
                onClick={copyNpx}
                className="text-text-muted hover:text-white transition-colors"
                aria-label="Copy npx command"
              >
                {copiedNpx ? (
                  <Check className="h-4 w-4 text-accent-green" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-text-muted">
              Scaffold a governed agent in 60 seconds
            </p>
          </div>

          {/* pip box */}
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center gap-3 rounded-xl border border-accent-green/30 bg-surface-1 px-5 py-3">
              <span className="text-[12px] font-medium text-accent-green">$</span>
              <code className="font-mono text-[14px] text-white">
                pip install sidclaw
              </code>
              <button
                onClick={copyPip}
                className="text-text-muted hover:text-white transition-colors"
                aria-label="Copy pip command"
              >
                {copiedPip ? (
                  <Check className="h-4 w-4 text-accent-green" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-text-muted">
              Python SDK with sync and async clients
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
