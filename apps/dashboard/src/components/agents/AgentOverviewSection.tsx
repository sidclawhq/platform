import { cn } from '@/lib/utils';
import type { AgentDetail } from '@/lib/api-client';

const envBadgeStyles: Record<string, string> = {
  dev: 'bg-surface-2 text-text-secondary',
  test: 'bg-accent-blue/10 text-accent-blue',
  prod: 'bg-accent-amber/10 text-accent-amber',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface AgentOverviewSectionProps {
  agent: AgentDetail;
}

export function AgentOverviewSection({ agent }: AgentOverviewSectionProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-4">
        Overview
      </h2>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-3">
        <Field label="Owner">{agent.owner_name}</Field>
        <Field label="Role">{agent.owner_role}</Field>
        <Field label="Team">{agent.team}</Field>
        <Field label="Environment">
          <span
            className={cn(
              'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
              envBadgeStyles[agent.environment] ?? envBadgeStyles.dev,
            )}
          >
            {agent.environment}
          </span>
        </Field>
        <Field label="Created">{formatDate(agent.created_at)}</Field>
        <Field label="Next Review">{formatDate(agent.next_review_date)}</Field>
      </dl>
    </div>
  );
}
