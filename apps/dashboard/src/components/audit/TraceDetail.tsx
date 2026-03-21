"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { TraceDetail as TraceDetailType } from "@/lib/api-client";
import { TraceDetailHeader } from "./TraceDetailHeader";
import { TraceEventTimeline } from "./TraceEventTimeline";

export function TraceDetail({ traceId }: { traceId: string | null }) {
  const [trace, setTrace] = useState<TraceDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!traceId) {
      setTrace(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getTrace(traceId)
      .then((data) => {
        if (!cancelled) setTrace(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load trace");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [traceId]);

  if (!traceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">
          Select a trace to view its timeline.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">Loading trace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-accent-red">{error}</p>
      </div>
    );
  }

  if (!trace) return null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <TraceDetailHeader trace={trace} />
      <div>
        <h3 className="mb-4 text-sm font-medium text-text-primary">
          Event Timeline
        </h3>
        <TraceEventTimeline events={trace.events} />
      </div>
    </div>
  );
}
