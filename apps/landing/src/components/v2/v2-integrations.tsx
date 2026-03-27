import { ArrowRight } from "lucide-react";

const INTEGRATIONS = [
  { name: "LangChain", icon: "/logos/langchain-icon.png" },
  { name: "OpenAI", icon: "/logos/openai-icon.png" },
  { name: "Vercel AI", icon: "/logos/vercel-icon.png" },
  { name: "CrewAI", icon: "/logos/crewai.webp" },
  { name: "Pydantic AI", icon: "/logos/pydantic-ai-icon.ico" },
  { name: "MCP", icon: "/logos/mcp-icon.png" },
  { name: "Slack", icon: "/logos/slack-icon.png" },
  { name: "Telegram", icon: "/logos/telegram-icon.png" },
  { name: "Teams", icon: "/logos/teams-icon.svg" },
  { name: "GitHub", icon: "/logos/github-icon.webp" },
  { name: "Composio", icon: "/logos/composio-icon.png" },
  { name: "Claude", icon: "/logos/claude-icon.png" },
  { name: "Google ADK", icon: "/logos/google-icon.png" },
  { name: "LlamaIndex", icon: "/logos/llamaindex-icon.png" },
  { name: "Resend", icon: "/logos/resend-icon.png" },
];

export function V2Integrations() {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center mb-10">
          <div className="text-[14px] font-medium text-accent-blue tracking-[-0.01em] mb-3">
            Integrations
          </div>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
            Works with your stack
          </h2>
        </div>

        {/* OpenClaw featured card */}
        <div className="max-w-[700px] mx-auto mb-8">
          <a
            href="https://docs.sidclaw.com/docs/integrations/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-6 rounded-xl border border-accent-amber/30 bg-surface-1 px-8 py-6 hover:border-accent-amber/50 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/openclaw.png"
              alt="OpenClaw"
              className="h-16 w-16 object-contain shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-[18px] font-semibold text-white">OpenClaw Ready</span>
                <span className="rounded-full bg-accent-amber/10 border border-accent-amber/20 px-2.5 py-0.5 text-[11px] font-medium text-accent-amber">
                  329K+ users
                </span>
              </div>
              <p className="text-[14px] leading-[1.5] text-text-secondary">
                The governance layer OpenClaw is missing. Govern any skill with policy enforcement,
                human approval, and tamper-evident audit trails.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-text-muted group-hover:text-accent-amber transition-colors shrink-0" />
          </a>
        </div>

        {/* Integration grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-[900px] mx-auto">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center justify-center gap-3 rounded-xl border border-border-muted bg-surface-1 px-4 py-5 h-[80px] hover:border-accent-blue/30 transition-colors"
            >
                <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={integration.icon}
                  alt={integration.name}
                  className="h-9 w-9 object-contain shrink-0"
                />
                <span className="text-[15px] font-medium text-white whitespace-nowrap">
                  {integration.name}
                </span>
              </>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a
            href="https://docs.sidclaw.com/docs/integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-blue hover:text-[#60A5FA] transition-colors"
          >
            View all integrations
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
