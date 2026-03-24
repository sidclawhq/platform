import { COMPLIANCE_BADGES } from "./data";

export function V2TrustBar() {
  return (
    <section className="border-y border-border-muted bg-surface-0 px-6 py-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted mb-5">
          Built for compliance frameworks
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {COMPLIANCE_BADGES.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-border-muted bg-surface-1 px-4 py-1.5 text-[12px] font-medium text-text-secondary"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
