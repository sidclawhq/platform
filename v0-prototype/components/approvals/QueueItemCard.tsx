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
    <div className="rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:border-muted-foreground/20">
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="text-[14px] font-medium text-foreground">
          {requested_operation}
        </span>
        <div className="flex items-center gap-3">
          <StatusBadge category="approval" label={status} />
          <span className="font-mono-trace text-[11px] text-muted-foreground">
            {trace_id}
          </span>
        </div>
      </div>

      <div className="mb-3 text-[12px] text-muted-foreground">
        {agentName}
        {" · "}
        {formatLabel(authority_model)}
        {delegated_from && ` · Delegated from ${delegated_from}`}
      </div>

      <div className="mb-3 grid gap-x-8 gap-y-1 text-[12px] md:grid-cols-2">
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="text-muted-foreground">Target integration</span>
          <span className="text-foreground">{target_integration}</span>
        </div>
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="text-muted-foreground">Resource scope</span>
          <span className="text-foreground">{resource_scope}</span>
        </div>
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="text-muted-foreground">Data classification</span>
          <span className="text-foreground">
            {formatLabel(data_classification)}
          </span>
        </div>
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="text-muted-foreground">Authority model</span>
          <span className="text-foreground">
            {formatLabel(authority_model)}
          </span>
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-muted-foreground">Policy effect</span>
          <StatusBadge category="policy" label={policy_effect} />
        </div>
      </div>

      <div className="mb-3 rounded-r border-l-2 border-status-approval bg-surface-2 p-3">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-status-approval">
          Why this was flagged
        </div>
        <div className="text-[13px] leading-relaxed text-secondary-foreground">{flag_reason}</div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-3 md:flex-row md:items-center md:justify-between">
        <span className="text-[11px] text-muted-foreground">
          Requested: {formatDate(requested_at)} · Separation of duties:{" "}
          {formatLabel(separation_of_duties_check)}
        </span>
        <button
          onClick={() => onReview(id)}
          className="cursor-pointer rounded border border-border bg-surface-2 px-4 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-3"
        >
          Review
        </button>
      </div>
    </div>
  );
}
