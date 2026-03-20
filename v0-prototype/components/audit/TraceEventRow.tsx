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
    <div className="rounded border border-border bg-surface-1 p-3 transition-colors hover:border-muted-foreground/20">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="font-mono-trace text-[12px] text-muted-foreground">
        {formatTime(event.timestamp)}
        </p>
        <span
          className={`text-[11px] font-medium ${
            event.status.toLowerCase() === "pending"
              ? "text-status-pending"
              : "text-muted-foreground"
          }`}
        >
          {event.status}
        </span>
      </div>
      <p className="text-[13px] font-medium text-foreground">
        {formatEventType(event.event_type)}
      </p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        {formatActorType(event.actor_type)} &middot; {event.actor_name}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-secondary-foreground">
        {event.description}
      </p>
      {event.policy_version !== null && (
        <p className="mt-1 font-mono-trace text-[11px] text-muted-foreground">
          Policy {event.policy_version}
        </p>
      )}
    </div>
  );
}
