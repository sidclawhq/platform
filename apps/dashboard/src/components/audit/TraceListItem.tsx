"use client";

import { cn } from "@/lib/utils";
import type { TraceSummary } from "@/lib/api-client";
import { TraceOutcomeBadge } from "./TraceOutcomeBadge";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "pending";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function TraceListItem({
  trace,
  selected,
  onSelect,
}: {
  trace: TraceSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid="trace-item"
      className={cn(
        "w-full cursor-pointer rounded-md border-l-4 px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-accent-blue bg-surface-2"
          : "border-transparent bg-surface-1 hover:bg-surface-2"
      )}
    >
      <div className="flex items-center justify-between">
        <TraceOutcomeBadge outcome={trace.final_outcome} hasApproval={trace.has_approval} />
        <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
          <span>{formatTime(trace.started_at)}</span>
          <span>({formatDuration(trace.duration_ms)})</span>
        </div>
      </div>

      <div className="mt-1 text-sm text-text-primary">{trace.agent_name}</div>

      <div className="mt-0.5 font-mono text-sm text-text-secondary">
        {trace.requested_operation} &rarr; {trace.target_integration}
      </div>

      <div className="mt-0.5 font-mono text-xs text-text-muted">
        {trace.resource_scope}
      </div>
    </button>
  );
}
