"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { TraceSummary } from "@/lib/api-client";
import { TraceListFilters } from "./TraceListFilters";
import { TraceListItem } from "./TraceListItem";

export function TraceList({
  selectedTraceId,
  onSelectTrace,
}: {
  selectedTraceId: string | null;
  onSelectTrace: (id: string) => void;
}) {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchTraces = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listTraces({
        agent_id: selectedAgent || undefined,
        outcome: selectedOutcome || undefined,
        from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        to: dateTo ? new Date(dateTo + "T23:59:59.999Z").toISOString() : undefined,
        limit: 100,
      });
      setTraces(result.data);
      setTotal(result.pagination.total);
    } catch {
      setTraces([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, selectedOutcome, dateFrom, dateTo]);

  useEffect(() => {
    fetchTraces();
  }, [fetchTraces]);

  // Derive unique agents from loaded traces for the filter dropdown
  const agents = useMemo(() => {
    const map = new Map<string, string>();
    for (const trace of traces) {
      if (!map.has(trace.agent_id)) {
        map.set(trace.agent_id, trace.agent_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [traces]);

  // Client-side trace ID prefix search
  const filteredTraces = useMemo(() => {
    if (!searchQuery) return traces;
    const q = searchQuery.toLowerCase();
    return traces.filter((t) => t.id.toLowerCase().startsWith(q));
  }, [traces, searchQuery]);

  return (
    <div data-testid="trace-list" className="flex h-full flex-col">
      <TraceListFilters
        agents={agents}
        selectedAgent={selectedAgent}
        selectedOutcome={selectedOutcome}
        searchQuery={searchQuery}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onAgentChange={setSelectedAgent}
        onOutcomeChange={setSelectedOutcome}
        onSearchChange={setSearchQuery}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-text-muted">Loading traces...</p>
          </div>
        ) : filteredTraces.length === 0 ? (
          <div className="flex items-center justify-center py-12 px-4">
            <p className="text-center text-sm text-text-muted">
              {total === 0
                ? "No traces recorded yet. Traces appear when agents are evaluated via the SDK."
                : "No traces match the current filters."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {filteredTraces.map((trace) => (
              <TraceListItem
                key={trace.id}
                trace={trace}
                selected={trace.id === selectedTraceId}
                onSelect={() => onSelectTrace(trace.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
