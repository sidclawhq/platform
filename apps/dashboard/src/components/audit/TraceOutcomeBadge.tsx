"use client";

import { cn } from "@/lib/utils";

const outcomeConfig: Record<
  string,
  { label: string; bg: string; text: string; dot?: string }
> = {
  in_progress: {
    label: "In Progress",
    bg: "bg-amber-500/10",
    text: "text-[#F59E0B]",
  },
  executed: {
    label: "Executed",
    bg: "bg-green-500/10",
    text: "text-[#22C55E]",
  },
  completed_with_approval: {
    label: "Approved",
    bg: "bg-green-500/10",
    text: "text-[#22C55E]",
    dot: "bg-[#F59E0B]",
  },
  blocked: {
    label: "Blocked",
    bg: "bg-red-500/10",
    text: "text-[#EF4444]",
  },
  denied: {
    label: "Denied",
    bg: "bg-red-500/10",
    text: "text-[#EF4444]",
  },
  expired: {
    label: "Expired",
    bg: "bg-zinc-500/10",
    text: "text-[#71717A]",
  },
};

export function TraceOutcomeBadge({ outcome }: { outcome: string }) {
  const config = outcomeConfig[outcome] ?? {
    label: outcome,
    bg: "bg-zinc-500/10",
    text: "text-text-muted",
  };

  return (
    <span
      data-testid="outcome-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        config.bg,
        config.text
      )}
    >
      {config.label}
      {config.dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      )}
    </span>
  );
}
