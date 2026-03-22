'use client';

import { useState, useEffect, useCallback } from 'react';
import { GovernanceEvent } from './GovernanceEvent';
import { ApprovalCard } from './ApprovalCard';

interface GovernancePanelProps {
  sessionId?: string;
  agentId: string;
  apiKey: string;
}

interface TraceData {
  id: string;
  requested_operation: string;
  target_integration: string;
  final_outcome: string;
  started_at: string;
  events: Array<{
    event_type: string;
    actor_name: string;
    description: string;
    timestamp: string;
    status: string;
  }>;
}

interface ApprovalData {
  id: string;
  trace_id: string;
  requested_operation: string;
  target_integration: string;
  flag_reason: string;
  status: string;
  risk_classification: string | null;
  context_snapshot: Record<string, unknown> | null;
  agent: { name: string; owner_name: string };
  policy_rule: { policy_name: string; rationale: string };
  trace_events: Array<Record<string, unknown>>;
}

export function GovernancePanel({ agentId, apiKey }: GovernancePanelProps) {
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalData[]>([]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/governance?agentId=${agentId}&apiKey=${apiKey}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setTraces(data.traces ?? []);
      setPendingApprovals(data.pendingApprovals ?? []);
    } catch {
      // Silent fail on poll errors
    }
  }, [agentId, apiKey]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  const handleApprovalAction = async (approvalId: string, action: 'approve' | 'deny', note: string) => {
    await fetch('/api/approval-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId, action, apiKey, note }),
    });
    await poll();
  };

  const handleApprove = async (approvalId: string, note: string) => {
    await handleApprovalAction(approvalId, 'approve', note);
  };

  const handleDeny = async (approvalId: string, note: string) => {
    await handleApprovalAction(approvalId, 'deny', note);
  };

  return (
    <div className="flex w-1/2 flex-col">
      {/* Header */}
      <div className="border-b border-[#2A2A2E] px-6 py-4">
        <h2 className="text-base font-medium text-[#E4E4E7]">Governance Activity</h2>
        <p className="mt-1 text-sm text-[#71717A]">
          Real-time policy decisions from SidClaw &bull; {traces.length} trace{traces.length !== 1 ? 's' : ''} &bull; {pendingApprovals.length} pending
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {traces.length === 0 && pendingApprovals.length === 0 && (
          <div className="mt-8 text-center text-base text-[#71717A]">
            <p>Governance events will appear here as you interact with the agent.</p>
            <p className="mt-2">Try asking the agent to do something →</p>
          </div>
        )}

        {/* Pending approvals first (most important) */}
        {pendingApprovals.map((approval) => (
          <ApprovalCard
            key={approval.id}
            approval={approval}
            onApprove={(note) => handleApprove(approval.id, note)}
            onDeny={(note) => handleDeny(approval.id, note)}
          />
        ))}

        {/* Recent traces */}
        {traces.map((trace) => (
          <GovernanceEvent key={trace.id} trace={trace} />
        ))}
      </div>

      {/* Footer links */}
      <div className="border-t border-[#2A2A2E] px-6 py-3 flex items-center justify-between">
        <span className="text-sm text-[#71717A]">Atlas Financial — Demo Environment</span>
        <div className="flex gap-4">
          <a href="http://localhost:3000/dashboard" target="_blank" rel="noopener noreferrer" className="text-sm text-[#3B82F6] hover:underline">
            Open Full Dashboard →
          </a>
          <a href="https://docs.sidclaw.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#3B82F6] hover:underline">
            Documentation →
          </a>
        </div>
      </div>
    </div>
  );
}
