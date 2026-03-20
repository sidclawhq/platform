"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/lib/state";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillFilter } from "@/components/ui/PillFilter";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueueItemCard } from "@/components/approvals/QueueItemCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import SlideOverPanel from "@/components/layout/SlideOverPanel";
import type { ApprovalRequest, Agent, PolicyRule } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

function resolveAgent(agents: Agent[], agentId: string): Agent | undefined {
  return agents.find((a) => a.id === agentId);
}

function resolvePolicy(
  policies: PolicyRule[],
  request: ApprovalRequest
): PolicyRule | undefined {
  // Best match: same agent, approval_required effect, same integration
  return policies.find(
    (p) =>
      p.agent_id === request.agent_id &&
      p.policy_effect === "approval_required" &&
      p.authorized_integration === request.target_integration
  );
}

/* ------------------------------------------------------------------ */
/*  Detail section components                                          */
/* ------------------------------------------------------------------ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs uppercase tracking-wide text-white/30 mb-3">
      {children}
    </h3>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-sm text-white/40 shrink-0">{label}</span>
      <span className="text-sm text-white/80 text-right ml-4">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Approval Detail Panel (rendered inside SlideOverPanel)             */
/* ------------------------------------------------------------------ */

interface ApprovalDetailProps {
  request: ApprovalRequest;
  agent: Agent | undefined;
  policy: PolicyRule | undefined;
  onClose: () => void;
  onApprove: () => void;
  onDeny: () => void;
}

