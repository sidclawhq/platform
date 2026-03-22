const DEMOS = [
  {
    icon: '\u{1F4AC}',
    industry: 'Financial Services',
    title: 'Atlas Financial',
    description: 'AI customer support agent sends emails, looks up accounts, and handles sensitive data. See FINRA-compliant approval workflows in action.',
    highlight: 'FINRA 2026 compliant',
    features: ['Chat with AI agent', 'Email approval flow', 'PII export blocked'],
    url: 'https://demo.sidclaw.com',
    color: 'amber',
  },
  {
    icon: '\u{1F4CA}',
    industry: 'DevOps & Platform',
    title: 'Nexus Labs',
    description: 'AI ops agent monitors infrastructure, scales services, and deploys to production. See how governance prevents destructive actions.',
    highlight: 'Deploy safety controls',
    features: ['Live service monitoring', 'Production deploy approval', 'Namespace deletion blocked'],
    url: 'https://demo-devops.sidclaw.com',
    color: 'blue',
  },
  {
    icon: '\u{1F3E5}',
    industry: 'Healthcare',
    title: 'MedAssist Health',
    description: 'AI clinical assistant reviews patient charts and recommends treatments. See HIPAA-compliant controls that keep physicians in the loop.',
    highlight: 'HIPAA compliant',
    features: ['Patient chart review', 'Lab order approval', 'Prescriptions blocked for AI'],
    url: 'https://demo-health.sidclaw.com',
    color: 'green',
  },
];

const COLOR_MAP: Record<string, { accent: string; bg: string; hover: string }> = {
  amber: { accent: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', hover: 'hover:border-[#F59E0B]/50' },
  blue: { accent: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', hover: 'hover:border-[#3B82F6]/50' },
  green: { accent: 'text-[#22C55E]', bg: 'bg-[#22C55E]/10', hover: 'hover:border-[#22C55E]/50' },
};

export function DemoGallery() {
  return (
    <section id="demos" className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-semibold text-[#E4E4E7] text-center">
          See it in action
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-[#A1A1AA] text-center">
          Pick a scenario. Each demo uses real SidClaw governance — only the business data is simulated.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {DEMOS.map((demo) => {
            const colors = COLOR_MAP[demo.color]!;
            return (
              <div
                key={demo.title}
                className={`rounded-lg border border-[#2A2A2E] bg-[#111113] p-6 transition-colors ${colors.hover}`}
              >
                <div className="text-3xl text-center">{demo.icon}</div>
                <div className={`mt-4 text-xs font-medium uppercase tracking-wider text-center ${colors.accent}`}>
                  {demo.industry}
                </div>
                <h3 className="mt-2 text-base font-medium text-[#E4E4E7] text-center">
                  {demo.title}
                </h3>
                <p className="mt-2 text-sm text-[#A1A1AA]">
                  {demo.description}
                </p>

                <div className="mt-4 space-y-1.5">
                  {demo.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-xs text-[#71717A]">
                      <span className="text-[#22C55E]">{'\u2713'}</span>
                      {feature}
                    </div>
                  ))}
                </div>

                <a
                  href={demo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-4 block w-full rounded-lg border border-[#2A2A2E] bg-[#1A1A1D] py-2.5 text-center text-sm font-medium text-[#E4E4E7] transition-colors ${colors.hover}`}
                >
                  Try Demo {'\u2192'}
                </a>

                <div className="mt-3 text-center">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs ${colors.bg} ${colors.accent}`}>
                    {demo.highlight}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-[#71717A]">
          2 minutes {'\u00B7'} No signup required {'\u00B7'} Real governance
        </p>
      </div>
    </section>
  );
}
