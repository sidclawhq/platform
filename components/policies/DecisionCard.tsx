"use client";

import { PolicyRule } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface DecisionCardProps {
  policyRule: PolicyRule;
  agentName: string;
  onAgentClick?: (agentId: string) => void;
}

function formatLabel(s: string): string {
  return s
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DecisionCard({
  policyRule,
  agentName,
  onAgentClick,
}: DecisionCardProps) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-5">
      {/* Top line */}
      <div className="flex justify-between items-start">
        <span className="text-base font-medium text-white/90">
          {policyRule.policy_name}
        </span>
        <StatusBadge category="policy" label={policyRule.policy_effect} />
      </div>

      {/* Body rows */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5">
        <div>
          <span className="text-xs text-white/30">Agent</span>{" "}
          {onAgentClick ? (
            <span
              className="text-sm text-white/70 hover:text-white/90 cursor-pointer underline-offset-2 hover:underline transition-colors"
              onClick={() => onAgentClick(policyRule.agent_id)}
            >
              {agentName}
            </span>
          ) : (
            <span className="text-sm text-white/60">{agentName}</span>
          )}
        </div>

        <div>
          <span className="text-xs text-white/30">Authorized integration</span>{" "}
          <span className="text-sm text-white/60">
            {policyRule.authorized_integration}
          </span>
        </div>

        <div>
          <span className="text-xs text-white/30">Operation</span>{" "}
          <span className="text-sm text-white/60">
            {formatLabel(policyRule.operation)}
          </span>
        </div>

        <div>
          <span className="text-xs text-white/30">Resource scope</span>{" "}
          <span className="text-sm text-white/60">
            {policyRule.resource_scope}
          </span>
        </div>

        <div>
          <span className="text-xs text-white/30">Data classification</span>{" "}
          <span className="text-sm text-white/60">
            {formatLabel(policyRule.data_classification)}
          </span>
        </div>

        <div>
          <span className="text-xs text-white/30">Policy version</span>{" "}
          <span className="text-sm text-white/60">
            {policyRule.policy_version}
          </span>
        </div>

        <div>
          <span className="text-xs text-white/30">Modified by</span>{" "}
          <span className="text-sm text-white/60">
            {policyRule.modified_by}
          </span>
        </div>

        <div>
          <span className="text-xs text-white/30">Modified at</span>{" "}
          <span className="text-sm text-white/60">
            {formatDate(policyRule.modified_at)}
          </span>
        </div>
      </div>

      {/* Rationale block */}
      <div className="bg-white/[0.03] border-l-2 border-blue-400/30 rounded-r-md p-4 mt-4">
        <div className="text-xs uppercase tracking-wide text-blue-400/60 font-medium mb-1.5">
          Rationale
        </div>
        <div className="text-sm text-white/60 leading-relaxed">
          {policyRule.rationale}
        </div>
      </div>

      {/* Optional footer */}
      {policyRule.max_session_ttl !== null && (
        <div className="mt-3 text-xs text-white/30">
          Session TTL: {policyRule.max_session_ttl}
        </div>
      )}
    </div>
  );
}
