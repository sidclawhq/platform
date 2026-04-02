"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Fingerprint,
  FileCheck,
  ShieldCheck,
  ScrollText,
} from "lucide-react";

const FLOW_STEPS = [
  { label: "Identity", icon: Fingerprint, color: "#3B82F6" },
  { label: "Policy", icon: FileCheck, color: "#3B82F6" },
  { label: "Approval", icon: ShieldCheck, color: "#F59E0B" },
  { label: "Trace", icon: ScrollText, color: "#22C55E" },
];

function DetailRow({
  label,
  value,
  valueClass = "text-text-primary",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-text-secondary uppercase tracking-[0.08em] mb-0.5">
        {label}
      </div>
      <div className={`text-[13px] font-mono ${valueClass}`}>{value}</div>
    </div>
  );
}

export function V2Hero() {
  const [copiedNpx, setCopiedNpx] = useState(false);
  const [copiedPip, setCopiedPip] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((s) => (s + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

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
    <section className="relative overflow-hidden px-6 pt-24 pb-16 md:pt-32 md:pb-20">
      {/* Background: subtle dot grid — infrastructure blueprint feel */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(59,130,246,0.1) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Top-center glow — soft, focused */}
      <div
        className="pointer-events-none absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1000px] h-[600px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 50%, rgba(59,130,246,0.1) 0%, transparent 70%)",
        }}
      />
      {/* Grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      <div className="relative mx-auto max-w-[1200px]">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16 items-center">
          {/* ── Left: messaging ── */}
          <div className="text-center lg:text-left">
            <div className="text-[12px] font-medium tracking-[0.2em] uppercase text-accent-blue mb-5">
              AI Agent Governance
            </div>

            <h1 className="text-[38px] sm:text-[48px] md:text-[56px] font-medium tracking-[-0.04em] leading-[1.08] text-white">
              The missing
              <br />
              control plane
              <br />
              <span className="text-accent-blue">for agentic AI</span>
            </h1>

            <p className="mt-5 mx-auto lg:mx-0 max-w-[440px] text-[16px] leading-[1.65] text-text-secondary">
              Identity, policy, human approval, and tamper-evident audit for AI
              agents. A single SDK call governs every action.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <a
                href="https://app.sidclaw.com/signup"
                className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-6 py-2.5 text-[14px] font-medium text-white hover:bg-[#2563EB] transition-colors"
              >
                Start Free
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* CLI commands — stacked */}
            <div className="mt-8 flex flex-col items-center lg:items-start gap-2.5">
              <div className="inline-flex items-center gap-3 rounded-lg border border-border-muted bg-surface-1 px-4 py-2.5">
                <span className="text-[11px] font-mono font-medium text-accent-blue">
                  $
                </span>
                <code className="font-mono text-[13px] text-text-primary">
                  npx create-sidclaw-app my-agent
                </code>
                <button
                  onClick={copyNpx}
                  className="text-text-muted hover:text-white transition-colors ml-1"
                  aria-label="Copy npx command"
                >
                  {copiedNpx ? (
                    <Check className="h-3.5 w-3.5 text-accent-green" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="inline-flex items-center gap-3 rounded-lg border border-border-muted bg-surface-1 px-4 py-2.5">
                <span className="text-[11px] font-mono font-medium text-accent-green">
                  $
                </span>
                <code className="font-mono text-[13px] text-text-primary">
                  pip install sidclaw
                </code>
                <button
                  onClick={copyPip}
                  className="text-text-muted hover:text-white transition-colors ml-1"
                  aria-label="Copy pip command"
                >
                  {copiedPip ? (
                    <Check className="h-3.5 w-3.5 text-accent-green" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

            </div>

          </div>

          {/* ── Right: governance flow visualization ── */}
          <div className="relative max-w-[560px] mx-auto lg:max-w-none lg:mx-0">
            {/* Glow behind card */}
            <div
              className="absolute inset-0 -m-8 blur-3xl opacity-[0.06]"
              style={{
                background:
                  "radial-gradient(circle, #3B82F6, transparent 70%)",
              }}
            />

            {/* Dashboard mock */}
            <div className="relative rounded-xl border border-border-muted bg-surface-1 overflow-hidden shadow-[0_0_60px_rgba(59,130,246,0.08)]">
              {/* Top bar: four-step flow indicator */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-muted bg-surface-0">
                <div className="flex items-center">
                  {FLOW_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isReached = i <= activeStep;
                    const isCurrent = i === activeStep;
                    return (
                      <div key={step.label} className="flex items-center">
                        <div
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-500 ${
                            isCurrent ? "bg-surface-2" : ""
                          }`}
                        >
                          <Icon
                            className="h-3.5 w-3.5 transition-colors duration-500"
                            style={{
                              color: isReached ? step.color : "#52525B",
                            }}
                          />
                          <span
                            className={`hidden sm:inline text-[11px] font-medium transition-colors duration-500 ${
                              isReached
                                ? "text-text-primary"
                                : "text-text-muted"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {i < 3 && (
                          <div
                            className="w-3 h-px mx-0.5 transition-colors duration-700"
                            style={{
                              backgroundColor:
                                i < activeStep
                                  ? step.color + "50"
                                  : "var(--border-default)",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Window dots */}
                <div className="hidden sm:flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#EF4444]/25" />
                  <div className="w-2 h-2 rounded-full bg-[#F59E0B]/25" />
                  <div className="w-2 h-2 rounded-full bg-[#22C55E]/25" />
                </div>
              </div>

              {/* Card content */}
              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[14px] font-medium text-white">
                      Approval Required
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5 font-mono">
                      apr_x7k9m2 · 12s ago
                    </div>
                  </div>
                  <span className="text-[10px] font-medium font-mono px-2 py-1 rounded-md bg-accent-amber/10 text-accent-amber border border-accent-amber/20 uppercase tracking-[0.1em] whitespace-nowrap">
                    High Risk
                  </span>
                </div>

                {/* Details */}
                <div className="rounded-lg bg-surface-0 border border-border-subtle p-4 mb-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <DetailRow label="Agent" value="customer_support" />
                    <DetailRow label="Operation" value="send_email" />
                    <DetailRow label="Target" value="email_service" />
                    <DetailRow
                      label="Classification"
                      value="confidential"
                      valueClass="text-accent-amber"
                    />
                  </div>
                </div>

                {/* Policy match */}
                <div className="flex items-center justify-between rounded-lg bg-surface-0 border border-border-subtle p-3 mb-4">
                  <div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-[0.08em] mb-1">
                      Policy Matched
                    </div>
                    <div className="text-[13px] text-accent-blue font-mono">
                      email-governance v3
                    </div>
                  </div>
                  <div className="text-[11px] text-text-muted font-mono">
                    Rule 3 of 7
                  </div>
                </div>

                {/* Approve / Deny */}
                <div className="flex gap-3 mb-4">
                  <button className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent-green/10 border border-accent-green/20 py-2.5 text-[13px] font-medium text-accent-green transition-colors cursor-default">
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent-red/10 border border-accent-red/20 py-2.5 text-[13px] font-medium text-accent-red transition-colors cursor-default">
                    <span className="text-[12px]">✕</span>
                    Deny
                  </button>
                </div>

                {/* Trace footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                  <span className="text-[10px] text-text-secondary uppercase tracking-[0.08em]">
                    Trace
                  </span>
                  <code className="text-[11px] font-mono text-text-secondary">
                    tr_a1b2c3d4e5f6
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
