const STANDARDS = [
  { name: 'FINRA 2026', description: 'Agent governance requirements for financial services' },
  { name: 'EU AI Act', description: 'Articles 9, 12, 13, 14 — human oversight and logging' },
  { name: 'FINMA', description: 'Swiss financial regulatory compliance for AI agents' },
  { name: 'NIST AI RMF', description: 'Risk management framework for AI systems' },
  { name: 'OWASP Agentic', description: 'Top 10 for Agentic Applications security' },
];

export function Standards() {
  return (
    <section className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-semibold text-[#E4E4E7] text-center">
          Built for compliance frameworks
        </h2>

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-5">
          {STANDARDS.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-5 text-center"
            >
              <div className="text-base font-medium text-[#E4E4E7]">{s.name}</div>
              <div className="mt-2 text-sm text-[#71717A]">{s.description}</div>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-base text-[#A1A1AA]">
          SidClaw maps to FINRA 2026, EU AI Act Articles 9/12/13/14, FINMA operational risk circulars, NIST AI RMF, and the OWASP Top 10 for Agentic Applications.
        </p>

        <div className="mt-6 text-center">
          <a
            href="https://docs.sidclaw.com/docs/compliance/finra-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-[#3B82F6] hover:underline"
          >
            View Compliance Documentation →
          </a>
        </div>
      </div>
    </section>
  );
}
