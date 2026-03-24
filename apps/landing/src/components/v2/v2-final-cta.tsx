"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";

export function V2FinalCTA() {
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
    <section
      className="px-6 py-16 md:py-24"
      style={{
        background: "linear-gradient(180deg, #060610 0%, #080A14 50%, #060610 100%)",
      }}
    >
      <div className="mx-auto max-w-[800px] text-center">
        <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
          Start governing your agents
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-[#93C5FD] via-[#60A5FA] to-[#38BDF8] bg-clip-text text-transparent">
            today
          </span>
        </h2>

        <p className="mx-auto mt-5 max-w-[480px] text-[16px] leading-[1.6] text-text-secondary">
          Free to start. No credit card required. Enterprise self-hosting available.
        </p>

        {/* Dual CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-5">
          <a
            href="https://app.sidclaw.com/signup"
            className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-8 py-3 text-[15px] font-medium text-white hover:bg-[#2563EB] transition-colors shadow-[0_0_30px_rgba(59,130,246,0.2)]"
          >
            Start Building Free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="mailto:hello@sidclaw.com"
            className="inline-flex items-center gap-2 rounded-full border border-border-muted px-8 py-3 text-[15px] font-medium text-text-secondary hover:text-white hover:border-[#3B82F6]/40 transition-colors"
          >
            Talk to Sales
          </a>
        </div>

        {/* Quick start — two boxes */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-5">
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center gap-3 rounded-xl border border-accent-blue/30 bg-[#0A0B14] px-5 py-3">
              <span className="text-[12px] font-medium text-accent-blue">$</span>
              <code className="font-mono text-[14px] text-white">npx create-sidclaw-app my-agent</code>
              <button
                onClick={copyNpx}
                className="text-text-muted hover:text-white transition-colors"
                aria-label="Copy npx command"
              >
                {copiedNpx ? <Check className="h-4 w-4 text-accent-green" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-text-muted">Scaffold a governed agent in 60 seconds</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="inline-flex items-center gap-3 rounded-xl border border-accent-green/30 bg-[#0A0B14] px-5 py-3">
              <span className="text-[12px] font-medium text-accent-green">$</span>
              <code className="font-mono text-[14px] text-white">pip install sidclaw</code>
              <button
                onClick={copyPip}
                className="text-text-muted hover:text-white transition-colors"
                aria-label="Copy pip command"
              >
                {copiedPip ? <Check className="h-4 w-4 text-accent-green" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-text-muted">Python SDK with sync and async clients</p>
          </div>
        </div>
        {/* Stats bar */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-[13px] text-text-muted">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
            {"<"}50ms overhead
          </span>
          <span className="hidden sm:inline text-border-muted">|</span>
          <span>Open source SDK</span>
          <span className="hidden sm:inline text-border-muted">|</span>
          <span>TypeScript + Python</span>
          <span className="hidden sm:inline text-border-muted">|</span>
          <span>Self-host or cloud</span>
        </div>
      </div>
    </section>
  );
}
