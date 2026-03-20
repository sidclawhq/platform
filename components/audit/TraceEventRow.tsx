import { AuditEvent } from '@/lib/types';

interface TraceEventRowProps {
  event: AuditEvent;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toISOString().slice(11, 19);
}

function formatEventType(eventType: string): string {
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatActorType(actorType: string): string {
  return actorType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function TraceEventRow({ event }: TraceEventRowProps) {
  return (
    <div>
      <p className="text-xs text-white/40 font-mono-trace">
        {formatTime(event.timestamp)}
      </p>
      <p className="text-sm font-medium text-white/70 mt-0.5">
        {formatEventType(event.event_type)}
      </p>
      <p className="text-xs text-white/40 mt-0.5">
        {formatActorType(event.actor_type)} &middot; {event.actor_name}
      </p>
      <p className="text-sm text-white/60 mt-1 leading-relaxed">
        {event.description}
      </p>
      {event.policy_version !== null && (
        <p className="text-xs text-white/30 mt-1">
          Policy {event.policy_version}
        </p>
      )}
    </div>
  );
}
