"use client";

import dynamic from "next/dynamic";

const ContextDiagram = dynamic(
  () => import("@/app/architecture-preview/diagram").then((mod) => mod.ContextDiagram),
  { ssr: false, loading: () => <div style={{ height: 600 }} /> }
);

export function V2Architecture() {
  return (
    <section className="hidden lg:block px-6 py-16 md:py-24 bg-surface-0">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center mb-12">
          <div className="text-[14px] font-medium text-accent-amber tracking-[-0.01em] mb-3">
            System Architecture
          </div>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
            Where SidClaw sits in your stack
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] text-[16px] leading-[1.6] text-text-secondary">
            One SDK call from your agent code. Policy evaluation, human approval,
            and audit recording happen inside SidClaw. Reviewers get notified
            wherever they work.
          </p>
        </div>

        <div
          className="rounded-xl border border-border-muted overflow-x-auto"
          style={{
            padding: "40px 24px",
            backgroundImage:
              "radial-gradient(circle, rgba(59,130,246,0.04) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <ContextDiagram />
        </div>
      </div>
    </section>
  );
}
