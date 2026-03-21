import { cn } from '@/lib/utils';

interface TraceEvent {
  id: string;
  event_type: string;
  actor_type: string;
  actor_name: string;
  description: string;
  status: string;
  timestamp: string;
}

const eventTypeColors: Record<string, string> = {
  // Policy events — blue
  policy_evaluated: 'bg-accent-blue',
  sensitive_operation_detected: 'bg-accent-blue',
  // Approval events — amber
  approval_required: 'bg-accent-amber',
  approval_requested: 'bg-accent-amber',
  // Execution/success events — green
  approval_granted: 'bg-accent-green',
  operation_executed: 'bg-accent-green',
  trace_initiated: 'bg-accent-green',
  identity_resolved: 'bg-accent-green',
  delegation_resolved: 'bg-accent-green',
  trace_closed: 'bg-accent-green',
  // Denial events — red
  approval_denied: 'bg-accent-red',
  operation_blocked: 'bg-accent-red',
};

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function ApprovalTraceEvents({ events }: { events: TraceEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-text-muted">No trace events recorded.</p>
    );
  }

  return (
    <div className="relative pl-4">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />

      <div className="flex flex-col gap-3">
        {events.map((event) => (
          <div key={event.id} className="relative flex items-start gap-3">
            {/* Dot */}
            <div
              className={cn(
                'relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                eventTypeColors[event.event_type] ?? 'bg-surface-2',
              )}
            />

            {/* Content */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-muted">
                  {formatTimestamp(event.timestamp)}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {formatEventType(event.event_type)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                {event.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
