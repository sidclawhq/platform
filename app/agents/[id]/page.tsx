"use client";

import { useParams } from "next/navigation";
import { useAppContext } from "@/lib/state/AppContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataRow } from "@/components/ui/DataRow";
import { StatCard } from "@/components/ui/StatCard";
import { toast } from "sonner";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

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

  const agent = agents.find((a) => a.id === id);

  if (!agent) {
    return (
      <div className="p-8 text-white/60">
        Agent not found.
      </div>
    );
  }

  /* ---- Derived data ------------------------------------------------ */

  const agentPolicies = policyRules.filter((p) => p.agent_id === agent.id);
  const allowCount = agentPolicies.filter(
    (p) => p.policy_effect === "allow"
  ).length;
  const approvalRequiredCount = agentPolicies.filter(
    (p) => p.policy_effect === "approval_required"
  ).length;
  const denyCount = agentPolicies.filter(
    (p) => p.policy_effect === "deny"
  ).length;
  const latestVersion =
    agentPolicies
      .map((p) => p.policy_version)
      .sort()
      .pop() ?? "—";

  const agentApprovals = approvalRequests
    .filter((r) => r.agent_id === agent.id)
    .slice(-3);

  const agentTraces = auditTraces
    .filter((t) => t.agent_id === agent.id)
    .slice(-3);

  /* ---- Authority explanation --------------------------------------- */

  const authorityExplanation: Record<string, string> = {
    hybrid:
      "This agent operates under hybrid authority — it acts on behalf of its registered owner for outbound communications while maintaining its own service identity for internal operations.",
    self:
      "This agent operates under self authority — it acts as an independent service identity within its defined operational scope.",
    delegated:
      "This agent operates under delegated authority — it acts entirely on behalf of an authorized principal within a defined scope.",
  };

  /* ---- Lifecycle actions ------------------------------------------- */

  function handleSuspend() {
    suspendAgent(agent!.id);
    toast.success(`${agent!.name} has been suspended.`);
  }

  function handleRevoke() {
    revokeAgent(agent!.id);
    toast.success(`All grants for ${agent!.name} have been revoked.`);
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div>
      {/* ── Header block ──────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white/90">
          {agent.name}
        </h1>
        <p className="text-sm text-white/50 mt-1">{agent.description}</p>

        <div className="flex gap-2 mt-3">
          <StatusBadge
            label={agent.lifecycle_state}
            category="lifecycle"
          />
          <span className="inline-flex items-center rounded-full font-medium px-2.5 py-0.5 text-xs bg-sky-500/10 text-sky-400">
            {titleCase(agent.autonomy_tier)} autonomy
          </span>
          <span className="inline-flex items-center rounded-full font-medium px-2.5 py-0.5 text-xs bg-white/[0.06] text-white/60">
            {formatLabel(agent.authority_model)}
          </span>
        </div>

        <p className="text-xs text-white/30 mt-2">
          {titleCase(agent.environment)} &middot; Owned by{" "}
          {agent.owner_name} &middot; {agent.team}
        </p>
      </div>

      {/* ── 2-column layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left column (2/3) ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Section A — Overview */}
          <section>
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Overview
            </h2>
            <dl>
              <DataRow label="Owner name" value={agent.owner_name} />
              <DataRow label="Owner role" value={agent.owner_role} />
              <DataRow label="Team" value={agent.team} />
              <DataRow
                label="Environment"
                value={titleCase(agent.environment)}
              />
              <DataRow
                label="Identity mode"
                value={formatLabel(agent.identity_mode)}
              />
              <DataRow
                label="Delegation model"
                value={formatLabel(agent.delegation_model)}
              />
              <DataRow
                label="Authority model"
                value={formatLabel(agent.authority_model)}
              />
              <DataRow
                label="Next review date"
                value={agent.next_review_date}
              />
            </dl>
          </section>

          {/* Section B — Authority & Identity */}
          <section>
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Authority &amp; Identity
            </h2>
            <dl>
              <DataRow
                label="Identity mode"
                value={formatLabel(agent.identity_mode)}
              />
              <DataRow
                label="Delegation model"
                value={formatLabel(agent.delegation_model)}
              />
            </dl>
            <p className="text-sm text-white/60 mt-3 leading-relaxed">
              {authorityExplanation[agent.authority_model] ??
                "Authority model details are not available for this configuration."}
            </p>
            <p className="text-sm text-white/50 mt-2 italic">
              Sensitive operations triggered by this agent require review by
              an approver other than the registered owner.
            </p>
          </section>

          {/* Section C — Authorized Integrations */}
          <section>
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Authorized Integrations
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agent.authorized_integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4"
                >
                  <div className="text-sm font-medium text-white/80">
                    {integration.name}
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    {integration.resource_scope}
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    {formatLabel(integration.data_classification)}
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    {integration.allowed_operations.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section D — Policy Summary */}
          <section>
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Policy Summary
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                value={allowCount}
                label="Allowed rules"
                tone="success"
              />
              <StatCard
                value={approvalRequiredCount}
                label="Approval required"
                tone="warning"
              />
              <StatCard
                value={denyCount}
                label="Denied rules"
                tone="danger"
              />
              <StatCard
                value={latestVersion}
                label="Policy version"
              />
            </div>
            <Link
              href={`/policies?agent=${agent.id}`}
              className="inline-block mt-3 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              View all policies &rarr;
            </Link>
          </section>

          {/* Section E — Recent Approval Activity */}
          <section>
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Recent Approval Activity
            </h2>
            {agentApprovals.length === 0 ? (
              <p className="text-sm text-white/40">
                No approval activity for this agent.
              </p>
            ) : (
              <div className="space-y-2">
                {agentApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3"
                  >
                    <span className="text-sm text-white/70 truncate mr-4">
                      {req.requested_operation}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge
                        label={req.status}
                        category="approval"
                      />
                      <span className="text-xs text-white/30">
                        {formatTime(req.requested_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/approvals"
              className="inline-block mt-3 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              View all approvals &rarr;
            </Link>
          </section>

          {/* Section F — Recent Trace Activity */}
          <section>
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Recent Trace Activity
            </h2>
            {agentTraces.length === 0 ? (
              <p className="text-sm text-white/40">
                No trace activity for this agent.
              </p>
            ) : (
              <div className="space-y-2">
                {agentTraces.map((trace) => (
                  <div
                    key={trace.trace_id}
                    className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3 truncate mr-4">
                      <span className="text-xs font-mono text-white/40">
                        {trace.trace_id}
                      </span>
                      <span className="text-sm text-white/70 truncate">
                        {trace.requested_operation}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge
                        label={trace.final_outcome}
                        category="trace"
                      />
                      <span className="text-xs text-white/30">
                        {formatTime(trace.started_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/audit"
              className="inline-block mt-3 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              View all audit traces &rarr;
            </Link>
          </section>
        </div>

        {/* ── Right column (1/3) ─────────────────────────────────── */}
        <div className="space-y-6">
          {/* Lifecycle Controls */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-5">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Lifecycle Controls
            </h3>
            <StatusBadge
              label={agent.lifecycle_state}
              category="lifecycle"
              size="md"
            />
            <div className="mt-4 space-y-2">
              <button
                onClick={handleSuspend}
                className="bg-amber-600/10 text-amber-400 border border-amber-500/15 hover:bg-amber-600/20 w-full py-2 rounded-md text-sm transition-colors"
              >
                Suspend Agent
              </button>
              <button
                onClick={handleRevoke}
                className="bg-red-600/10 text-red-400 border border-red-500/15 hover:bg-red-600/20 w-full py-2 rounded-md text-sm transition-colors"
              >
                Revoke All Grants
              </button>
            </div>
          </div>

          {/* Governance Snapshot */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-5">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Governance Snapshot
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-white/40">Autonomy tier</dt>
                <dd className="text-sm text-white/80 mt-0.5">
                  {titleCase(agent.autonomy_tier)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Authority model</dt>
                <dd className="text-sm text-white/80 mt-0.5">
                  {formatLabel(agent.authority_model)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">
                  Approval dependency
                </dt>
                <dd className="text-sm text-white/80 mt-0.5">
                  Required for sensitive operations
                </dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Next review date</dt>
                <dd className="text-sm text-white/80 mt-0.5">
                  {agent.next_review_date}
                </dd>
              </div>
            </dl>
          </div>

          {/* Linked Navigation */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-5">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">
              Linked Navigation
            </h3>
            <nav>
              <Link
                href={`/policies?agent=${agent.id}`}
                className="text-sm text-white/50 hover:text-white/80 transition-colors block py-1"
              >
                View policies
              </Link>
              <Link
                href="/approvals"
                className="text-sm text-white/50 hover:text-white/80 transition-colors block py-1"
              >
                View approval queue
              </Link>
              <Link
                href="/audit"
                className="text-sm text-white/50 hover:text-white/80 transition-colors block py-1"
              >
                View audit traces
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
