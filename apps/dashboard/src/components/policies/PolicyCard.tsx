'use client';

import { PolicyEffectBadge } from './PolicyEffectBadge';
import { DataClassificationBadge } from '@/components/approvals/ApprovalStatusBadge';
import type { PolicyListItem } from '@/lib/api-client';
import { usePermissions } from '@/lib/permissions';

interface PolicyCardProps {
  policy: PolicyListItem;
  onEdit: (policy: PolicyListItem) => void;
  onDeactivate: (policy: PolicyListItem) => void;
  onTest: (policy: PolicyListItem) => void;
  onHistory: (policy: PolicyListItem) => void;
}

export function PolicyCard({ policy, onEdit, onDeactivate, onTest, onHistory }: PolicyCardProps) {
  const { canManagePolicies } = usePermissions();

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5">
      {/* Row 1: Name + Effect badge */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          {policy.policy_name}
        </span>
        <PolicyEffectBadge effect={policy.policy_effect} />
      </div>

      {/* Row 2: Operation → target / scope */}
      <div className="mt-2 font-mono text-sm text-text-secondary">
        {policy.operation} → {policy.target_integration} / {policy.resource_scope}
      </div>

      {/* Row 3: Metadata */}
      <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          Classification: <DataClassificationBadge classification={policy.data_classification} />
        </span>
        <span>Priority: {policy.priority}</span>
        <span>v{policy.policy_version}</span>
      </div>

      {/* Row 4: Rationale */}
      {policy.rationale && (
        <p className="text-sm text-text-secondary italic border-l-2 border-border pl-3 mt-3">
          {policy.rationale}
        </p>
      )}

      {/* Row 5: Actions */}
      <div className="mt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => onTest(policy)}
          className="text-xs text-accent-blue hover:underline"
        >
          Test
        </button>
        <button
          type="button"
          onClick={() => onHistory(policy)}
          className="text-xs text-text-secondary hover:text-foreground"
        >
          History
        </button>
        {canManagePolicies && (
          <>
            <button
              type="button"
              onClick={() => onEdit(policy)}
              className="text-xs text-accent-blue hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDeactivate(policy)}
              className="text-xs text-accent-red hover:underline"
            >
              Deactivate
            </button>
          </>
        )}
      </div>
    </div>
  );
}
