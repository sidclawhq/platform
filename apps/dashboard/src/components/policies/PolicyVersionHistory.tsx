'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { PolicyRuleVersion } from '@/lib/api-client';
import { SlideOverPanel } from '@/components/ui/SlideOverPanel';
import { PolicyVersionDiff } from './PolicyVersionDiff';

interface PolicyVersionHistoryProps {
  policyId: string | null;
  policyName: string;
  currentVersion: number;
  onClose: () => void;
}

export function PolicyVersionHistory({
  policyId,
  policyName,
  currentVersion,
  onClose,
}: PolicyVersionHistoryProps) {
  const [versions, setVersions] = useState<PolicyRuleVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!policyId) return;
    setLoading(true);
    setError('');
    api
      .getPolicyVersions(policyId, { limit: 50 })
      .then((res) => setVersions(res.data))
      .catch(() => setError('Failed to load version history'))
      .finally(() => setLoading(false));
  }, [policyId]);

  return (
    <SlideOverPanel
      isOpen={policyId !== null}
      onClose={onClose}
      title={`Version History: "${policyName}"`}
    >
      <div className="p-6">
        <p className="text-sm text-text-secondary mb-4">
          Current Version: <span className="font-mono font-medium text-foreground">v{currentVersion}</span>
        </p>

        {loading && (
          <p className="text-sm text-text-muted">Loading version history...</p>
        )}

        {error && (
          <div className="rounded border border-accent-red bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
            {error}
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <p className="text-sm text-text-muted">
            No changes recorded — this is the original version.
          </p>
        )}

        {!loading && !error && versions.length > 0 && (
          <div className="space-y-3">
            {versions.map((version, index) => {
              const isLatest = index === 0;
              const toVersion = version.version + 1;
              const label = isLatest
                ? `v${version.version} \u2192 v${toVersion} (current)`
                : `v${version.version} \u2192 v${toVersion}`;

              // The first version entry (lowest version number) is the initial creation
              const isInitial = version.version === 1 && index === versions.length - 1;

              return (
                <div
                  key={version.id}
                  className="bg-surface-1 border border-border rounded-lg p-4"
                >
                  <p className="text-sm font-medium font-mono text-foreground">
                    {isInitial ? `v${version.version} (initial)` : label}
                  </p>

                  <p className="text-sm text-text-secondary mt-1">
                    {isInitial ? 'Created by' : 'Changed by'}: {version.modified_by}
                  </p>

                  <p className="font-mono text-xs text-text-muted mt-1">
                    {isInitial ? 'Created at' : 'Changed at'}:{' '}
                    {new Date(version.modified_at).toLocaleString()}
                  </p>

                  {!isInitial && version.change_summary && (
                    <PolicyVersionDiff changeSummary={version.change_summary} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SlideOverPanel>
  );
}
