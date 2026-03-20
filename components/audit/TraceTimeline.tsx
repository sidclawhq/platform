import { AuditEvent } from '@/lib/types';
import { EventType } from '@/lib/types';
import TraceEventRow from './TraceEventRow';

interface TraceTimelineProps {
  events: AuditEvent[];
}

function getNodeColor(eventType: EventType): string {
  switch (eventType) {
    case 'approval_granted':
    case 'approval_denied':
      return 'bg-amber-400';
    case 'operation_executed':
      return 'bg-emerald-400';
    case 'operation_blocked':
      return 'bg-red-400';
    case 'trace_closed':
      return 'bg-white/30';
    default:
      return 'bg-white/20';
  }
}

export default function TraceTimeline({ events }: TraceTimelineProps) {
  return (
    <div className="relative pl-8">
      {/* Vertical spine line */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-white/[0.08]" />

      {events.map((event) => (
        <div key={event.id} className="relative py-4">
          {/* Node circle */}
          <div className="absolute left-0 w-[23px] flex items-center justify-center">
            <div
              className={`w-2.5 h-2.5 rounded-full ${getNodeColor(event.event_type)}`}
            />
          </div>

          {/* Event content */}
          <TraceEventRow event={event} />
        </div>
      ))}
    </div>
  );
}
