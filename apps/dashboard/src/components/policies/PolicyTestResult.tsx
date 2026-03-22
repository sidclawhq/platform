'use client';

import { PolicyEffectBadge } from './PolicyEffectBadge';
import type { PolicyTestResult as PolicyTestResultType } from '@/lib/api-client';

interface PolicyTestResultProps {
  result: PolicyTestResultType;
}

export function PolicyTestResult({ result }: PolicyTestResultProps) {
  const hasMatch = result.rule_id !== null;

  return (
    <div data-testid="policy-test-result" className="bg-surface-1 border border-border rounded-lg p-4 mt-4">
      <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-3">
        Test Result
      </p>

      {/* Decision */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-text-secondary">Decision:</span>
        <PolicyEffectBadge effect={result.effect} />
      </div>

      {/* Matched Rule */}
      <div className="mb-3">
        {hasMatch ? (
          <p className="text-sm text-foreground">
            <span className="text-text-secondary">Matched Rule: </span>
            {result.rationale.split(' — ')[0] || 'Policy rule matched'}
          </p>
        ) : (
          <p className="text-sm text-accent-red">
            No matching rule — default deny
          </p>
        )}
      </div>

      {/* Rationale */}
      <div className="mb-3">
        <p className="text-sm text-text-secondary italic">
          {hasMatch ? result.rationale : 'Denied by default (secure by default)'}
        </p>
      </div>

      {/* Policy Version */}
      {result.policy_version !== null && (
        <p className="font-mono text-xs text-text-muted">
          Policy Version: v{result.policy_version}
        </p>
      )}
    </div>
  );
}
