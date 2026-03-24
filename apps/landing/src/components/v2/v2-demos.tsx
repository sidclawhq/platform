import { Check, ExternalLink } from "lucide-react";
import { DEMOS } from "./data";

export function V2Demos() {
  return (
    <section id="demos" className="px-6 py-16 md:py-24 bg-surface-0">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center mb-14">
          <div className="text-[14px] font-medium text-accent-blue tracking-[-0.01em] mb-3">Industry Solutions</div>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
            See it in action
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-[1.6] text-text-secondary">
            Three interactive demos using real SidClaw governance. Pick your industry.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {DEMOS.map((demo) => {
            const Icon = demo.icon;
            return (
              <div
                key={demo.title}
                className="group rounded-xl border border-border-muted bg-surface-1 p-6 transition-all hover:border-border-muted hover:shadow-[0_0_40px_rgba(59,130,246,0.04)]"
                style={{
                  ["--demo-accent" as string]: demo.accentColor,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${demo.accentColor}10` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: demo.accentColor }} />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: demo.accentColor }}>
                      {demo.industry}
                    </div>
                    <div className="text-[15px] font-medium text-white">{demo.title}</div>
                  </div>
                </div>

                <p className="text-[13px] leading-[1.6] text-text-secondary mb-5">{demo.description}</p>

                <div className="space-y-2 mb-6">
                  {demo.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-[12px] text-text-muted">
                      <Check className="h-3 w-3 text-accent-green shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <a
                    href={demo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-border-muted px-5 py-2 text-[13px] font-medium text-white hover:border-[#3B82F6]/40 transition-colors"
                  >
                    Try Demo
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: `${demo.accentColor}10`,
                      color: demo.accentColor,
                    }}
                  >
                    {demo.badge}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[13px] text-text-muted">
          2 minutes &middot; No signup required &middot; Real governance
        </p>
      </div>
    </section>
  );
}
