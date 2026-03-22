'use client';

import { useState } from 'react';

interface ApprovalCardProps {
  approval: {
    id: string;
    requested_operation: string;
    target_integration: string;
    flag_reason: string;
    risk_classification: string | null;
    context_snapshot: Record<string, unknown> | null;
    policy_rule: { policy_name: string; rationale: string };
  };
  onApprove: (note: string) => void;
  onDeny: (note: string) => void;
}

export function ApprovalCard({ approval, onApprove, onDeny }: ApprovalCardProps) {
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  const riskColors: Record<string, string> = {
    low: 'bg-[#71717A]/20 text-[#71717A]',
    medium: 'bg-[#3B82F6]/20 text-[#3B82F6]',
    high: 'bg-[#F59E0B]/20 text-[#F59E0B]',
    critical: 'bg-[#EF4444]/20 text-[#EF4444]',
  };

  return (
    <div className="rounded-lg border border-[#F59E0B]/30 bg-[#111113] overflow-hidden animate-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2E]">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#F59E0B]/20 px-2 py-0.5 text-xs font-medium text-[#F59E0B]">
            APPROVAL REQUIRED
          </span>
          {approval.risk_classification && (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${riskColors[approval.risk_classification] ?? riskColors.medium}`}>
              {approval.risk_classification.toUpperCase()}
            </span>
          )}
        </div>
        <span className="text-xs text-[#71717A]">Just now</span>
      </div>

      {/* Action */}
      <div className="px-4 py-3">
        <div className="font-mono text-sm text-[#E4E4E7]">
          {approval.requested_operation} → {approval.target_integration}
        </div>
      </div>

      {/* Why This Was Flagged */}
      <div className="mx-4 mb-3 rounded border-l-4 border-[#F59E0B] bg-[#1A1A1D] px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-[#F59E0B] mb-1">
          Why This Was Flagged
        </div>
        <div className="text-sm text-[#A1A1AA]">
          {approval.policy_rule.rationale}
        </div>
        <div className="mt-1 text-xs text-[#71717A]">
          Policy: {approval.policy_rule.policy_name}
        </div>
      </div>

      {/* Context */}
      {approval.context_snapshot && Object.keys(approval.context_snapshot).length > 0 && (
        <div className="mx-4 mb-3 rounded bg-[#1A1A1D] px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-1">
            Agent Context
          </div>
          <pre className="text-xs text-[#A1A1AA] font-mono whitespace-pre-wrap">
            {JSON.stringify(approval.context_snapshot, null, 2)}
          </pre>
        </div>
      )}

      {/* Reviewer Action */}
      <div className="px-4 pb-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          className="w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#71717A] focus:border-[#3B82F6] focus:outline-none resize-none"
          rows={2}
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => { setActing(true); onApprove(note); }}
            disabled={acting}
            className="flex-1 rounded bg-[#22C55E]/80 px-4 py-2 text-sm font-medium text-white hover:bg-[#22C55E] disabled:opacity-50 transition-colors"
          >
            {acting ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={() => { setActing(true); onDeny(note); }}
            disabled={acting}
            className="flex-1 rounded bg-[#EF4444]/80 px-4 py-2 text-sm font-medium text-white hover:bg-[#EF4444] disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
