"use client";

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import SlideOverPanel from "@/components/layout/SlideOverPanel";
import { QueueItemCard } from "@/components/approvals/QueueItemCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillFilter } from "@/components/ui/PillFilter";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAppContext } from "@/lib/state";
import type { Agent, ApprovalRequest, PolicyRule } from "@/lib/types";

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveAgent(agents: Agent[], agentId: string) {
  return agents.find((agent) => agent.id === agentId);
}

function resolvePolicy(policies: PolicyRule[], request: ApprovalRequest) {
  return policies.find(
    (policy) =>
      policy.agent_id === request.agent_id &&
      policy.policy_effect === "approval_required" &&
      policy.authorized_integration === request.target_integration
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function DetailGrid({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="space-y-1">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-1.5">
          <span className="shrink-0 text-[12px] text-muted-foreground">{label}</span>
          <span className="text-right text-[13px] text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

interface ApprovalDetailProps {
  request: ApprovalRequest;
  agent?: Agent;
  policy?: PolicyRule;
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
  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {request.requested_operation}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge label={request.status} category="approval" />
            <span className="font-mono-trace text-[11px] text-muted-foreground">
              {request.trace_id}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-surface-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="mb-6">
        <SectionTitle>Request summary</SectionTitle>
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <DetailGrid
            items={[
              ["Agent", agent?.name ?? request.agent_id],
              ["Owner", request.delegated_from ?? agent?.owner_name ?? "—"],
              [
                "Environment",
                agent
                  ? agent.environment === "prod"
                    ? "Production"
                    : formatLabel(agent.environment)
                  : "—",
              ],
              ["Requested operation", request.requested_operation],
              ["Target integration", request.target_integration],
              ["Requested", formatDate(request.requested_at)],
            ]}
          />
        </div>
      </div>

      <div className="mb-6">
        <SectionTitle>Authority context</SectionTitle>
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <DetailGrid
            items={[
              ["Authority model", formatLabel(request.authority_model)],
              ["Identity mode", agent ? formatLabel(agent.identity_mode) : "—"],
              ["Delegated from", request.delegated_from || "None (self-authority)"],
              [
                "Separation of duties",
                formatLabel(request.separation_of_duties_check),
              ],
            ]}
          />
        </div>
      </div>

      <div className="mb-6">
        <SectionTitle>Why this was flagged</SectionTitle>
        <div className="rounded-lg border border-status-approval/20 bg-surface-2 p-4">
          <div className="mb-3 space-y-2 text-[12px]">
            <div className="flex items-baseline gap-2">
              <span className="min-w-[120px] text-muted-foreground">Policy effect</span>
              <StatusBadge label={request.policy_effect} category="policy" />
            </div>
            {policy && (
              <div className="flex items-baseline gap-2">
                <span className="min-w-[120px] text-muted-foreground">Governing policy</span>
                <span className="text-foreground">{policy.policy_name}</span>
              </div>
            )}
            <div className="flex items-baseline gap-2">
              <span className="min-w-[120px] text-muted-foreground">Data classification</span>
              <StatusBadge
                label={request.data_classification}
                category="classification"
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="min-w-[120px] text-muted-foreground">Resource scope</span>
              <span className="text-foreground">{request.resource_scope}</span>
            </div>
          </div>
          <p className="border-t border-border pt-3 text-[13px] leading-relaxed text-secondary-foreground">
            {request.flag_reason}
            {policy?.rationale ? ` ${policy.rationale}` : ""}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <SectionTitle>Requested context</SectionTitle>
        <div className="space-y-2 text-[13px] leading-relaxed text-secondary-foreground">
          <p>
            <span className="text-[12px] text-muted-foreground">Trigger:</span>{" "}
            Agent-initiated operation under{" "}
            {formatLabel(request.authority_model).toLowerCase()} authority.
          </p>
          <p>
            The agent prepared {request.requested_operation.toLowerCase()} using{" "}
            {formatLabel(request.data_classification).toLowerCase()} context and
            requested execution through {request.target_integration}.
          </p>
          <p>
            <span className="text-[12px] text-muted-foreground">Intended impact:</span>{" "}
            Operation will execute within the scope of{" "}
            {request.resource_scope.toLowerCase()}.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <SectionTitle>Reviewer action</SectionTitle>
        {request.status === "pending" ? (
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className="flex-1 rounded border border-status-allowed/20 bg-status-allowed/10 px-4 py-2 text-[13px] font-medium text-status-allowed transition-colors hover:bg-status-allowed/20"
            >
              Approve
            </button>
            <button
              onClick={onDeny}
              className="flex-1 rounded border border-status-denied/20 bg-status-denied/10 px-4 py-2 text-[13px] font-medium text-status-denied transition-colors hover:bg-status-denied/20"
            >
              Deny
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <StatusBadge label={request.status} category="approval" size="md" />
            <span className="text-[13px] text-muted-foreground">
              {request.status === "approved"
                ? "Operation approved and recorded in trace."
                : "Operation denied and recorded in trace."}
            </span>
          </div>
        )}
      </div>

      {policy && (
        <div>
          <SectionTitle>Governance metadata</SectionTitle>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <div>Policy version: {policy.policy_version}</div>
            <div>Modified by: {policy.modified_by}</div>
            <div>Last modified: {formatDate(policy.modified_at)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const {
    approvalRequests,
    agents,
    policyRules,
    approveRequest,
    denyRequest,
    resetScenarios,
  } = useAppContext();

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const agentNames = useMemo(() => agents.map((agent) => agent.name), [agents]);

  const agentNameToId = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((agent) => map.set(agent.name, agent.id));
    return map;
  }, [agents]);

  const agentIdToName = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((agent) => map.set(agent.id, agent.name));
    return map;
  }, [agents]);

  const filteredRequests = useMemo(() => {
    let result = approvalRequests;

    if (statusFilter) {
      result = result.filter((request) => request.status === statusFilter);
    }

    if (agentFilter) {
      const agentId = agentNameToId.get(agentFilter);
      result = agentId ? result.filter((request) => request.agent_id === agentId) : [];
    }

    if (classificationFilter) {
      result = result.filter(
        (request) => request.data_classification === classificationFilter
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (request) =>
          request.requested_operation.toLowerCase().includes(query) ||
          request.trace_id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [
    agentFilter,
    agentNameToId,
    approvalRequests,
    classificationFilter,
    searchQuery,
    statusFilter,
  ]);

  const selectedRequest = useMemo(
    () => approvalRequests.find((request) => request.id === selectedRequestId),
    [approvalRequests, selectedRequestId]
  );

  const selectedAgent = useMemo(
    () =>
      selectedRequest ? resolveAgent(agents, selectedRequest.agent_id) : undefined,
    [agents, selectedRequest]
  );

  const selectedPolicy = useMemo(
    () =>
      selectedRequest ? resolvePolicy(policyRules, selectedRequest) : undefined,
    [policyRules, selectedRequest]
  );

  const handleApprove = useCallback(() => {
    if (!selectedRequestId) return;
    approveRequest(selectedRequestId);
    toast.success("Approval recorded. Operation executed and trace updated.");
  }, [approveRequest, selectedRequestId]);

  const handleDeny = useCallback(() => {
    if (!selectedRequestId) return;
    denyRequest(selectedRequestId);
    toast.success("Denial recorded. Operation blocked and trace updated.");
  }, [denyRequest, selectedRequestId]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Approval Queue"
        subtitle="Sensitive agent operations requiring human review before execution."
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Search by operation or trace ID"
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-64"
          />
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
            options={[
              { value: "public", label: "Public" },
              { value: "internal", label: "Internal" },
              { value: "confidential", label: "Confidential" },
              { value: "restricted", label: "Restricted" },
            ]}
            value={classificationFilter}
            onChange={setClassificationFilter}
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
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <QueueItemCard
              key={request.id}
              approvalRequest={request}
              agentName={agentIdToName.get(request.agent_id) ?? request.agent_id}
              onReview={setSelectedRequestId}
            />
          ))}
        </div>
      )}

      <SlideOverPanel
        isOpen={selectedRequestId !== null}
        onClose={() => setSelectedRequestId(null)}
      >
        {selectedRequest ? (
          <ApprovalDetail
            request={selectedRequest}
            agent={selectedAgent}
            policy={selectedPolicy}
            onClose={() => setSelectedRequestId(null)}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">No request selected.</div>
        )}
      </SlideOverPanel>
    </div>
  );
}
