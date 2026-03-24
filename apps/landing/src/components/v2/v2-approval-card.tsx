import { Check, AlertTriangle, Clock, User, FileText, Activity } from "lucide-react";
import { APPROVAL_FEATURES } from "./data";

export function V2ApprovalCard() {
  return (
    <section className="px-6 py-16 md:py-24 bg-surface-1">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-center">
          {/* Left: messaging */}
          <div>
            <div className="text-[14px] font-medium text-accent-amber tracking-[-0.01em] mb-3">
              Core Differentiator
            </div>
            <h2 className="text-[32px] sm:text-[40px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
              Context-rich approval
              <br />
              that humans can trust
            </h2>
            <p className="mt-5 max-w-[440px] text-[16px] leading-[1.6] text-text-secondary">
              When a high-risk action is flagged, reviewers see exactly what the agent wants to do, why it was flagged,
              the full context, and the policy that matched. One click to approve or deny.
            </p>
            <div className="mt-8 space-y-4">
              {APPROVAL_FEATURES.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-accent-green mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[14px] font-medium text-white">{item.label}</div>
                    <div className="text-[13px] text-text-muted">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: approval card mockup */}
          <div className="rounded-xl border border-border-muted bg-surface-1 overflow-hidden shadow-[0_0_60px_rgba(245,158,11,0.04)]">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border-muted px-5 py-3.5 bg-[#F59E0B]/5">
              <AlertTriangle className="h-4 w-4 text-accent-amber" />
              <span className="text-[13px] font-medium text-accent-amber">Approval Required</span>
              <span className="ml-auto rounded-full bg-[#EF4444]/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-red">
                HIGH RISK
              </span>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Agent & Action */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Agent</div>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-accent-blue" />
                    <span className="text-[13px] font-mono text-white">customer-support</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Action</div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-accent-amber" />
                    <span className="text-[13px] font-mono text-white">send_email</span>
                  </div>
                </div>
              </div>

              {/* Context */}
              <div className="rounded-lg border border-border-muted bg-[#0A0B0E] p-4">
                <div className="text-[11px] uppercase tracking-wider text-text-muted mb-3">Context</div>
                <div className="space-y-2 font-mono text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">recipient:</span>
                    <span className="text-text-secondary">john.doe@acme.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">contains_pii:</span>
                    <span className="text-accent-red">true</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">classification:</span>
                    <span className="text-accent-amber">CONFIDENTIAL</span>
                  </div>
                </div>
              </div>

              {/* Policy */}
              <div className="flex items-center gap-2 text-[12px]">
                <FileText className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-text-muted">Matched policy:</span>
                <span className="font-mono text-accent-blue">email-governance v3</span>
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-2 text-[12px]">
                <Clock className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-text-muted">Requested:</span>
                <span className="font-mono text-text-secondary">2026-03-24 14:32:07 UTC</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-border-muted p-5">
              <button className="flex-1 rounded-lg bg-accent-green py-2.5 text-[13px] font-medium text-white">
                Approve
              </button>
              <button className="flex-1 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/5 py-2.5 text-[13px] font-medium text-accent-red">
                Deny
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
