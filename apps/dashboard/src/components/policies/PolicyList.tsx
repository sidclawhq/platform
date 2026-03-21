'use client';

import { useMemo } from 'react';
import { PolicyCard } from './PolicyCard';
import type { PolicyListItem } from '@/lib/api-client';

interface PolicyListProps {
  policies: PolicyListItem[];
  loading: boolean;
  onEdit: (policy: PolicyListItem) => void;
  onDeactivate: (policy: PolicyListItem) => void;
  onTest: (policy: PolicyListItem) => void;
  onHistory: (policy: PolicyListItem) => void;
}

export function PolicyList({ policies, loading, onEdit, onDeactivate, onTest, onHistory }: PolicyListProps) {
  // Group policies by agent name
  const groupedByAgent = useMemo(() => {
    const groups: Record<string, { agentName: string; policies: PolicyListItem[] }> = {};
    for (const policy of policies) {
      const agentId = policy.agent_id;
      if (!groups[agentId]) {
        groups[agentId] = {
          agentName: policy.agent?.name ?? agentId,
          policies: [],
        };
      }
      groups[agentId].policies.push(policy);
    }
    return Object.values(groups);
  }, [policies]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-sm text-text-muted">Loading policies...</div>
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-text-muted">No policies found.</p>
        <p className="mt-1 text-xs text-text-muted">
          Try adjusting your filters or create a new policy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groupedByAgent.map((group, groupIndex) => (
        <div key={group.agentName}>
          <h2
            className={`mb-3 text-sm font-medium text-foreground ${
              groupIndex > 0 ? 'border-t border-border pt-6' : ''
            }`}
          >
            {group.agentName}
          </h2>
          <div className="space-y-3">
            {group.policies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onEdit={onEdit}
                onDeactivate={onDeactivate}
                onTest={onTest}
                onHistory={onHistory}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
