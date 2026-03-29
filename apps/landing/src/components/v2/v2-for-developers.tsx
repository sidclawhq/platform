"use client";

import { useState } from "react";
import { Check, Copy, ArrowRight } from "lucide-react";
import { TS_CODE, PY_CODE, DEVELOPER_FEATURES } from "./data";

export function V2ForDevelopers() {
  const [activeTab, setActiveTab] = useState<"typescript" | "python">("typescript");
  const [copied, setCopied] = useState(false);

  const code = activeTab === "typescript" ? TS_CODE : PY_CODE;
  const rawText = code.map((t) => t.text).join("");

  function copyCode() {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section
      className="px-6 py-16 md:py-24"
      style={{
        background: "linear-gradient(180deg, #060610 0%, #080A14 50%, #060610 100%)",
      }}
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-center">
          {/* Left: messaging */}
          <div>
            <div className="text-[14px] font-medium text-accent-blue tracking-[-0.01em] mb-3">For Developers</div>
            <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
              Add governance in
              <br />
              minutes, not months
            </h2>
            <p className="mt-5 max-w-[440px] text-[16px] leading-[1.6] text-text-secondary">
              A single SDK call evaluates every agent action against your policies. Works with LangChain, Vercel AI,
              OpenAI Agents, CrewAI, MCP, and more.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {DEVELOPER_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-[13px] text-text-secondary">
                  <Check className="h-3.5 w-3.5 text-accent-green shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4">
              <a
                href="https://docs.sidclaw.com/docs/quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-6 py-2.5 text-[14px] font-medium text-white hover:bg-[#2563EB] transition-colors"
              >
                Quick Start Guide
              </a>
              <a
                href="https://github.com/sidclawhq/platform"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[14px] font-medium text-text-secondary hover:text-white transition-colors group"
              >
                View on GitHub
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          {/* Right: code */}
          <div className="rounded-xl border border-border-muted bg-[#0A0B14] shadow-[0_0_60px_rgba(59,130,246,0.05)] overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b border-border-muted px-4 py-2">
              <div className="flex gap-1">
                {(["typescript", "python"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      activeTab === tab ? "bg-surface-2 text-white" : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {tab === "typescript" ? "TypeScript" : "Python"}
                  </button>
                ))}
              </div>
              <button
                onClick={copyCode}
                className="text-text-muted hover:text-white transition-colors"
                aria-label="Copy code"
              >
                {copied ? <Check className="h-4 w-4 text-accent-green" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {/* Code */}
            <div className="p-5 overflow-x-auto">
              <pre className="font-mono text-[13px] leading-[1.7]">
                <code>
                  {code.map((token, i) => (
                    <span key={i} style={{ color: token.color || undefined }}>
                      {token.text}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
            {/* Response preview */}
            <div className="border-t border-border-muted px-5 py-3 bg-[#080910]">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-[10px] font-mono font-medium text-accent-green">
                  200 OK
                </span>
                <span className="text-[11px] text-text-muted">Response</span>
              </div>
              <pre className="font-mono text-[12px] leading-[1.6] text-text-muted">
                {`{ "decision": "approval_required",\n  "trace_id": "tr_a1b2c3d4",\n  "approval_request_id": "apr_x7k9m2",\n  "reason": "Policy: email-governance v3" }`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
