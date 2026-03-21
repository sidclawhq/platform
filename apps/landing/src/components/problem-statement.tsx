const stats = [
  {
    value: "73%",
    label: "of CISOs fear agent risks",
    detail: "Only 30% say they are ready",
  },
  {
    value: "79%",
    label: "have blind spots in agent operations",
    detail: null,
  },
  {
    value: "37%",
    label: "already had agent-caused incidents",
    detail: null,
  },
];

export function ProblemStatement() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Your agents are acting without oversight
        </h2>
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.value}
              className="rounded-lg border border-border-default bg-surface-1 p-8 text-center"
            >
              <div className="text-4xl font-bold text-text-primary">
                {stat.value}
              </div>
              <p className="mt-3 text-sm text-text-secondary">{stat.label}</p>
              {stat.detail && (
                <p className="mt-1 text-sm text-text-muted">{stat.detail}</p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-text-muted">
          <sup>1</sup> NeuralTrust State of AI Agent Security 2026
        </p>
      </div>
    </section>
  );
}
