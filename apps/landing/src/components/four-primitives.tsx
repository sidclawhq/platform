import { Fingerprint, FileCheck, ShieldCheck, ScrollText } from "lucide-react";

const primitives = [
  {
    icon: Fingerprint,
    title: "Identity",
    description:
      "Every agent is governed with an owner and scoped permissions.",
    highlight: false,
  },
  {
    icon: FileCheck,
    title: "Policy",
    description: "Every action is evaluated against explicit rules.",
    highlight: false,
  },
  {
    icon: ShieldCheck,
    title: "Approval",
    description: "High-risk actions get human review with rich context.",
    highlight: true,
  },
  {
    icon: ScrollText,
    title: "Trace",
    description: "Every decision creates an auditable trace.",
    highlight: false,
  },
];

export function FourPrimitives() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          How it works
        </h2>
        <p className="mt-4 text-center font-mono text-sm text-text-muted">
          Identity &rarr; Policy &rarr; Approval &rarr; Trace
        </p>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {primitives.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className={`relative rounded-lg border bg-surface-1 p-6 ${
                  p.highlight
                    ? "border-accent-amber"
                    : "border-border-default"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-4 rounded bg-accent-amber/10 px-2 py-0.5 text-xs font-medium text-accent-amber">
                    Differentiator
                  </span>
                )}
                <Icon className="mb-4 h-6 w-6 text-text-muted" />
                <h3 className="text-base font-semibold text-text-primary">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
