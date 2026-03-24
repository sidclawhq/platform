import { ArrowRight, Check } from "lucide-react";

const FRAMEWORKS = ["FINRA 2026", "EU AI Act", "FINMA", "NIST AI RMF"];

const CAPABILITIES = [
  { capability: "Agent Registration", sidclaw: "Agent Registry", covered: [true, true, true, true] },
  { capability: "Policy Enforcement", sidclaw: "Policy Engine", covered: [true, true, true, true] },
  { capability: "Human Oversight", sidclaw: "Approval Workflow", covered: [true, true, true, true] },
  { capability: "Audit Trail", sidclaw: "Hash-Chain Traces", covered: [true, true, true, true] },
  { capability: "Risk Classification", sidclaw: "Risk Engine", covered: [true, true, false, true] },
];

export function V2ForCompliance() {
  return (
    <section className="px-6 py-16 md:py-24 bg-surface-0">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center mb-14">
          <div className="text-[14px] font-medium text-accent-amber tracking-[-0.01em] mb-3">For Compliance Teams</div>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-medium tracking-[-0.035em] leading-[1.1] text-white">
            Maps directly to your
            <br className="hidden sm:block" />
            regulatory frameworks
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] text-[16px] leading-[1.6] text-text-secondary">
            SidClaw was designed for regulated industries. Every capability maps to requirements in FINRA, EU AI
            Act, FINMA, and NIST.
          </p>
        </div>

        {/* Compliance table */}
        <div className="overflow-x-auto rounded-xl border border-border-muted">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-muted bg-surface-1">
                <th className="px-5 py-3.5 text-left font-medium text-text-muted uppercase tracking-wider text-[11px]">
                  Capability
                </th>
                <th className="px-5 py-3.5 text-left font-medium text-text-muted uppercase tracking-wider text-[11px]">
                  SidClaw Feature
                </th>
                {FRAMEWORKS.map((fw) => (
                  <th key={fw} className="px-5 py-3.5 text-center font-medium text-text-muted uppercase tracking-wider text-[11px]">
                    {fw}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((row, i) => (
                <tr
                  key={row.capability}
                  className={`border-b border-border-muted last:border-b-0 ${i % 2 === 0 ? "bg-[#0A0B0E]" : "bg-surface-1"}`}
                >
                  <td className="px-5 py-3.5 font-medium text-white">{row.capability}</td>
                  <td className="px-5 py-3.5 text-accent-blue">{row.sidclaw}</td>
                  {row.covered.map((yes, j) => (
                    <td key={j} className="px-5 py-3.5 text-center">
                      {yes ? (
                        <Check className="h-4 w-4 text-accent-green mx-auto" />
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-center">
          <a
            href="https://docs.sidclaw.com/docs/compliance/finra-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[14px] font-medium text-accent-blue hover:text-[#60A5FA] transition-colors"
          >
            View full compliance documentation
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
