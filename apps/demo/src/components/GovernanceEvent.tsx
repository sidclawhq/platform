'use client';

import { useState } from 'react';

interface GovernanceEventProps {
  trace: {
    id: string;
    requested_operation: string;
    target_integration: string;
    final_outcome: string;
    started_at: string;
    events: Array<{
      event_type: string;
      actor_name: string;
      description: string;
      timestamp: string;
    }>;
  };
}

const EVENT_STYLES: Record<string, { color: string; icon: string }> = {
  trace_initiated:            { color: '#3B82F6', icon: '\u25B6' },   // play
  identity_resolved:          { color: '#3B82F6', icon: '\u2713' },   // check
  delegation_resolved:        { color: '#3B82F6', icon: '\u2713' },
  policy_evaluated:           { color: '#A78BFA', icon: '\u2696' },   // scales
  sensitive_operation_detected:{ color: '#F59E0B', icon: '\u26A0' },  // warning
  approval_requested:         { color: '#F59E0B', icon: '\u29D7' },   // hourglass
  approval_granted:           { color: '#22C55E', icon: '\u2713' },   // check
  approval_denied:            { color: '#EF4444', icon: '\u2717' },   // cross
  approval_expired:           { color: '#71717A', icon: '\u29D6' },
  operation_allowed:          { color: '#22C55E', icon: '\u2192' },   // arrow
  operation_executed:         { color: '#22C55E', icon: '\u2713' },
  operation_failed:           { color: '#EF4444', icon: '\u2717' },
  operation_denied:           { color: '#EF4444', icon: '\u2717' },
  operation_blocked:          { color: '#EF4444', icon: '\u2718' },
  lifecycle_changed:          { color: '#3B82F6', icon: '\u21BB' },
  trace_closed:               { color: '#71717A', icon: '\u2014' },   // dash
};

const DEFAULT_EVENT_STYLE = { color: '#71717A', icon: '\u2022' };

export function GovernanceEvent({ trace }: GovernanceEventProps) {
  const [expanded, setExpanded] = useState(false);

  const outcomeStyles: Record<string, { bg: string; text: string; label: string }> = {
    executed: { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'ALLOWED' },
    completed_with_approval: { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'APPROVED' },
    blocked: { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'BLOCKED' },
    denied: { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'DENIED' },
    in_progress: { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', label: 'IN PROGRESS' },
    expired: { bg: 'bg-[#71717A]/10', text: 'text-[#71717A]', label: 'EXPIRED' },
  };

  const defaultStyle = { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', label: 'IN PROGRESS' };
  const style = outcomeStyles[trace.final_outcome] ?? defaultStyle;

  const timeDiff = () => {
    const seconds = Math.floor((Date.now() - new Date(trace.started_at).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  const formatEventType = (type: string) =>
    type.replace(/_/g, ' ');

  return (
    <div
      className="rounded-lg border border-[#2A2A2E] bg-[#111113] overflow-hidden cursor-pointer transition-colors hover:border-[#3B82F6]/30 animate-in"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
            {style.label}
          </span>
          <span className="font-mono text-base text-[#E4E4E7]">
            {trace.requested_operation}
          </span>
          <span className="text-sm text-[#71717A]">→ {trace.target_integration}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#71717A]">{timeDiff()}</span>
          <span className={`text-sm text-[#71717A] transition-transform ${expanded ? 'rotate-90' : ''}`}>
            ›
          </span>
        </div>
      </div>

      {/* Expanded timeline */}
      {expanded && trace.events && (
        <div className="border-t border-[#2A2A2E] bg-[#0D0D0E] px-4 py-4">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#2A2A2E]" />

            <div className="space-y-0">
              {trace.events.map((event, i) => {
                const es = EVENT_STYLES[event.event_type] ?? DEFAULT_EVENT_STYLE;
                const isLast = i === trace.events.length - 1;

                return (
                  <div key={i} className={`relative flex items-start gap-3 ${isLast ? '' : 'pb-4'}`}>
                    {/* Node */}
                    <div
                      className="relative z-10 flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-full text-[9px]"
                      style={{ backgroundColor: `${es.color}20`, color: es.color }}
                    >
                      {es.icon}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 pt-px">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider"
                          style={{ backgroundColor: `${es.color}15`, color: es.color }}
                        >
                          {formatEventType(event.event_type)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[#A1A1AA]">
                        {event.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trace ID footer */}
          <div className="mt-3 border-t border-[#2A2A2E] pt-2">
            <span className="font-mono text-xs text-[#52525B]">
              trace:{trace.id.substring(0, 8)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
