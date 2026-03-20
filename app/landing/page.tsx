"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, Shield } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════════════════════ */

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-[850ms] ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Triggers a callback when the element enters the viewport. */
function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}

function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("px-6 py-28", className)}>
      <div className="mx-auto max-w-[1100px]">{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-body mb-4 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </div>
  );
}

function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-display text-[36px] leading-[1.15] tracking-tight text-foreground",
        className
      )}
    >
      {children}
    </h2>
  );
}

function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: "green" | "amber" | "red" | "neutral";
}) {
  const styles = {
    green: "bg-status-allowed/10 text-status-allowed",
    amber: "bg-status-approval/10 text-status-approval",
    red: "bg-status-denied/10 text-status-denied",
    neutral: "bg-surface-3 text-secondary-foreground",
  };
  return (
    <span
      className={cn(
        "font-body inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        styles[variant]
      )}
    >
      {children}
    </span>
  );
}

function WindowChrome() {
  return (
    <div className="window-dots mb-3 flex items-center gap-1.5 border-b border-border pb-3">
      <span />
      <span />
      <span />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Navigation
   ═══════════════════════════════════════════════════════════════════════ */

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <nav
        className={cn(
          "transition-all duration-500",
          scrolled
            ? "bg-surface-0/85 backdrop-blur-lg"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Shield className="h-[14px] w-[14px] text-muted-foreground/70" />
            <span className="font-body text-[13px] font-semibold tracking-tight text-foreground">
              Agent Identity &amp; Approval Layer
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/agents"
              className="font-body text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Prototype
            </Link>
            <a
              href="#contact"
              className="cta-glow font-body rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-primary-foreground"
            >
              Request a walkthrough
            </a>
          </div>
        </div>
      </nav>
      <div className="nav-line" />
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Hero
   ═══════════════════════════════════════════════════════════════════════ */

function HeroSection() {
  return (
    <Section className="relative overflow-hidden pb-28 pt-32">
      {/* Atmospheric layers */}
      <div className="hero-ambient" />
      <div className="hero-grid" />

      <div className="relative">
        <FadeIn>
          <div className="badge-shimmer mb-8 inline-block">
            <div className="rounded-full bg-surface-0 px-4 py-1.5">
              <span className="font-body text-[12px] font-medium tracking-wide text-muted-foreground">
                Identity and access management for AI agents
              </span>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="font-display max-w-[820px] text-[60px] leading-[1.06] tracking-tight text-foreground">
            The missing control layer
            <br />
            for enterprise AI agents
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="font-body mt-7 max-w-[540px] text-[16px] leading-[1.7] text-muted-foreground">
            Agents are enterprise actors. They need identity, scoped authority,
            policy-governed access, approval workflows, and auditable traces —
            the same governance primitives you require for every other principal
            in your systems.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#contact"
              className="cta-glow font-body rounded-md bg-foreground px-5 py-2.5 text-[14px] font-medium text-primary-foreground"
            >
              Request a walkthrough
            </a>
            <Link
              href="/agents"
              className="font-body flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-surface-1"
            >
              Explore the prototype
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Problem
   ═══════════════════════════════════════════════════════════════════════ */

const PROBLEMS = [
  {
    n: "01",
    title: "No identity model",
    body: 'AI agents operate as ambient services — no principal identity, no authority scoping, no credential binding. The most basic question in enterprise security — "who is this actor?" — has no answer.',
  },
  {
    n: "02",
    title: "No policy layer",
    body: "There is no systematic way to define what an agent can do, under what authority, or what requires human oversight. Permission decisions are hardcoded or absent entirely.",
  },
  {
    n: "03",
    title: "No audit chain",
    body: "Agent operations produce isolated logs, not correlated governance traces. When something goes wrong — and it will — there is no causal chain linking identity, policy, approval, and execution.",
  },
];

function ProblemSection() {
  return (
    <>
      <div className="section-line" />
      <Section>
        <FadeIn>
          <SectionLabel>The problem</SectionLabel>
          <SectionHeading className="max-w-[620px]">
            AI agents are shipping to production.{" "}
            <span className="italic text-muted-foreground">
              Governance is not.
            </span>
          </SectionHeading>
        </FadeIn>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <FadeIn key={p.title} delay={i * 120}>
              <div className="lp-card h-full rounded-lg border border-border bg-surface-1 p-6">
                <span className="font-body mb-4 block text-[11px] font-medium tracking-widest text-status-denied/60">
                  {p.n}
                </span>
                <h3 className="font-display mb-2.5 text-[18px] text-foreground">
                  {p.title}
                </h3>
                <p className="font-body text-[13px] leading-[1.7] text-muted-foreground">
                  {p.body}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   How it works — governance flow
   ═══════════════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    n: 1,
    label: "Identity",
    accent: "text-status-allowed",
    ring: "border-status-allowed/25",
    bg: "bg-status-allowed/8",
    topBorder: "border-t-status-allowed/40",
    body: "Register agents with identity, authority model, delegation context, and lifecycle state. Like any enterprise actor.",
  },
  {
    n: 2,
    label: "Policy",
    accent: "text-foreground",
    ring: "border-border",
    bg: "bg-surface-2",
    topBorder: "border-t-muted-foreground/30",
    body: "Evaluate every operation against per-agent policy rules. Effects are allow, approval_required, or deny.",
  },
  {
    n: 3,
    label: "Approval",
    accent: "text-status-approval",
    ring: "border-status-approval/25",
    bg: "bg-status-approval/8",
    topBorder: "border-t-status-approval/40",
    body: "When policy requires human review, operations are held with full context — authority, classification, rationale — for informed decisions.",
  },
  {
    n: 4,
    label: "Trace",
    accent: "text-status-allowed",
    ring: "border-status-allowed/25",
    bg: "bg-status-allowed/8",
    topBorder: "border-t-status-allowed/40",
    body: "Every operation produces a correlated trace: identity resolution, policy evaluation, approval decisions, and execution outcome.",
  },
];

function FlowSection() {
  const connectorRef = useRef<HTMLDivElement>(null);
  const inView = useInView(connectorRef);

  return (
    <>
      <div className="section-line" />
      <Section>
        <FadeIn>
          <SectionLabel>How it works</SectionLabel>
          <SectionHeading>
            Four governance primitives.{" "}
            <span className="italic text-muted-foreground">
              One control plane.
            </span>
          </SectionHeading>
        </FadeIn>

        {/* Horizontal flow — desktop */}
        <FadeIn delay={120}>
          <div
            ref={connectorRef}
            className="relative mb-14 mt-20 hidden items-center justify-between md:flex"
          >
            {/* Connecting line — animated */}
            <div className="absolute left-[12.5%] right-[12.5%] top-[23px]">
              <div
                className={cn(
                  "flow-connector h-px bg-border",
                  inView && "drawn"
                )}
              />
            </div>

            {STEPS.map((s) => (
              <div
                key={s.n}
                className="relative z-10 flex w-1/4 flex-col items-center"
              >
                <div
                  className={cn(
                    "step-ring relative flex h-12 w-12 items-center justify-center rounded-full border",
                    s.ring,
                    s.bg,
                    s.accent
                  )}
                >
                  <span className={cn("text-[14px] font-semibold", s.accent)}>
                    {s.n}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-body mt-3 text-[11px] font-semibold uppercase tracking-[0.12em]",
                    s.accent
                  )}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Step detail cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <FadeIn key={s.n} delay={200 + i * 80}>
              <div
                className={cn(
                  "lp-card h-full rounded-lg border border-border border-t-2 bg-surface-1 p-5",
                  s.topBorder
                )}
              >
                {/* Mobile step indicator */}
                <div
                  className={cn(
                    "mb-3 flex h-7 w-7 items-center justify-center rounded text-[12px] font-semibold md:hidden",
                    s.bg,
                    s.accent
                  )}
                >
                  {s.n}
                </div>
                <h3 className="font-display mb-2 text-[15px] text-foreground md:hidden">
                  {s.label}
                </h3>
                <p className="font-body text-[13px] leading-[1.7] text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Product — capabilities with UI vignettes
   ═══════════════════════════════════════════════════════════════════════ */

function AgentRegistryVignette() {
  return (
    <div className="rounded border border-border bg-surface-0 p-4">
      <WindowChrome />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-body text-[13px] font-medium text-foreground">
          Customer Communications Agent
        </span>
        <Badge variant="green">Active</Badge>
        <Badge variant="amber">Medium</Badge>
        <Badge variant="neutral">Hybrid</Badge>
      </div>
      <p className="font-body mt-1.5 text-[12px] text-muted-foreground">
        Drafts and routes outbound customer communications under delegated
        authority
      </p>
      <div className="font-body mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
        <span>
          <span className="text-muted-foreground">Owner: </span>
          <span className="font-medium text-foreground">Sarah Chen</span>
        </span>
        <span>
          <span className="text-muted-foreground">Team: </span>
          <span className="font-medium text-foreground">
            Customer Operations
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">Environment: </span>
          <span className="font-medium text-foreground">Production</span>
        </span>
      </div>
    </div>
  );
}

function PolicyEngineVignette() {
  const rules = [
    {
      name: "Render email content from templates",
      effect: "Allowed",
      variant: "green" as const,
      scope: "Communications Service",
      cls: "Internal",
      border: "",
    },
    {
      name: "Send outbound communication",
      effect: "Approval Required",
      variant: "amber" as const,
      scope: "Communications Service",
      cls: "Confidential",
      border: "border-status-approval/20",
    },
    {
      name: "Export customer PII records",
      effect: "Denied",
      variant: "red" as const,
      scope: "CRM Platform",
      cls: "Restricted",
      border: "border-status-denied/20",
    },
  ];
  return (
    <div className="space-y-2">
      <WindowChrome />
      {rules.map((r) => (
        <div
          key={r.name}
          className={cn(
            "rounded border bg-surface-0 p-3",
            r.border || "border-border"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-body text-[12px] font-medium text-foreground">
              {r.name}
            </span>
            <Badge variant={r.variant}>{r.effect}</Badge>
          </div>
          <span className="font-body text-[11px] text-muted-foreground">
            {r.scope} &middot; {r.cls}
          </span>
        </div>
      ))}
    </div>
  );
}

function ApprovalVignette() {
  return (
    <div className="rounded border border-status-approval/20 bg-surface-0 p-4">
      <WindowChrome />
      <div className="font-body mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Why this was flagged
      </div>
      <div className="font-body space-y-2 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Policy effect</span>
          <Badge variant="amber">Approval Required</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Classification</span>
          <Badge variant="amber">Confidential</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Authority</span>
          <span className="text-foreground">Hybrid</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Scope</span>
          <span className="text-foreground">Outbound customer-facing</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="font-body flex-1 rounded border border-status-allowed/20 bg-status-allowed/10 py-1.5 text-center text-[12px] font-medium text-status-allowed">
          Approve
        </div>
        <div className="font-body flex-1 rounded border border-status-denied/20 bg-status-denied/10 py-1.5 text-center text-[12px] font-medium text-status-denied">
          Deny
        </div>
      </div>
    </div>
  );
}

function TraceVignette() {
  const events = [
    { event: "Identity Resolved", time: "14:23:01", color: "bg-muted-foreground" },
    { event: "Policy Evaluated", time: "14:23:01", color: "bg-muted-foreground" },
    { event: "Approval Required", time: "14:23:02", color: "bg-status-approval" },
    { event: "Approval Granted", time: "14:25:44", color: "bg-status-allowed" },
    { event: "Operation Executed", time: "14:25:45", color: "bg-status-allowed" },
  ];
  return (
    <div className="rounded border border-border bg-surface-0 p-4">
      <WindowChrome />
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono-trace text-[11px] text-muted-foreground">
          TR-2048
        </span>
        <Badge variant="green">Completed</Badge>
      </div>
      <div className="relative ml-1">
        {events.map((e, i) => (
          <div
            key={e.event}
            className="relative flex items-center gap-3 py-[6px]"
          >
            {i < events.length - 1 && (
              <div className="absolute left-[4px] top-[18px] h-full w-px bg-border" />
            )}
            <div
              className={cn(
                "relative z-10 h-[9px] w-[9px] shrink-0 rounded-full",
                e.color
              )}
            />
            <span className="font-body flex-1 text-[12px] text-foreground">
              {e.event}
            </span>
            <span className="font-mono-trace text-[11px] text-muted-foreground">
              {e.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductSection() {
  return (
    <>
      <div className="section-line" />
      <Section>
        <FadeIn>
          <SectionLabel>Product</SectionLabel>
          <SectionHeading className="max-w-[620px]">
            Governance infrastructure,{" "}
            <span className="italic text-muted-foreground">
              not another dashboard.
            </span>
          </SectionHeading>
          <p className="font-body mt-4 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            Purpose-built primitives for governing AI agents in enterprise
            environments.
          </p>
        </FadeIn>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <FadeIn delay={80}>
            <div className="lp-card h-full rounded-lg border border-border bg-surface-1 p-6">
              <h3 className="font-display mb-1 text-[17px] text-foreground">
                Agent Registry
              </h3>
              <p className="font-body mb-5 text-[13px] text-muted-foreground">
                Every agent is a known entity with defined ownership, authority
                model, and integration scope.
              </p>
              <AgentRegistryVignette />
            </div>
          </FadeIn>

          <FadeIn delay={180}>
            <div className="lp-card h-full rounded-lg border border-border bg-surface-1 p-6">
              <h3 className="font-display mb-1 text-[17px] text-foreground">
                Policy Engine
              </h3>
              <p className="font-body mb-5 text-[13px] text-muted-foreground">
                Per-agent rules with allow, approval_required, or deny effects
                evaluated on every operation.
              </p>
              <PolicyEngineVignette />
            </div>
          </FadeIn>

          <FadeIn delay={280}>
            <div className="lp-card h-full rounded-lg border border-border bg-surface-1 p-6">
              <h3 className="font-display mb-1 text-[17px] text-foreground">
                Approval Workflow
              </h3>
              <p className="font-body mb-5 text-[13px] text-muted-foreground">
                Sensitive operations held for human review with full governance
                context for informed decisions.
              </p>
              <ApprovalVignette />
            </div>
          </FadeIn>

          <FadeIn delay={380}>
            <div className="lp-card h-full rounded-lg border border-border bg-surface-1 p-6">
              <h3 className="font-display mb-1 text-[17px] text-foreground">
                Audit Traces
              </h3>
              <p className="font-body mb-5 text-[13px] text-muted-foreground">
                Correlated event sequences linking every step of an agent
                operation into a single governance record.
              </p>
              <TraceVignette />
            </div>
          </FadeIn>
        </div>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Architecture
   ═══════════════════════════════════════════════════════════════════════ */

function ArchitectureSection() {
  const nodes = [
    { id: "user", label: "Human User / Owner", x: 80, y: 60, w: 170, h: 44 },
    { id: "idp", label: "Enterprise IdP", x: 320, y: 60, w: 140, h: 44 },
    { id: "agent", label: "Agent", x: 80, y: 160, w: 170, h: 44 },
    { id: "cred", label: "Credential Binding Boundary", x: 320, y: 160, w: 200, h: 44 },
    { id: "pep", label: "Policy Enforcement Point", x: 80, y: 270, w: 200, h: 44 },
    { id: "pdp", label: "Policy Decision Point", x: 340, y: 270, w: 190, h: 44 },
    { id: "approval", label: "Approval Service", x: 580, y: 270, w: 160, h: 44 },
    { id: "integ", label: "Authorized Integrations", x: 80, y: 380, w: 200, h: 44 },
    { id: "trace", label: "Trace / Audit Store", x: 580, y: 380, w: 160, h: 44 },
  ];

  const flows: { from: string; to: string; label: string; dashed?: boolean }[] =
    [
      { from: "user", to: "agent", label: "1" },
      { from: "user", to: "idp", label: "" },
      { from: "agent", to: "cred", label: "2" },
      { from: "agent", to: "pep", label: "3" },
      { from: "pep", to: "pdp", label: "4" },
      { from: "pdp", to: "approval", label: "5" },
      { from: "approval", to: "integ", label: "6" },
      { from: "pep", to: "integ", label: "7" },
      { from: "agent", to: "trace", label: "8", dashed: true },
      { from: "pep", to: "trace", label: "", dashed: true },
      { from: "approval", to: "trace", label: "", dashed: true },
    ];

  return (
    <>
      <div className="section-line" />
      <Section>
        <FadeIn>
          <SectionLabel>Architecture</SectionLabel>
          <SectionHeading className="max-w-[700px]">
            Enterprise control architecture{" "}
            <span className="italic text-muted-foreground">
              for governed agent operations.
            </span>
          </SectionHeading>
        </FadeIn>

        <FadeIn delay={150}>
          <div className="mt-14 overflow-x-auto rounded-lg border border-border bg-surface-1 p-8">
            <svg
              viewBox="0 0 800 460"
              className="mx-auto w-full max-w-[800px]"
              style={{ minWidth: 560 }}
            >
              {flows.map((flow, index) => {
                const from = nodes.find((n) => n.id === flow.from)!;
                const to = nodes.find((n) => n.id === flow.to)!;
                const fromX = from.x + from.w / 2;
                const fromY = from.y + from.h / 2;
                const toX = to.x + to.w / 2;
                const toY = to.y + to.h / 2;
                const angle = Math.atan2(toY - fromY, toX - fromX);
                const startX = fromX + Math.cos(angle) * (from.w / 2.2);
                const startY = fromY + Math.sin(angle) * (from.h / 1.5);
                const endX = toX - Math.cos(angle) * (to.w / 2.2);
                const endY = toY - Math.sin(angle) * (to.h / 1.5);

                return (
                  <g key={index}>
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="#364152"
                      strokeWidth="1"
                      strokeDasharray={flow.dashed ? "4 3" : undefined}
                      markerEnd="url(#lp-arrow)"
                    />
                    {flow.label && (
                      <text
                        x={(startX + endX) / 2 + 6}
                        y={(startY + endY) / 2 - 4}
                        className="fill-secondary-foreground text-[11px]"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                        }}
                      >
                        {flow.label}
                      </text>
                    )}
                  </g>
                );
              })}

              <defs>
                <marker
                  id="lp-arrow"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#364152" />
                </marker>
              </defs>

              {nodes.map((node) => (
                <g key={node.id}>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.w}
                    height={node.h}
                    rx="4"
                    fill="#141821"
                    stroke="#232a38"
                    strokeWidth="1"
                  />
                  <text
                    x={node.x + node.w / 2}
                    y={node.y + node.h / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-[11px]"
                    style={{
                      fontFamily: "var(--font-body, var(--font-inter))",
                      fontWeight: 500,
                    }}
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </FadeIn>

        <FadeIn delay={250}>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Identity & delegation",
                body: "Agent identities map to service principals. Human approvers authenticate through the enterprise identity provider.",
              },
              {
                title: "Policy evaluation",
                body: "A dedicated policy decision point evaluates per-agent rules with versioned policy definitions and auditable outcomes.",
              },
              {
                title: "Approval control",
                body: "Approval is distinct from policy. Policy may require human review before an operation proceeds — with full authority context.",
              },
              {
                title: "Auditability",
                body: "Operations are represented as correlated traces — not isolated log lines — linking identity, policy, approval, and execution.",
              },
            ].map((note) => (
              <div
                key={note.title}
                className="lp-card rounded-lg border border-border bg-surface-1 p-4"
              >
                <h3 className="font-display mb-1 text-[14px] text-foreground">
                  {note.title}
                </h3>
                <p className="font-body text-[12px] leading-[1.65] text-muted-foreground">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Enterprise
   ═══════════════════════════════════════════════════════════════════════ */

const AUDIENCES = [
  {
    title: "Security & IAM",
    body: "Extend your identity and access model to cover AI agents as first-class principals with scoped authority and credential binding.",
  },
  {
    title: "AI Platform & Infrastructure",
    body: "Give your agent platform the governance layer it needs — policy evaluation, approval routing, and operational traceability.",
  },
  {
    title: "Compliance & Governance",
    body: "Demonstrate control over AI agent operations with policy-versioned audit trails, separation of duties checks, and human-in-the-loop approval workflows.",
  },
];

function EnterpriseSection() {
  return (
    <>
      <div className="section-line" />
      <Section>
        <FadeIn>
          <SectionLabel>Built for enterprise</SectionLabel>
          <SectionHeading className="max-w-[640px]">
            Designed for environments where{" "}
            <span className="italic text-muted-foreground">
              governance is not optional.
            </span>
          </SectionHeading>
        </FadeIn>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <FadeIn key={a.title} delay={i * 120}>
              <div className="lp-card h-full rounded-lg border border-border bg-surface-1 p-6">
                <h3 className="font-display mb-2.5 text-[17px] text-foreground">
                  {a.title}
                </h3>
                <p className="font-body text-[13px] leading-[1.7] text-muted-foreground">
                  {a.body}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CTA
   ═══════════════════════════════════════════════════════════════════════ */

function CTASection() {
  return (
    <>
      <div className="section-line" />
      <Section id="contact" className="pb-36">
        <FadeIn>
          <div className="text-center">
            <SectionHeading className="mx-auto max-w-[500px]">
              See the prototype.{" "}
              <span className="italic text-muted-foreground">
                Start the conversation.
              </span>
            </SectionHeading>
            <p className="font-body mx-auto mt-5 max-w-[440px] text-[15px] leading-[1.7] text-muted-foreground">
              The Agent Identity &amp; Approval Layer is a working concept for
              governing enterprise AI agents. We&rsquo;d like to show you how.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <a
                href="mailto:agent-governance@agentmail.to?subject=Agent%20Identity%20%26%20Approval%20Layer%20—%20Walkthrough%20Request"
                className="cta-glow font-body rounded-md bg-foreground px-6 py-2.5 text-[14px] font-medium text-primary-foreground"
              >
                Request a walkthrough
              </a>
              <Link
                href="/agents"
                className="font-body flex items-center gap-2 rounded-md border border-border px-6 py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-surface-1"
              >
                Explore the prototype
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════════════════════════════════ */

function LandingFooter() {
  return (
    <>
      <div className="section-line" />
      <footer className="px-6 py-8">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-body text-[12px] text-muted-foreground/70">
              Agent Identity &amp; Approval Layer
            </span>
          </div>
          <span className="font-body text-[12px] text-muted-foreground/50">
            Concept prototype
          </span>
        </div>
      </footer>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return (
    <div className="landing-noise min-h-screen bg-background font-body text-foreground">
      <LandingNav />
      <HeroSection />
      <ProblemSection />
      <FlowSection />
      <ProductSection />
      <ArchitectureSection />
      <EnterpriseSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
