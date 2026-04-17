'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';

interface TraceRow {
  id: string;
  agent_id: string;
  agent_name: string;
  requested_operation: string;
  final_outcome: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

interface TracesResponse {
  data: TraceRow[];
  pagination: { total: number; limit: number; offset: number };
}

type Range = { key: string; label: string; hours: number };

const RANGES: Range[] = [
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '7d', label: '7 days', hours: 168 },
  { key: '30d', label: '30 days', hours: 720 },
];

const DEFAULT_RANGE: Range = { key: '7d', label: '7 days', hours: 168 };

export default function AnalyticsPage() {
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);

  useEffect(() => {
    setLoading(true);
    const from = new Date(Date.now() - range.hours * 3600_000).toISOString();
    const to = new Date().toISOString();
    api
      .get<TracesResponse>(`/api/v1/traces?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=100`)
      .then((r) => setTraces(r.data))
      .finally(() => setLoading(false));
  }, [range]);

  const stats = useMemo(() => {
    const total = traces.length;
    const byOutcome: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let totalDuration = 0;
    let completed = 0;
    for (const t of traces) {
      byOutcome[t.final_outcome] = (byOutcome[t.final_outcome] ?? 0) + 1;
      byAgent[t.agent_name] = (byAgent[t.agent_name] ?? 0) + 1;
      if (t.duration_ms != null) {
        totalDuration += t.duration_ms;
        completed += 1;
      }
    }
    const topAgents = Object.entries(byAgent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { total, byOutcome, topAgents, avgDuration: completed ? Math.round(totalDuration / completed) : 0 };
  }, [traces]);

  const outcomeColor = (outcome: string) => {
    if (outcome === 'executed' || outcome === 'completed_with_approval') return 'text-green-500';
    if (outcome === 'blocked' || outcome === 'denied') return 'text-red-500';
    if (outcome === 'expired') return 'text-amber-500';
    return 'text-text-secondary';
  };

  const outcomeBarFill = (outcome: string) => {
    if (outcome === 'executed' || outcome === 'completed_with_approval') return 'bg-green-500/70';
    if (outcome === 'blocked' || outcome === 'denied') return 'bg-red-500/70';
    if (outcome === 'expired') return 'bg-amber-500/70';
    return 'bg-text-secondary';
  };

  return (
    <div className="px-6 py-8 max-w-5xl">
      <header className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-semibold mb-1">Analytics</h1>
          <p className="text-sm text-text-secondary">
            Governance volume, outcome distribution, and top agents.
          </p>
        </div>
        <div className="flex gap-1 border border-border rounded-md overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-[12px] ${
                range.key === r.key
                  ? 'bg-surface-2 text-foreground'
                  : 'text-text-secondary hover:bg-surface-2/50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Total actions" value={stats.total.toString()} />
            <StatCard
              label="Executed"
              value={(stats.byOutcome['executed'] ?? 0).toString()}
              subtitle={stats.total ? `${Math.round(((stats.byOutcome['executed'] ?? 0) / stats.total) * 100)}%` : ''}
            />
            <StatCard
              label="Blocked/denied"
              value={(
                (stats.byOutcome['blocked'] ?? 0) + (stats.byOutcome['denied'] ?? 0)
              ).toString()}
            />
            <StatCard
              label="Avg duration"
              value={stats.avgDuration ? `${stats.avgDuration}ms` : '—'}
            />
          </div>

          <div className="rounded-md border border-border bg-surface-1 p-4">
            <h2 className="text-[11px] uppercase tracking-wide text-text-muted mb-3">Outcome distribution</h2>
            <div className="space-y-1.5">
              {Object.entries(stats.byOutcome)
                .sort((a, b) => b[1] - a[1])
                .map(([outcome, count]) => {
                  const percent = stats.total ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={outcome} className="flex items-center gap-3">
                      <span className={`font-mono text-[11px] w-44 ${outcomeColor(outcome)}`}>{outcome}</span>
                      <div className="flex-1 h-2 bg-surface-2 rounded-sm overflow-hidden">
                        <div
                          className={`h-full transition-all ${outcomeBarFill(outcome)}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-text-secondary w-16 text-right">
                        {count} · {percent.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface-1 p-4">
            <h2 className="text-[11px] uppercase tracking-wide text-text-muted mb-3">Top agents by volume</h2>
            <div className="space-y-1.5">
              {stats.topAgents.length === 0 && (
                <p className="text-sm text-text-secondary">No activity in this range.</p>
              )}
              {stats.topAgents.map(([name, count]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm w-56 truncate">{name}</span>
                  <div className="flex-1 h-2 bg-surface-2 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-blue-500/60 transition-all"
                      style={{
                        width: `${
                          stats.total ? (count / stats.total) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-text-secondary w-12 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-4">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl">{value}</div>
      {subtitle && <div className="mt-0.5 text-[11px] text-text-muted">{subtitle}</div>}
    </div>
  );
}
