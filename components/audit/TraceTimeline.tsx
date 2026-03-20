import { AuditEvent } from '@/lib/types';
import { EventType } from '@/lib/types';
import TraceEventRow from './TraceEventRow';
import { cn } from "@/lib/utils";

interface TraceTimelineProps {
  events: AuditEvent[];
}

function getNodeColor(eventType: EventType): string {
  switch (eventType) {
    case 'approval_granted':
    case 'approval_denied':
      return 'border-status-approval bg-status-approval/20';
    case 'operation_executed':
      return 'border-status-executed bg-status-executed/20';
    case 'operation_blocked':
      return 'border-status-blocked bg-status-blocked/20';
    case 'trace_closed':
      return 'border-muted-foreground bg-surface-2';
    default:
      return 'border-border bg-surface-2';
  }
}

export default function TraceTimeline({ events }: TraceTimelineProps) {
  return (
    <div className="relative pl-6">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-border" />

      {events.map((event) => (
        <div key={event.id} className="relative pb-4">
          <div className="absolute left-0 top-1.5 z-10">
            <div
              className={cn(
                "h-[15px] w-[15px] rounded-full border-2",
                getNodeColor(event.event_type)
              )}
            />
          </div>
          <TraceEventRow event={event} />
        </div>
      ))}
    </div>
  );
}
