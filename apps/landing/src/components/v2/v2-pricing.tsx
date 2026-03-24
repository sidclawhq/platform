import { Check } from "lucide-react";
import { PLANS } from "./data";

export function V2Pricing() {
  return (
    <section id="pricing" className="px-6 py-16 md:py-24 bg-surface-1">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center mb-14">
          <div className="text-[14px] font-medium text-accent-blue tracking-[-0.01em] mb-3">Pricing</div>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
            Transparent pricing
          </h2>
          <p className="mx-auto mt-5 max-w-[480px] text-[16px] leading-[1.6] text-text-secondary">
            Start free. Scale as your agent fleet grows. Enterprise self-hosting available.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-xl border p-6 ${
                plan.highlight
                  ? "border-[#3B82F6]/40 bg-surface-1 shadow-[0_0_30px_rgba(59,130,246,0.06)]"
                  : "border-border-muted bg-surface-1"
              }`}
            >
              {"badge" in plan && plan.badge && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-accent-blue px-3 py-0.5 text-[11px] font-medium text-white">
                  {plan.badge}
                </span>
              )}
              <div className="mb-4">
                <h3 className="text-[15px] font-medium text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[28px] font-medium tracking-tight text-white">{plan.price}</span>
                  <span className="text-[14px] text-text-muted">{plan.period}</span>
                </div>
                <p className="mt-1 text-[13px] text-text-muted">{plan.description}</p>
              </div>

              <ul className="flex-1 space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <Check className="h-3.5 w-3.5 text-accent-green mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                <a
                  href={plan.ctaHref}
                  className={`block rounded-full py-2.5 text-center text-[13px] font-medium transition-colors ${
                    plan.highlight
                      ? "bg-accent-blue text-white hover:bg-[#2563EB]"
                      : "border border-border-muted text-text-secondary hover:text-white hover:border-[#3B82F6]/40"
                  }`}
                >
                  {plan.cta}
                </a>
                {plan.ctaNote && <p className="mt-2 text-center text-[11px] text-text-muted">{plan.ctaNote}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
