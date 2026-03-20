"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppContext } from "@/lib/state/AppContext";
import { AuditTrace, TraceOutcome } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillFilter } from "@/components/ui/PillFilter";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import TraceTimeline from "@/components/audit/TraceTimeline";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

const OUTCOME_OPTIONS: TraceOutcome[] = [
  "pending",
  "executed",
  "completed_with_approval",
  "denied",
  "blocked",
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AuditPage() {
  const { auditTraces, auditEvents, agents, resetScenarios } = useAppContext();

  /* ---- Local state ------------------------------------------------ */
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  /* ---- Agent lookup ----------------------------------------------- */
  const agentById = useMemo(() => {
    const map = new Map<string, (typeof agents)[number]>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);

  const agentNameOptions = useMemo(
    () => agents.map((a) => a.name),
    [agents],
  );

  /* ---- Filtered traces -------------------------------------------- */
  const filteredTraces = useMemo(() => {
    let result: AuditTrace[] = auditTraces;

    if (outcomeFilter) {
      result = result.filter((t) => t.final_outcome === outcomeFilter);
    }

    if (agentFilter) {
      const matchingAgent = agents.find((a) => a.name === agentFilter);
      if (matchingAgent) {
        result = result.filter((t) => t.agent_id === matchingAgent.id);
      } else {
        result = [];
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((t) => t.trace_id.toLowerCase().includes(q));
    }

    return result;
  }, [auditTraces, outcomeFilter, agentFilter, searchQuery, agents]);

  /* ---- Auto-select first trace when filter changes ---------------- */
  useEffect(() => {
    if (filteredTraces.length === 0) {
      setSelectedTraceId(null);
      return;
    }
    const stillPresent = filteredTraces.some(
      (t) => t.trace_id === selectedTraceId,
    );
    if (!stillPresent) {
      setSelectedTraceId(filteredTraces[0].trace_id);
    }
  }, [filteredTraces, selectedTraceId]);

  /* ---- Selected trace & events ------------------------------------ */
  const selectedTrace = useMemo(
    () => filteredTraces.find((t) => t.trace_id === selectedTraceId) ?? null,
    [filteredTraces, selectedTraceId],
  );

  const traceEvents = useMemo(() => {
    if (!selectedTraceId) return [];
    return auditEvents
      .filter((e) => e.trace_id === selectedTraceId)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
  }, [auditEvents, selectedTraceId]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <PageHeader
        title="Audit"
        subtitle="Correlated traces showing policy evaluation, approval control, and final outcome for agent operations."
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <PillFilter
            label="Outcome"
            options={OUTCOME_OPTIONS}
            value={outcomeFilter}
            onChange={setOutcomeFilter}
          />
          <PillFilter
            label="Agent"
            options={agentNameOptions}
            value={agentFilter}
            onChange={setAgentFilter}
          />
          <SearchInput
            placeholder="Search trace ID..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
      </PageHeader>

      {/* Empty state */}
      {filteredTraces.length === 0 ? (
        <EmptyState
          title="No traces match the current filters"
          body="Adjust filters or reset the simulation state to view correlated operation traces."
          actionLabel="Reset scenarios"
          onAction={resetScenarios}
        />
      ) : (
        /* 3-column layout */
        <div className="flex gap-6 items-start">
          {/* ---- Left panel: Trace selector ---- */}
          <div className="w-72 shrink-0 space-y-px overflow-y-auto max-h-[calc(100vh-260px)] rounded-lg border border-white/[0.06]">
            {filteredTraces.map((trace) => {
              const isActive = trace.trace_id === selectedTraceId;
              const agent = agentById.get(trace.agent_id);
              return (
                <button
                  key={trace.trace_id}
                  onClick={() => setSelectedTraceId(trace.trace_id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${
                    isActive
                      ? "bg-white/[0.06] border-l-2 border-white/20"
                      : "hover:bg-white/[0.03] cursor-pointer border-l-2 border-transparent"
                  }`}
                >
                  <p className="font-mono text-xs text-white/40 truncate">
                    {trace.trace_id}
                  </p>
                  <p className="text-sm text-white/70 mt-1">
                    {agent?.name ?? "Unknown Agent"}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5 truncate">
                    {trace.requested_operation}
                  </p>
                  <div className="mt-2">
                    <StatusBadge
                      label={trace.final_outcome}
                      category="trace"
                      size="sm"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* ---- Center: Timeline ---- */}
          <div className="flex-1 min-w-0 overflow-y-auto max-h-[calc(100vh-260px)]">
            {selectedTrace ? (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6">
                <h2 className="text-sm font-medium text-white/60 mb-6 uppercase tracking-wide">
                  Event Timeline
                </h2>
                <TraceTimeline events={traceEvents} />
              </div>
            ) : (
              <div className="text-sm text-white/30 text-center py-16">
                Select a trace to view its timeline.
              </div>
            )}
          </div>

          {/* ---- Right panel: Trace summary card ---- */}
          <div className="w-80 shrink-0">
            {selectedTrace ? (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-5 space-y-4">
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-4">
                  Trace Summary
                </h3>

                <SummaryField
                  label="Trace ID"
                  value={selectedTrace.trace_id}
                  mono
                />
                <SummaryField
                  label="Agent"
                  value={
                    agentById.get(selectedTrace.agent_id)?.name ??
                    "Unknown Agent"
                  }
                />
                <SummaryField
                  label="Requested Operation"
                  value={selectedTrace.requested_operation}
                />
                <SummaryField
                  label="Authority Model"
                  value={formatLabel(selectedTrace.authority_model)}
                />
                <SummaryField
                  label="Target Integration"
                  value={selectedTrace.target_integration}
                />
                <SummaryField
                  label="Resource Scope"
                  value={selectedTrace.resource_scope}
                />
                <SummaryField
                  label="Started At"
                  value={formatDate(selectedTrace.started_at)}
                />

                <div>
                  <p className="text-xs text-white/30 mb-1">Final Outcome</p>
                  <StatusBadge
                    label={selectedTrace.final_outcome}
                    category="trace"
                    size="md"
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/30 text-center py-16">
                No trace selected.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary field component                                            */
/* ------------------------------------------------------------------ */

function SummaryField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-white/30">{label}</p>
      <p
        className={`text-sm text-white/70 mt-0.5 break-all ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
