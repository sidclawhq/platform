'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Download } from 'lucide-react';

interface ControlMapping {
  control?: string;
  article?: string;
  category?: string;
  function?: string;
  title: string;
  coverage: 'covered' | 'partial' | 'gap';
  sidclaw_features?: string[];
  gaps?: string[];
  evidence_query?: string;
}

interface Framework {
  key: string;
  name: string;
  version: string;
  authority: string;
  description: string;
  mappings: ControlMapping[];
}

// Static mirror of /docs/compliance/*.json — consumed by the compliance
// export endpoint and displayed here. Keep in sync with docs/compliance/.
const FRAMEWORKS: Framework[] = [
  {
    key: 'soc2',
    name: 'SOC 2',
    version: 'TSC 2017 (2022 points of focus)',
    authority: 'AICPA',
    description: 'Trust Services Criteria — Security, Availability, Processing Integrity, Confidentiality, Privacy.',
    mappings: [
      { control: 'CC6.1', title: 'Logical access security', coverage: 'covered' },
      { control: 'CC6.3', title: 'User access management', coverage: 'covered' },
      { control: 'CC6.6', title: 'External users and third parties', coverage: 'covered' },
      { control: 'CC7.2', title: 'System monitoring — anomaly detection', coverage: 'covered' },
      { control: 'CC7.3', title: 'Incident response', coverage: 'partial' },
      { control: 'CC8.1', title: 'Change management', coverage: 'covered' },
      { control: 'CC9.1', title: 'Risk mitigation', coverage: 'covered' },
      { control: 'C1.1', title: 'Confidentiality handling', coverage: 'partial' },
    ],
  },
  {
    key: 'iso27001',
    name: 'ISO/IEC 27001',
    version: '2022 Annex A',
    authority: 'ISO',
    description: 'Information security management system.',
    mappings: [
      { control: 'A.5.15', title: 'Access control', coverage: 'covered' },
      { control: 'A.5.16', title: 'Identity management', coverage: 'covered' },
      { control: 'A.5.17', title: 'Authentication information', coverage: 'covered' },
      { control: 'A.8.2', title: 'Privileged access rights', coverage: 'covered' },
      { control: 'A.8.15', title: 'Logging', coverage: 'covered' },
      { control: 'A.8.16', title: 'Monitoring activities', coverage: 'covered' },
      { control: 'A.8.33', title: 'Test information', coverage: 'partial' },
    ],
  },
  {
    key: 'gdpr',
    name: 'GDPR',
    version: 'EU Regulation 2016/679',
    authority: 'European Union',
    description: 'General Data Protection Regulation.',
    mappings: [
      { article: 'Article 22', title: 'Automated decision-making + human intervention', coverage: 'covered' },
      { article: 'Article 25', title: 'Data protection by design', coverage: 'covered' },
      { article: 'Article 30', title: 'Records of processing', coverage: 'covered' },
      { article: 'Article 32', title: 'Security of processing', coverage: 'covered' },
      { article: 'Article 33', title: 'Breach notification', coverage: 'partial' },
      { article: 'Article 35', title: 'Data protection impact assessment', coverage: 'partial' },
    ],
  },
  {
    key: 'nist-ai-rmf',
    name: 'NIST AI RMF',
    version: 'AI 100-1',
    authority: 'NIST',
    description: 'AI Risk Management Framework — GOVERN, MAP, MEASURE, MANAGE.',
    mappings: [
      { function: 'GOVERN', category: 'GOVERN 1.1', title: 'Legal and regulatory requirements', coverage: 'covered' },
      { function: 'GOVERN', category: 'GOVERN 2.3', title: 'Executive accountability', coverage: 'covered' },
      { function: 'MAP', category: 'MAP 1.1', title: 'Intended purpose and context', coverage: 'covered' },
      { function: 'MAP', category: 'MAP 2.2', title: 'System documentation', coverage: 'covered' },
      { function: 'MEASURE', category: 'MEASURE 2.6', title: 'Impact monitoring', coverage: 'covered' },
      { function: 'MEASURE', category: 'MEASURE 2.7', title: 'Security and resilience', coverage: 'covered' },
      { function: 'MANAGE', category: 'MANAGE 2.3', title: 'Incident response', coverage: 'partial' },
      { function: 'MANAGE', category: 'MANAGE 4.1', title: 'Post-deployment monitoring', coverage: 'covered' },
    ],
  },
  {
    key: 'finra-2026',
    name: 'FINRA 2026',
    version: '2026 AI guidance',
    authority: 'FINRA',
    description: 'AI supervision requirements — pre-approval, human oversight, audit trails.',
    mappings: [
      { control: 'pre-approval', title: 'Pre-approval of AI use cases with sign-offs', coverage: 'covered' },
      { control: 'hitl-validation', title: 'Human-in-the-loop validation on client-impacting actions', coverage: 'covered' },
      { control: 'audit-trail', title: 'Audit trail of agent actions and decisions', coverage: 'covered' },
      { control: 'guardrails', title: 'Guardrails to constrain agent behaviors', coverage: 'covered' },
    ],
  },
  {
    key: 'eu-ai-act',
    name: 'EU AI Act',
    version: '2026 high-risk enforcement',
    authority: 'European Commission',
    description: 'High-risk AI system requirements.',
    mappings: [
      { article: 'Article 12', title: 'Automatic logging of system use', coverage: 'covered' },
      { article: 'Article 14', title: 'Human oversight commensurate with risk', coverage: 'covered' },
      { article: 'Article 15', title: 'Accuracy, robustness, cybersecurity', coverage: 'partial' },
    ],
  },
];

