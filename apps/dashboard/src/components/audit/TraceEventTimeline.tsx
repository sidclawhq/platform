"use client";

import type { TraceEvent } from "@/lib/api-client";
import { TraceEventRow } from "./TraceEventRow";

export function TraceEventTimeline({ events }: { events: TraceEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-text-muted">No events recorded for this trace.</p>
    );
  }

  return (
    <div data-testid="event-timeline" className="space-y-0">
      {events.map((event, idx) => (
        <TraceEventRow
          key={event.id}
          event={event}
          isLast={idx === events.length - 1}
        />
      ))}
    </div>
  );
}
