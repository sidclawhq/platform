import { relativeTime } from '@/lib/format';
import { ApprovalStatusBadge, DataClassificationBadge } from './ApprovalStatusBadge';
import { ApprovalRiskBadge } from './ApprovalRiskBadge';
import { ApprovalContextSnapshot } from './ApprovalContextSnapshot';
import { ApprovalTraceEvents } from './ApprovalTraceEvents';
import type { ApprovalDetailResponse } from '@/lib/api-client';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function SodBadge({ check }: { check: string }) {
  const colors: Record<string, string> = {
    pass: 'bg-accent-green/20 text-accent-green',
    fail: 'bg-accent-red/20 text-accent-red',
    not_applicable: 'bg-surface-2 text-text-muted',
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[check] ?? colors.not_applicable}`}>
      {formatLabel(check)}
    </span>
  );
}

export function ApprovalDetailSections({ data }: { data: ApprovalDetailResponse }) {
  return (
    <div className="flex flex-col gap-0">
      {/* Section 1: Request Summary */}
      <section className="border-b border-border px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Request Summary
        </h3>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-foreground">
              {data.requested_operation}
            </span>
            <span className="text-sm text-text-muted">→</span>
            <span className="font-mono text-sm text-foreground">
              {data.target_integration}
            </span>
          </div>
          <div className="font-mono text-xs text-text-muted">
            {data.resource_scope}
          </div>
          <div className="flex items-center gap-2">
            <ApprovalStatusBadge status={data.status} />
            <DataClassificationBadge classification={data.data_classification} />
            <ApprovalRiskBadge risk={data.risk_classification as 'low' | 'medium' | 'high' | 'critical' | null} />
          </div>
          <div className="text-xs text-text-muted">
            Requested {relativeTime(data.requested_at)}
          </div>
        </div>
      </section>

      {/* Section 2: Authority Context */}
      <section className="border-b border-border px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Authority Context
        </h3>
        <div className="mt-3 space-y-1.5">
          <div className="text-sm text-foreground">
            {data.agent.owner_name}{' '}
            <span className="text-text-secondary">({data.agent.owner_role})</span>
          </div>
          <div className="text-sm text-text-secondary">
            Authority: {formatLabel(data.agent.authority_model)} — Delegation: {formatLabel(data.agent.delegation_model)}
          </div>
          {data.delegated_from && (
            <div className="text-sm text-text-secondary">
              Acting on behalf of {data.delegated_from}
            </div>
          )}
          <div className="text-xs text-text-muted">
            Team: {data.agent.team}
          </div>
        </div>
      </section>

      {/* Section 3: Why This Was Flagged (VISUAL ANCHOR) */}
      <section data-testid="why-flagged" className="border-b border-border border-l-4 border-l-accent-amber bg-surface-2 px-6 py-5">
        <h3 className="text-base font-medium text-foreground">
          Why This Was Flagged
        </h3>
        <div className="mt-3 space-y-2">
          <div className="text-sm font-medium text-foreground">
            {data.policy_rule.policy_name}
          </div>
          <p className="text-sm text-text-secondary">
            {data.policy_rule.rationale}
          </p>
          <div className="font-mono text-xs text-text-muted">
            Policy v{data.policy_rule.policy_version}
          </div>
        </div>
      </section>

      {/* Section 4: Context Snapshot */}
      <section className="border-b border-border px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Context Snapshot
        </h3>
        <div className="mt-3">
          {data.context_snapshot ? (
            <ApprovalContextSnapshot context={data.context_snapshot} />
          ) : (
            <p className="text-sm text-text-muted">
              No context provided by the agent
            </p>
          )}
        </div>
      </section>

      {/* Section 5: Trace So Far */}
      <section className="border-b border-border px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Trace So Far
        </h3>
        <div className="mt-3">
          <ApprovalTraceEvents events={data.trace_events} />
        </div>
      </section>

      {/* Section 7: Governance Metadata */}
      <section className="px-6 py-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Governance Metadata
        </h3>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Trace ID:</span>
            <span className="font-mono text-xs text-text-secondary">{data.trace_id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Policy version:</span>
            <span className="font-mono text-xs text-text-secondary">
              v{data.policy_rule.policy_version}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Requested at:</span>
            <span className="font-mono text-xs text-text-secondary">
              {data.requested_at}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Separation of duties:</span>
            <SodBadge check={data.separation_of_duties_check} />
          </div>
        </div>
      </section>
    </div>
  );
}
