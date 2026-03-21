"use client";

import type { TraceDetail } from "@/lib/api-client";
import { TraceOutcomeBadge } from "./TraceOutcomeBadge";
import { TraceExportButton } from "./TraceExportButton";

function formatDuration(ms: number | null): string {
  if (ms === null) return "pending";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function TraceDetailHeader({ trace }: { trace: TraceDetail }) {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-text-muted">
          Trace ID: {trace.id}
        </span>
        <div className="flex items-center gap-2">
          <TraceExportButton traceId={trace.id} />
          <TraceOutcomeBadge outcome={trace.final_outcome} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-text-muted">Agent:</span>{" "}
          <span className="text-text-primary">{trace.agent_name}</span>
        </div>
        <div>
          <span className="text-text-muted">Authority:</span>{" "}
          <span className="text-text-primary">{trace.authority_model}</span>
        </div>
        <div>
          <span className="text-text-muted">Operation:</span>{" "}
          <span className="font-mono text-text-primary">
            {trace.requested_operation} &rarr; {trace.target_integration}
          </span>
        </div>
        <div>
          <span className="text-text-muted">Scope:</span>{" "}
          <span className="font-mono text-text-primary">
            {trace.resource_scope}
          </span>
        </div>
        <div>
          <span className="text-text-muted">Duration:</span>{" "}
          <span className="font-mono text-text-primary">
            {formatDuration(trace.duration_ms)}
          </span>
        </div>
        <div>
          <span className="text-text-muted">Started:</span>{" "}
          <span className="font-mono text-xs text-text-muted">
            {trace.started_at}
          </span>
        </div>
        {trace.completed_at && (
          <div className="col-span-2">
            <span className="text-text-muted">Completed:</span>{" "}
            <span className="font-mono text-xs text-text-muted">
              {trace.completed_at}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
