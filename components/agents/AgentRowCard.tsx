"use client";

import { Agent } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChevronRight } from "lucide-react";

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
    <button
      className="group w-full cursor-pointer rounded-lg border border-border bg-surface-1 p-4 text-left transition-all hover:border-muted-foreground/20 hover:bg-surface-2 active:scale-[0.995]"
      onClick={() => onClick(agent.id)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-medium text-foreground">
              {agent.name}
            </h3>
            <StatusBadge label={agent.lifecycle_state} category="lifecycle" />
            <StatusBadge label={agent.autonomy_tier} category="autonomy" />
            <StatusBadge label={agent.authority_model} category="authority" />
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {agent.description}
          </p>
        </div>

        <ChevronRight className="mt-1 hidden h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 lg:block" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-muted-foreground">
        <span>
          Owner: <span className="text-secondary-foreground">{agent.owner_name}</span>
        </span>
        <span>
          Team: <span className="text-secondary-foreground">{agent.team}</span>
        </span>
        <span>
          Environment:{" "}
          <span className="text-secondary-foreground">
            {agent.environment === "prod" ? "Production" : formatLabel(agent.environment)}
          </span>
        </span>
        <span>
          Integrations:{" "}
          <span className="text-secondary-foreground">
            {agent.authorized_integrations.length}
          </span>
        </span>
        <span>
          Next review:{" "}
          <span className="text-secondary-foreground">{formatDate(agent.next_review_date)}</span>
        </span>
        <span className="text-muted-foreground/70">{agent.recent_activity_state}</span>
      </div>
    </button>
  );
}
