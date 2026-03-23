import { Landmark, HeartPulse, Building2, ShieldAlert, Bot } from "lucide-react";

const cases = [
  {
    icon: Landmark,
    title: "Finance",
    regulation: "FINRA 2026",
    description:
      "Pre-approval of AI use cases, human-in-the-loop for sensitive operations, complete audit trails for regulatory examination.",
  },
  {
    icon: HeartPulse,
    title: "Healthcare",
    regulation: "HIPAA",
    description:
      "Scoped agent access to PHI, minimum necessary standard enforcement, approval workflows for data access requests.",
  },
  {
    icon: Building2,
    title: "Platform Teams",
    regulation: "Scale",
    description:
      "Govern agents at scale across your organization. Centralized policy management, team-level approval routing, cross-agent audit.",
  },
  {
    icon: Bot,
    title: "Copilot Studio",
    regulation: "MCP",
    description:
      "Govern Microsoft Copilot Studio agents with SidClaw. Every tool call is evaluated against your policies before execution — via native MCP integration.",
    linkText: "Integration guide \u2192",
    linkUrl: "https://docs.sidclaw.com/docs/integrations/copilot-studio",
  },
  {
    icon: ShieldAlert,
    title: "OpenClaw Skills",
    regulation: "329K+ agents",
    description:
      "OpenClaw has 329K+ stars and 5,700+ skills — but 1,184 malicious skills were found in the ClawHavoc campaign. SidClaw adds the missing policy and approval layer to any OpenClaw skill.",
    linkText: "Learn more \u2192",
    linkUrl: "https://docs.sidclaw.com/docs/integrations/openclaw",
  },
];

export function UseCases() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Built for regulated industries
        </h2>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cases.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="rounded-lg border border-border-default bg-surface-1 p-6"
              >
                <Icon className="mb-4 h-6 w-6 text-text-muted" />
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-text-primary">
                    {c.title}
                  </h3>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-muted">
                    {c.regulation}
                  </span>
                </div>
                <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                  {c.description}
                </p>
                {"linkUrl" in c && c.linkUrl && (
                  <a
                    href={c.linkUrl}
                    className="mt-3 inline-block text-sm font-medium text-accent-blue hover:underline"
                  >
                    {("linkText" in c && c.linkText) || "Learn more"}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
