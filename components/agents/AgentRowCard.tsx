"use client";

import { Agent } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface AgentRowCardProps {
  agent: Agent;
  onClick: (id: string) => void;
}

function formatLabel(s: string): string {
  return s
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function AgentRowCard({ agent, onClick }: AgentRowCardProps) {
  return (
    <div
      className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
      onClick={() => onClick(agent.id)}
    >
      <div className="flex items-center gap-6">
        {/* Zone 1 — Left: Name & description */}
        <div className="flex-1 min-w-0">
          <div className="text-base font-medium text-white/90 truncate">
            {agent.name}
          </div>
          <div className="text-sm text-white/50 mt-0.5 truncate">
            {agent.description}
          </div>
        </div>

        {/* Zone 2 — Middle: Metadata grid */}
        <div className="w-64 shrink-0 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <span className="text-white/30">Owner</span>
          <span className="text-white/60">{agent.owner_name}</span>
          <span className="text-white/30">Team</span>
          <span className="text-white/60">{agent.team}</span>
          <span className="text-white/30">Environment</span>
          <span className="text-white/60">
            {formatLabel(agent.environment)}
          </span>
          <span className="text-white/30">Authority</span>
          <span className="text-white/60">
            {formatLabel(agent.authority_model)}
          </span>
        </div>

        {/* Zone 3 — Right metadata: Status, autonomy, review date */}
        <div className="w-48 shrink-0 flex flex-col items-end gap-1.5">
          <StatusBadge label={agent.lifecycle_state} category="lifecycle" />
          <span className="text-xs text-white/40">
            {formatLabel(agent.autonomy_tier)} autonomy
          </span>
          <span className="text-xs text-white/30">
            Review: {formatDate(agent.next_review_date)}
          </span>
        </div>

        {/* Zone 4 — Far right: Chevron */}
        <div className="w-8 flex items-center justify-center">
          <span className="text-white/20 text-lg">&rarr;</span>
        </div>
      </div>
    </div>
  );
}
