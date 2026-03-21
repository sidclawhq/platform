"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TraceEvent } from "@/lib/api-client";

type EventCategory = "system" | "policy" | "approval" | "execution_success" | "execution_failure" | "lifecycle";

function getEventCategory(eventType: string): EventCategory {
  if (
    ["trace_initiated", "identity_resolved", "trace_closed"].includes(eventType)
  ) {
    return "system";
  }
  if (
    [
      "policy_evaluated",
      "sensitive_operation_detected",
      "operation_allowed",
      "operation_denied",
      "operation_blocked",
    ].includes(eventType)
  ) {
    return "policy";
  }
  if (
    [
      "approval_requested",
      "approval_granted",
      "approval_denied",
      "approval_expired",
    ].includes(eventType)
  ) {
    return "approval";
  }
  if (eventType === "operation_executed") return "execution_success";
  if (eventType === "operation_failed") return "execution_failure";
  if (eventType === "lifecycle_changed") return "lifecycle";
  return "system";
}

const dotColorMap: Record<EventCategory, string> = {
  system: "bg-text-muted",
  policy: "bg-accent-blue",
  approval: "bg-accent-amber",
  execution_success: "bg-accent-green",
  execution_failure: "bg-accent-red",
  lifecycle: "bg-accent-amber",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function formatEventType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function hasExpandableContent(event: TraceEvent): boolean {
  return (
    (event.metadata != null && Object.keys(event.metadata).length > 0) ||
    event.policy_version != null ||
    event.approval_request_id != null
  );
}

export function TraceEventRow({
  event,
  isLast,
}: {
  event: TraceEvent;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const category = getEventCategory(event.event_type);
  const dotColor = dotColorMap[category];
  const expandable = hasExpandableContent(event);

  return (
    <div className="relative flex gap-4">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div className={cn("h-3 w-3 shrink-0 rounded-full", dotColor)} />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
        <button
          type="button"
          onClick={() => expandable && setExpanded(!expanded)}
          className={cn(
            "flex w-full items-start justify-between gap-4 text-left",
            expandable && "cursor-pointer",
          )}
        >
          <span className="text-sm font-medium text-text-primary">
            {formatEventType(event.event_type)}
          </span>
          <span className="shrink-0 font-mono text-xs text-text-muted">
            {formatTimestamp(event.timestamp)}
          </span>
        </button>

        <p className="mt-0.5 text-sm text-text-secondary">
          {event.description}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="text-xs text-text-muted">
            Actor: {event.actor_name} ({event.actor_type.replace(/_/g, " ")})
          </span>
          {event.policy_version != null && (
            <span className="font-mono text-xs text-text-muted">
              Policy v{event.policy_version}
            </span>
          )}
        </div>

        {event.approval_request_id && !expanded && (
          <Link
            href="/dashboard/approvals"
            className="mt-1 inline-block text-xs text-accent-blue hover:underline"
          >
            View approval &rarr;
          </Link>
        )}

        {/* Expandable detail section */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-200",
            expanded ? "mt-2 max-h-96" : "max-h-0",
          )}
        >
          <div className="rounded-md border border-border bg-surface-1 p-3">
            {event.policy_version != null && (
              <div className="mb-2 text-xs text-text-secondary">
                <span className="text-text-muted">Policy version:</span>{" "}
                <span className="font-mono">{event.policy_version}</span>
              </div>
            )}
            {event.approval_request_id && (
              <div className="mb-2 text-xs text-text-secondary">
                <span className="text-text-muted">Approval request:</span>{" "}
                <span className="font-mono">{event.approval_request_id}</span>
              </div>
            )}
            {event.metadata != null &&
              Object.keys(event.metadata).length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-text-muted">Metadata:</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-text-secondary">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
