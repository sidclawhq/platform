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
    <div className="rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:border-muted-foreground/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[14px] font-medium text-foreground">
          {policyRule.policy_name}
        </span>
        <StatusBadge category="policy" label={policyRule.policy_effect} />
      </div>

      <div className="mb-3 grid gap-x-8 gap-y-1.5 text-[12px] md:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Agent</span>{" "}
          {onAgentClick ? (
            <span
              className="cursor-pointer text-foreground underline-offset-2 transition-colors hover:underline"
              onClick={() => onAgentClick(policyRule.agent_id)}
            >
              {agentName}
            </span>
          ) : (
            <span className="text-foreground">{agentName}</span>
          )}
        </div>

        <div>
          <span className="text-muted-foreground">Authorized integration</span>{" "}
          <span className="text-foreground">
            {policyRule.authorized_integration}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Operation</span>{" "}
          <span className="text-foreground">
            {formatLabel(policyRule.operation)}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Resource scope</span>{" "}
          <span className="text-foreground">
            {policyRule.resource_scope}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Data classification</span>{" "}
          <span className="text-foreground">
            {formatLabel(policyRule.data_classification)}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Policy version</span>{" "}
          <span className="font-mono-trace text-foreground">
            {policyRule.policy_version}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Modified by</span>{" "}
          <span className="text-foreground">
            {policyRule.modified_by}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">Modified at</span>{" "}
          <span className="text-foreground">
            {formatDate(policyRule.modified_at)}
          </span>
        </div>
      </div>

      <div className="mt-2 rounded border border-border bg-surface-2 p-3">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Rationale
        </div>
        <div className="text-[13px] leading-relaxed text-secondary-foreground">
          {policyRule.rationale}
        </div>
      </div>

      {policyRule.max_session_ttl !== null && (
        <div className="mt-3 text-[11px] text-muted-foreground">
          Session TTL: {policyRule.max_session_ttl}
        </div>
      )}
    </div>
  );
}
