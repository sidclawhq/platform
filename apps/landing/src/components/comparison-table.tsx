import { Check, Minus } from "lucide-react";

const rows = [
  { capability: "Agent Identity", traditional: true, sidclaw: true, gap: false },
  { capability: "Policy Evaluation", traditional: true, sidclaw: true, gap: false },
  { capability: "Audit Trail", traditional: true, sidclaw: true, gap: false },
  { capability: "Approval Workflow", traditional: false, sidclaw: true, gap: true },
  { capability: "Context Cards", traditional: false, sidclaw: true, gap: false },
  { capability: "Risk Classification", traditional: false, sidclaw: true, gap: false },
  { capability: "Integrity Hashes", traditional: false, sidclaw: true, gap: false },
];

export function ComparisonTable() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          What makes this different
        </h2>
        <div className="mt-12 overflow-hidden rounded-lg border border-border-default bg-surface-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="px-6 py-4 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  Capability
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-text-muted uppercase tracking-wide">
                  Traditional IAM
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-text-muted uppercase tracking-wide">
                  SidClaw
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.capability}
                  className="border-b border-border-default last:border-b-0"
                >
                  <td className="px-6 py-3.5 text-text-secondary">
                    {row.capability}
                    {row.gap && (
                      <span className="ml-2 text-xs text-accent-amber">
                        &larr; the gap
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {row.traditional ? (
                      <Check className="mx-auto h-4 w-4 text-text-muted" />
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-text-muted/40" />
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <Check className="mx-auto h-4 w-4 text-accent-green" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
