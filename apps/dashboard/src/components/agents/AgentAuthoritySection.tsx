import { cn } from '@/lib/utils';
import type { AgentDetail } from '@/lib/api-client';

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const autonomyBadgeStyles: Record<string, string> = {
  low: 'bg-accent-green/10 text-accent-green',
  medium: 'bg-accent-amber/10 text-accent-amber',
  high: 'bg-accent-red/10 text-accent-red',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

interface AgentAuthoritySectionProps {
  agent: AgentDetail;
}

export function AgentAuthoritySection({ agent }: AgentAuthoritySectionProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-4">
        Authority & Identity
      </h2>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
        <Field label="Authority Model">{formatLabel(agent.authority_model)}</Field>
        <Field label="Identity Mode">{formatLabel(agent.identity_mode)}</Field>
        <Field label="Delegation Model">{formatLabel(agent.delegation_model)}</Field>
        <Field label="Autonomy Tier">
          <span
            className={cn(
              'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
              autonomyBadgeStyles[agent.autonomy_tier] ?? autonomyBadgeStyles.low,
            )}
          >
            {formatLabel(agent.autonomy_tier)}
          </span>
        </Field>
      </dl>
    </div>
  );
}
