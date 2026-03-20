"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertTriangle, Shield } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAppContext } from "@/lib/state/AppContext";

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DataGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-2">
          <span className="min-w-[120px] text-[12px] text-muted-foreground">
            {label}
          </span>
          <span className="text-[13px] text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground">{value}</span>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const {
    agents,
    policyRules,
    approvalRequests,
    auditTraces,
    suspendAgent,
    revokeAgent,
  } = useAppContext();

  const agent = agents.find((candidate) => candidate.id === id);

  if (!agent) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Agent not found.</p>
        <Link href="/agents" className="mt-2 inline-block text-sm text-foreground underline">
          Return to registry
        </Link>
      </div>
    );
  }

  const agentPolicies = policyRules.filter((policy) => policy.agent_id === agent.id);
  const allowCount = agentPolicies.filter((policy) => policy.policy_effect === "allow").length;
  const approvalCount = agentPolicies.filter(
    (policy) => policy.policy_effect === "approval_required"
  ).length;
  const denyCount = agentPolicies.filter((policy) => policy.policy_effect === "deny").length;
  const latestVersion = agentPolicies[0]?.policy_version || "—";

  const recentApprovals = approvalRequests.filter((request) => request.agent_id === agent.id).slice(0, 3);
  const recentTraces = auditTraces.filter((trace) => trace.agent_id === agent.id).slice(0, 3);

  const authorityExplanation: Record<string, string> = {
    hybrid:
      "This agent operates under hybrid authority. It acts on behalf of its registered owner for outbound actions while retaining its own service identity for internal execution.",
    self:
      "This agent operates under self authority. It acts as an independent service identity within its defined operational scope.",
    delegated:
      "This agent operates under delegated authority. It acts on behalf of an authorized principal within a constrained scope.",
  };

  const formattedNextReview = new Date(`${agent.next_review_date}T00:00:00`).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  return (
    <div className="animate-fade-in">
      <Link
        href="/agents"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Agents
      </Link>

      <div className="mb-6">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{agent.name}</h1>
          <StatusBadge label={agent.lifecycle_state} category="lifecycle" />
          <StatusBadge label={agent.autonomy_tier} category="autonomy" />
          <StatusBadge label={agent.authority_model} category="authority" />
        </div>
        <p className="text-sm text-muted-foreground">{agent.description}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {agent.environment === "prod" ? "Production" : formatLabel(agent.environment)} ·
          {" "}Owned by {agent.owner_name} · {agent.team}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Overview">
            <DataGrid
              items={[
                ["Owner", agent.owner_name],
                ["Role", agent.owner_role],
                ["Team", agent.team],
                [
                  "Environment",
                  agent.environment === "prod" ? "Production" : formatLabel(agent.environment),
                ],
                ["Identity mode", formatLabel(agent.identity_mode)],
                ["Delegation model", formatLabel(agent.delegation_model)],
                ["Authority model", formatLabel(agent.authority_model)],
                ["Next review", formattedNextReview],
              ]}
            />
          </Section>

          <Section title="Authority & identity">
            <p className="mb-3 text-[13px] leading-relaxed text-secondary-foreground">
              {authorityExplanation[agent.authority_model]}
            </p>
            <div className="rounded border border-border bg-surface-2 p-3">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Sensitive operations triggered by this agent require review by an approver other
                  than the registered owner.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Authorized integrations">
            <div className="space-y-2">
              {agent.authorized_integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="rounded border border-border bg-surface-2 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-foreground">
                      {integration.name}
                    </span>
                    <StatusBadge
                      label={integration.data_classification}
                      category="classification"
                    />
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    Scope: {integration.resource_scope}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Operations: {integration.allowed_operations.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Policy summary">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Allowed" value={allowCount} tone="success" />
              <StatCard label="Approval required" value={approvalCount} tone="warning" />
              <StatCard label="Denied" value={denyCount} tone="danger" />
              <StatCard label="Policy version" value={latestVersion} />
            </div>
            <Link
              href={`/policies?agent=${agent.id}`}
              className="mt-3 inline-block text-[13px] text-foreground underline underline-offset-2"
            >
              View policies
            </Link>
          </Section>

          {recentApprovals.length > 0 && (
            <Section title="Recent approval activity">
              <div className="space-y-1.5">
                {recentApprovals.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-col gap-2 rounded border border-border bg-surface-2 px-3 py-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-[13px] text-foreground">{request.requested_operation}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatTime(request.requested_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={request.policy_effect} category="policy" />
                      <StatusBadge label={request.status} category="approval" />
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/approvals"
                className="mt-3 inline-block text-[13px] text-foreground underline underline-offset-2"
              >
                View approval queue
              </Link>
            </Section>
          )}

          {recentTraces.length > 0 && (
            <Section title="Recent trace activity">
              <div className="space-y-1.5">
                {recentTraces.map((trace) => (
                  <Link
                    key={trace.trace_id}
                    href={`/audit?trace=${trace.trace_id}`}
                    className="flex flex-col gap-2 rounded border border-border bg-surface-2 px-3 py-2 transition-colors hover:bg-surface-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-mono-trace text-[13px] text-foreground">{trace.trace_id}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {trace.requested_operation}
                      </p>
                    </div>
                    <StatusBadge label={trace.final_outcome} category="trace" />
                  </Link>
                ))}
              </div>
              <Link
                href="/audit"
                className="mt-3 inline-block text-[13px] text-foreground underline underline-offset-2"
              >
                View audit traces
              </Link>
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Lifecycle controls
            </h3>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">Current state:</span>
              <StatusBadge label={agent.lifecycle_state} category="lifecycle" />
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  suspendAgent(agent.id);
                  toast("Suspend action recorded (simulation only)");
                }}
                className="flex w-full items-center gap-2 rounded border border-border bg-surface-2 px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-3"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-status-suspended" />
                Suspend agent
              </button>
              <button
                onClick={() => {
                  revokeAgent(agent.id);
                  toast("Revoke action recorded (simulation only)");
                }}
                className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-[13px] font-medium text-status-denied transition-colors hover:bg-status-denied/10"
              >
                Revoke all grants
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Governance snapshot
            </h3>
            <div className="space-y-2">
              <SnapshotRow label="Autonomy tier" value={formatLabel(agent.autonomy_tier)} />
              <SnapshotRow label="Authority model" value={formatLabel(agent.authority_model)} />
              <SnapshotRow
                label="Approval dependency"
                value={approvalCount > 0 ? `${approvalCount} rule${approvalCount > 1 ? "s" : ""}` : "None"}
              />
              <SnapshotRow label="Next review" value={formattedNextReview} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Navigate
            </h3>
            <div className="space-y-1.5">
              <Link
                href={`/policies?agent=${agent.id}`}
                className="block text-[13px] text-foreground underline underline-offset-2"
              >
                View policies
              </Link>
              <Link
                href="/approvals"
                className="block text-[13px] text-foreground underline underline-offset-2"
              >
                View approval queue
              </Link>
              <Link
                href="/audit"
                className="block text-[13px] text-foreground underline underline-offset-2"
              >
                View audit traces
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