export default function CompliancePage() {
  const [active, setActive] = useState<Framework>(() => FRAMEWORKS[0]!);

  const counts = active.mappings.reduce(
    (acc, m) => {
      acc[m.coverage] = (acc[m.coverage] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const total = active.mappings.length;
  const coveredPct = total ? Math.round(((counts.covered ?? 0) / total) * 100) : 0;

  return (
    <div className="px-6 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Compliance coverage</h1>
        <p className="text-sm text-text-secondary">
          How SidClaw maps to the compliance frameworks your auditors care about. Click a control for the
          underlying features and evidence queries.
        </p>
      </header>

      <div className="flex gap-2 flex-wrap mb-6 border-b border-border pb-3">
        {FRAMEWORKS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActive(f)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40 ${
              active.key === f.key
                ? 'bg-surface-2 text-foreground'
                : 'text-text-secondary hover:text-foreground'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-md border border-border bg-surface-1 p-4">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">Authority</div>
          <div className="mt-1 text-sm">{active.authority}</div>
        </div>
        <div className="rounded-md border border-border bg-surface-1 p-4">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">Version</div>
          <div className="mt-1 text-sm font-mono">{active.version}</div>
        </div>
        <div className="rounded-md border border-border bg-surface-1 p-4">
          <div className="text-[11px] uppercase tracking-wide text-text-muted">Coverage</div>
          <div className="mt-1 text-sm font-mono">
            {coveredPct}% covered · {(counts.partial ?? 0)} partial · {counts.gap ?? 0} gap
          </div>
        </div>
      </div>

      <p className="text-sm text-text-secondary mb-4">{active.description}</p>

      <div className="rounded-md border border-border bg-surface-1 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            <tr className="text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 text-left">Ref</th>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {active.mappings.map((m, i) => {
              const ref = m.control || m.article || m.category || '';
              const icon =
                m.coverage === 'covered' ? (
                  <CheckCircle2 size={14} className="text-green-500" />
                ) : m.coverage === 'partial' ? (
                  <AlertCircle size={14} className="text-amber-500" />
                ) : (
                  <XCircle size={14} className="text-red-500" />
                );
              return (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-[12px]">{ref}</td>
                  <td className="px-4 py-2">{m.title}</td>
                  <td className="px-4 py-2 flex items-center gap-1.5">
                    {icon}
                    <span className="font-mono text-[11px] uppercase">{m.coverage}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href={`/api/compliance/${active.key}`}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-surface-2"
        >
          <Download size={14} /> Evidence bundle (JSON)
        </a>
        <a
          href="/dashboard/settings/audit-export"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-surface-2"
        >
          <Download size={14} /> Export audit trail (CSV)
        </a>
      </div>
    </div>
  );
}
