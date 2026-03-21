import Link from 'next/link';

interface AgentPolicySummaryProps {
  agentId: string;
  policyCount: { allow: number; approval_required: number; deny: number };
}

export function AgentPolicySummary({ agentId, policyCount }: AgentPolicySummaryProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-4">
        Policy Summary
      </h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Allow</span>
          <span className="text-sm font-medium text-accent-green">{policyCount.allow}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Approval Required</span>
          <span className="text-sm font-medium text-accent-amber">{policyCount.approval_required}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Deny</span>
          <span className="text-sm font-medium text-accent-red">{policyCount.deny}</span>
        </div>
      </div>
      <Link
        href={`/dashboard/policies?agent_id=${agentId}`}
        className="mt-4 inline-block text-sm text-foreground underline underline-offset-2 hover:text-text-secondary transition-colors"
      >
        View all policies &rarr;
      </Link>
    </div>
  );
}
