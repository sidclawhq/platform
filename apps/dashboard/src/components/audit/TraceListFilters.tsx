"use client";

import { Search } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";
import { TraceBulkExportButton } from "./TraceBulkExportButton";

const outcomeOptions = [
  { value: "", label: "All outcomes" },
  { value: "in_progress", label: "In Progress" },
  { value: "executed", label: "Executed" },
  { value: "completed_with_approval", label: "Approved" },
  { value: "blocked", label: "Blocked" },
  { value: "denied", label: "Denied" },
  { value: "expired", label: "Expired" },
];

export function TraceListFilters({
  agents,
  selectedAgent,
  selectedOutcome,
  searchQuery,
  dateFrom,
  dateTo,
  onAgentChange,
  onOutcomeChange,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
}: {
  agents: { id: string; name: string }[];
  selectedAgent: string;
  selectedOutcome: string;
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  onAgentChange: (agentId: string) => void;
  onOutcomeChange: (outcome: string) => void;
  onSearchChange: (query: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-3">
      <div className="flex gap-2">
        <select
          value={selectedAgent}
          onChange={(e) => onAgentChange(e.target.value)}
          className="h-8 flex-1 rounded-md border border-border bg-surface-0 px-2 text-[13px] text-text-primary outline-none focus:ring-1 focus:ring-accent-blue"
        >
          <option value="">All agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>

        <select
          value={selectedOutcome}
          onChange={(e) => onOutcomeChange(e.target.value)}
          className="h-8 flex-1 rounded-md border border-border bg-surface-0 px-2 text-[13px] text-text-primary outline-none focus:ring-1 focus:ring-accent-blue"
        >
          {outcomeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={onDateFromChange}
          onToChange={onDateToChange}
        />
        <TraceBulkExportButton />
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          placeholder="Search trace ID..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-surface-0 pl-8 pr-2 text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:ring-1 focus:ring-accent-blue"
        />
      </div>
    </div>
  );
}
