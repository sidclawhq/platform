"use client";

import { ApprovalRequest } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface QueueItemCardProps {
  approvalRequest: ApprovalRequest;
  agentName: string;
  onReview: (id: string) => void;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export function QueueItemCard({
  approvalRequest,
  agentName,
  onReview,
}: QueueItemCardProps) {
  const {
    id,
    trace_id,
    requested_operation,
    target_integration,
    resource_scope,
    data_classification,
    authority_model,
    delegated_from,
    policy_effect,
    flag_reason,
    status,
    requested_at,
    separation_of_duties_check,
  } = approvalRequest;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-5">
      {/* Top line */}
      <div className="flex justify-between items-start">
        <span className="text-base font-medium text-white/90">
          {requested_operation}
        </span>
        <div className="flex items-center gap-3">
          <StatusBadge category="approval" label={status} />
          <span className="font-mono-trace text-xs text-white/30">
            {trace_id}
          </span>
        </div>
      </div>

      {/* Second line */}
      <div className="mt-1.5 text-sm text-white/50">
        {agentName}
        {" · "}
        {formatLabel(authority_model)}
        {delegated_from && ` · Delegated from ${delegated_from}`}
      </div>

      {/* Body section */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="text-sm text-white/40">Target integration</span>
          <span className="text-sm text-white/80">{target_integration}</span>
        </div>
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="text-sm text-white/40">Resource scope</span>
          <span className="text-sm text-white/80">{resource_scope}</span>
        </div>
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="text-sm text-white/40">Data classification</span>
          <span className="text-sm text-white/80">
            {formatLabel(data_classification)}
          </span>
        </div>
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="text-sm text-white/40">Authority model</span>
          <span className="text-sm text-white/80">
            {formatLabel(authority_model)}
          </span>
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-sm text-white/40">Policy effect</span>
          <StatusBadge category="policy" label={policy_effect} />
        </div>
      </div>

      {/* Why this was flagged */}
      <div className="bg-amber-500/[0.04] border-l-2 border-amber-500/30 rounded-r-md p-4 mt-4">
        <div className="text-xs uppercase tracking-wide text-amber-400/80 font-medium mb-1.5">
          Why this was flagged
        </div>
        <div className="text-sm text-white/70 leading-relaxed">
          {flag_reason}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/[0.06]">
        <span className="text-xs text-white/30">
          Requested: {formatDate(requested_at)} · Separation of duties:{" "}
          {formatLabel(separation_of_duties_check)}
        </span>
        <button
          onClick={() => onReview(id)}
          className="bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-sm px-4 py-1.5 rounded-md transition-colors cursor-pointer"
        >
          Review
        </button>
      </div>
    </div>
  );
}
