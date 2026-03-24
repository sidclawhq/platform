"use client";

import { ArrowRight } from "lucide-react";
import { PRIMITIVES } from "./data";

export function V2ProductModules() {
  return (
    <section className="px-6 py-16 md:py-24 bg-surface-0">
      <div className="mx-auto max-w-[1200px]">
        {/* Two-tier header */}
        <div className="text-center mb-16">
          <div className="text-[14px] font-medium text-accent-blue tracking-[-0.01em] mb-3">
            Four Primitives
          </div>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
            Everything you need to govern
            <br className="hidden sm:block" />
            AI agents in production
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-[1.6] text-text-secondary">
            Identity, Policy, Approval, Trace. Four primitives that give you complete control over what your agents can
            do.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRIMITIVES.map((p) => {
            const Icon = p.icon;
            return (
              <a
                key={p.title}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border bg-surface-1 p-6 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.06)]"
                style={{
                  borderColor: `${p.color}40`,
                }}
              >
                <Icon className="h-6 w-6 mb-4" style={{ color: p.color }} />
                <h3 className="text-[16px] font-medium text-white mb-2">{p.title}</h3>
                <p className="text-[14px] leading-[1.6] text-text-secondary">{p.description}</p>
                <div
                  className="mt-4 flex items-center gap-1 text-[13px] font-medium"
                  style={{ color: p.color }}
                >
                  Learn more <ArrowRight className="h-3 w-3" />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
