"use client";

import { useEffect, useMemo, useState } from "react";
import TraceTimeline from "@/components/audit/TraceTimeline";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillFilter } from "@/components/ui/PillFilter";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAppContext } from "@/lib/state/AppContext";
import type { AuditTrace, TraceOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const OUTCOME_OPTIONS: TraceOutcome[] = [
  "pending",
  "executed",
  "completed_with_approval",
  "denied",
  "blocked",
];

function TraceSummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("text-right text-[13px] text-foreground", mono && "font-mono-trace")}>
        {value}
      </span>
    </div>
  );
}

export default function AuditPage() {
  const { auditTraces, auditEvents, agents, resetScenarios } = useAppContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  const agentById = useMemo(() => {
    const map = new Map<string, (typeof agents)[number]>();
    agents.forEach((agent) => map.set(agent.id, agent));
    return map;
  }, [agents]);

  const agentNames = useMemo(() => agents.map((agent) => agent.name), [agents]);

  const filteredTraces = useMemo(() => {
    let result: AuditTrace[] = auditTraces;

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (trace) =>
          trace.trace_id.toLowerCase().includes(query) ||
          trace.requested_operation.toLowerCase().includes(query)
      );
    }

    if (outcomeFilter) {
      result = result.filter((trace) => trace.final_outcome === outcomeFilter);
    }

    if (agentFilter) {
      const selectedAgent = agents.find((agent) => agent.name === agentFilter);
      result = selectedAgent
        ? result.filter((trace) => trace.agent_id === selectedAgent.id)
        : [];
    }

    return result;
  }, [agentFilter, agents, auditTraces, outcomeFilter, searchQuery]);

  useEffect(() => {
    if (filteredTraces.length === 0) {
      setSelectedTraceId(null);
      return;
    }

    if (!filteredTraces.some((trace) => trace.trace_id === selectedTraceId)) {
      setSelectedTraceId(filteredTraces[0].trace_id);
    }
  }, [filteredTraces, selectedTraceId]);

  const selectedTrace =
    filteredTraces.find((trace) => trace.trace_id === selectedTraceId) ?? null;

  const traceEvents = useMemo(() => {
    if (!selectedTraceId) return [];
    return auditEvents
      .filter((event) => event.trace_id === selectedTraceId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [auditEvents, selectedTraceId]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Audit"
        subtitle="Correlated traces showing policy evaluation, approval control, and final outcome for agent operations."
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Search by trace ID or operation"
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-64"
          />
          <PillFilter
            label="Outcome"
            options={OUTCOME_OPTIONS}
            value={outcomeFilter}
            onChange={setOutcomeFilter}
          />
          <PillFilter
            label="Agent"
            options={agentNames}
            value={agentFilter}
            onChange={setAgentFilter}
          />
        </div>
      </PageHeader>

      {filteredTraces.length === 0 ? (
        <EmptyState
          title="No traces match the current filters"
          body="Adjust filters or reset the simulation state to view correlated operation traces."
          actionLabel="Reset scenarios"
          onAction={resetScenarios}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-1.5 xl:col-span-4">
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Traces
            </h3>
            {filteredTraces.map((trace) => {
              const agent = agentById.get(trace.agent_id);
              const isSelected = trace.trace_id === selectedTraceId;

              return (
                <button
                  key={trace.trace_id}
                  onClick={() => setSelectedTraceId(trace.trace_id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-all active:scale-[0.98]",
                    isSelected
                      ? "border-muted-foreground/30 bg-surface-2"
                      : "border-border bg-surface-1 hover:border-muted-foreground/20 hover:bg-surface-2"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-mono-trace text-[12px] font-medium text-foreground">
                      {trace.trace_id}
                    </span>
                    <StatusBadge label={trace.final_outcome} category="trace" />
                  </div>
                  <p className="text-[12px] text-muted-foreground">{trace.requested_operation}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">{agent?.name}</p>
                </button>
              );
            })}
          </div>

          <div className="xl:col-span-8">
            {selectedTrace ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="xl:col-span-3">
                  <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Event timeline
                  </h3>
                  <TraceTimeline events={traceEvents} />
                </div>

                <div className="xl:col-span-2">
                  <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Trace summary
                  </h3>
                  <div className="space-y-2 rounded-lg border border-border bg-surface-1 p-4">
                    <TraceSummaryRow label="Trace ID" value={selectedTrace.trace_id} mono />
                    <TraceSummaryRow
                      label="Agent"
                      value={agentById.get(selectedTrace.agent_id)?.name ?? selectedTrace.agent_id}
                    />
                    <TraceSummaryRow
                      label="Operation"
                      value={selectedTrace.requested_operation}
                    />
                    <TraceSummaryRow
                      label="Authority model"
                      value={formatLabel(selectedTrace.authority_model)}
                    />
                    <TraceSummaryRow
                      label="Integration"
                      value={selectedTrace.target_integration}
                    />
                    <TraceSummaryRow label="Scope" value={selectedTrace.resource_scope} />
                    <TraceSummaryRow label="Started" value={formatDate(selectedTrace.started_at)} />
                    <TraceSummaryRow
                      label="Completed"
                      value={selectedTrace.completed_at ? formatDate(selectedTrace.completed_at) : "In progress"}
                    />
                    <div className="border-t border-border pt-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12px] text-muted-foreground">Final outcome</span>
                        <StatusBadge label={selectedTrace.final_outcome} category="trace" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a trace to view its timeline.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