function ApprovalDetail({
  request,
  agent,
  policy,
  onClose,
  onApprove,
  onDeny,
}: ApprovalDetailProps) {
  const agentName = agent?.name ?? "Unknown Agent";
  const ownerName = request.delegated_from ?? agent?.owner_name ?? "—";

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start pb-4 border-b border-white/[0.06]">
        <div>
          <div className="text-lg font-medium text-white/90">
            {request.requested_operation}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <StatusBadge category="approval" label={request.status} />
            <span className="font-mono text-xs text-white/30">
              {request.trace_id}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/70 cursor-pointer text-xl leading-none transition-colors"
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>

      {/* ── Section A — Request Summary ────────────────────────────── */}
      <div className="mt-6">
        <SectionTitle>Request Summary</SectionTitle>
        <div className="divide-y divide-white/[0.04]">
          <DataRow label="Agent" value={agentName} />
          <DataRow label="Owner" value={ownerName} />
          <DataRow
            label="Environment"
            value={agent ? formatLabel(agent.environment) : "—"}
          />
          <DataRow
            label="Requested operation"
            value={request.requested_operation}
          />
          <DataRow
            label="Target integration"
            value={request.target_integration}
          />
          <DataRow
            label="Requested at"
            value={formatDate(request.requested_at)}
          />
        </div>
      </div>

      {/* ── Section B — Authority Context ──────────────────────────── */}
      <div className="mt-6">
        <SectionTitle>Authority Context</SectionTitle>
        <div className="divide-y divide-white/[0.04]">
          <DataRow
            label="Authority model"
            value={formatLabel(request.authority_model)}
          />
          <DataRow
            label="Identity mode"
            value={agent ? formatLabel(agent.identity_mode) : "—"}
          />
          <DataRow
            label="Delegated from"
            value={request.delegated_from ?? "None (self-authority)"}
          />
          <DataRow
            label="Separation of duties"
            value={formatLabel(request.separation_of_duties_check)}
          />
        </div>
      </div>

      {/* ── Section C — Why This Was Flagged ───────────────────────── */}
      <div className="mt-6">
        <div className="bg-amber-500/[0.04] border-l-2 border-amber-500/30 rounded-r-md p-5">
          <h3 className="text-xs uppercase tracking-wide text-amber-400/80 font-medium mb-3">
            Why this was flagged
          </h3>
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-white/40 shrink-0">
                Policy effect
              </span>
              <StatusBadge
                category="policy"
                label={request.policy_effect}
              />
            </div>
            {policy && (
              <div className="flex items-baseline gap-3">
                <span className="text-sm text-white/40 shrink-0">
                  Governing policy
                </span>
                <span className="text-sm text-white/80">
                  {policy.policy_name}
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-white/40 shrink-0">
                Data classification
              </span>
              <span className="text-sm text-white/80">
                {formatLabel(request.data_classification)}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-white/40 shrink-0">
                Resource scope
              </span>
              <span className="text-sm text-white/80">
                {request.resource_scope}
              </span>
            </div>
          </div>
          <p className="text-sm text-white/70 leading-relaxed mt-3">
            {request.flag_reason}
            {policy?.rationale && (
              <>
                {" "}
                <span className="text-white/50">{policy.rationale}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── Section D — Requested Context ──────────────────────────── */}
      <div className="mt-6">
        <SectionTitle>Requested Context</SectionTitle>
        <div className="space-y-3 text-sm text-white/70 leading-relaxed">
          <div>
            <span className="text-white/40 text-xs uppercase tracking-wide">
              Trigger
            </span>
            <p className="mt-1">
              Agent-initiated operation under{" "}
              {formatLabel(request.authority_model).toLowerCase()} authority.
            </p>
          </div>
          <div>
            <span className="text-white/40 text-xs uppercase tracking-wide">
              Context
            </span>
            <p className="mt-1">
              The agent prepared {request.requested_operation.toLowerCase()}{" "}
              using {formatLabel(request.data_classification).toLowerCase()}{" "}
              context and requested execution through{" "}
              {request.target_integration}.
            </p>
          </div>
          <div>
            <span className="text-white/40 text-xs uppercase tracking-wide">
              Impact
            </span>
            <p className="mt-1">
              Operation will execute {request.requested_operation.toLowerCase()}{" "}
              within the scope of {request.resource_scope.toLowerCase()}.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section E — Reviewer Action ────────────────────────────── */}
      <div className="mt-6 pt-4 border-t border-white/[0.06]">
        {request.status === "pending" ? (
          <div className="flex gap-3">
            <button
              onClick={onApprove}
              className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/30 px-5 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
            >
              Approve
            </button>
            <button
              onClick={onDeny}
              className="bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600/30 px-5 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
            >
              Deny
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <StatusBadge
              category="approval"
              label={request.status}
              size="md"
            />
            <span className="text-sm text-white/60">
              {request.status === "approved"
                ? "Operation approved and recorded in trace."
                : "Operation denied and recorded in trace."}
            </span>
          </div>
        )}
      </div>

      {/* ── Section F — Governance Metadata ────────────────────────── */}
      {policy && (
        <div className="mt-6">
          <SectionTitle>Governance Metadata</SectionTitle>
          <div className="space-y-1 text-xs text-white/30">
            <div>
              Policy version: {policy.policy_version}
            </div>
            <div>
              Modified by: {policy.modified_by}
            </div>
            <div>
              Last modified at: {formatDate(policy.modified_at)}
            </div>
            <div className="mt-2 text-white/20 italic">
              Owner cannot self-approve sensitive operations.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ApprovalsPage() {
  const {
    approvalRequests,
    agents,
    policyRules,
    approveRequest,
    denyRequest,
    resetScenarios,
  } = useAppContext();

  /* ---- Local filter state ---------------------------------------- */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");

  /* ---- Slide-over state ------------------------------------------ */
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );

  /* ---- Derived data ---------------------------------------------- */
  const agentNames = useMemo(
    () => agents.map((a) => a.name),
    [agents]
  );

  const agentNameToId = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((a) => map.set(a.name, a.id));
    return map;
  }, [agents]);

  const agentIdToName = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [agents]);

  /* ---- Filtering ------------------------------------------------- */
  const filteredRequests = useMemo(() => {
    let result = approvalRequests;

    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (agentFilter) {
      const agentId = agentNameToId.get(agentFilter);
      if (agentId) {
        result = result.filter((r) => r.agent_id === agentId);
      }
    }

    if (classificationFilter) {
      result = result.filter(
        (r) => r.data_classification === classificationFilter
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.requested_operation.toLowerCase().includes(q) ||
          r.trace_id.toLowerCase().includes(q)
      );
    }

    return result;
  }, [
    approvalRequests,
    statusFilter,
    agentFilter,
    classificationFilter,
    searchQuery,
    agentNameToId,
  ]);

  /* ---- Selected request lookups ---------------------------------- */
  const selectedRequest = useMemo(
    () => approvalRequests.find((r) => r.id === selectedRequestId) ?? null,
    [approvalRequests, selectedRequestId]
  );

  const selectedAgent = useMemo(
    () =>
      selectedRequest
        ? resolveAgent(agents, selectedRequest.agent_id)
        : undefined,
    [agents, selectedRequest]
  );

  const selectedPolicy = useMemo(
    () =>
      selectedRequest
        ? resolvePolicy(policyRules, selectedRequest)
        : undefined,
    [policyRules, selectedRequest]
  );

  /* ---- Handlers -------------------------------------------------- */
  const handleReview = useCallback((id: string) => {
    setSelectedRequestId(id);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedRequestId(null);
  }, []);

  const handleApprove = useCallback(() => {
    if (!selectedRequestId) return;
    approveRequest(selectedRequestId);
    toast.success(
      "Approval recorded. Operation executed and trace updated."
    );
  }, [selectedRequestId, approveRequest]);

  const handleDeny = useCallback(() => {
    if (!selectedRequestId) return;
    denyRequest(selectedRequestId);
    toast.success("Denial recorded. Operation blocked and trace updated.");
  }, [selectedRequestId, denyRequest]);

  /* ---- Render ---------------------------------------------------- */
  return (
    <>
      <PageHeader
        title="Approval Queue"
        subtitle="Sensitive agent operations requiring human review before execution."
      >
        <div className="flex flex-wrap items-center gap-4">
          <PillFilter
            label="Status"
            options={["pending", "approved", "denied"]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <PillFilter
            label="Agent"
            options={agentNames}
            value={agentFilter}
            onChange={setAgentFilter}
          />
          <PillFilter
            label="Classification"
            options={["public", "internal", "confidential", "restricted"]}
            value={classificationFilter}
            onChange={setClassificationFilter}
          />
          <SearchInput
            placeholder="Search by trace ID or operation..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
      </PageHeader>

      {filteredRequests.length === 0 ? (
        <EmptyState
          title="No actions are waiting for review"
          body="All approval-required operations have been resolved in the current simulation state."
          actionLabel="Reset scenarios"
          onAction={resetScenarios}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filteredRequests.map((request) => (
            <QueueItemCard
              key={request.id}
              approvalRequest={request}
              agentName={agentIdToName.get(request.agent_id) ?? "Unknown Agent"}
              onReview={handleReview}
            />
          ))}
        </div>
      )}

      {/* ── Slide-over detail panel ─────────────────────────────── */}
      <SlideOverPanel
        isOpen={selectedRequestId !== null}
        onClose={handleClosePanel}
      >
        {selectedRequest ? (
          <ApprovalDetail
            request={selectedRequest}
            agent={selectedAgent}
            policy={selectedPolicy}
            onClose={handleClosePanel}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        ) : (
          <div className="p-6 text-white/40 text-sm">No request selected.</div>
        )}
      </SlideOverPanel>
    </>
  );
}
