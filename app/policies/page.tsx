"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppContext } from "@/lib/state/AppContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { PillFilter } from "@/components/ui/PillFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { DecisionCard } from "@/components/policies/DecisionCard";

function PoliciesContent() {
  const { policyRules, agents } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ---- filters ---------------------------------------------------- */
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [effectFilter, setEffectFilter] = useState<string | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<string | null>(null);

  /* ---- pre-populate agent filter from URL ?agent= param ----------- */
  useEffect(() => {
    const agentParam = searchParams.get("agent");
    if (agentParam) {
      const matched = agents.find((a) => a.id === agentParam);
      if (matched) {
        setAgentFilter(matched.name);
      }
    }
  }, [searchParams, agents]);

  /* ---- agent lookup helpers --------------------------------------- */
  const agentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of agents) {
      map[a.id] = a.name;
    }
    return map;
  }, [agents]);

  const agentIdByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of agents) {
      map[a.name] = a.id;
    }
    return map;
  }, [agents]);

  const agentNames = useMemo(() => agents.map((a) => a.name), [agents]);

  /* ---- filter logic (AND) ----------------------------------------- */
  const filteredRules = useMemo(() => {
    return policyRules.filter((rule) => {
      // search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          rule.policy_name.toLowerCase().includes(q) ||
          rule.operation.toLowerCase().includes(q) ||
          rule.rationale.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // agent filter
      if (agentFilter) {
        const targetAgentId = agentIdByName[agentFilter];
        if (rule.agent_id !== targetAgentId) return false;
      }

      // effect filter
      if (effectFilter) {
        if (rule.policy_effect !== effectFilter) return false;
      }

      // classification filter
      if (classificationFilter) {
        if (rule.data_classification !== classificationFilter) return false;
      }

      return true;
    });
  }, [policyRules, searchQuery, agentFilter, agentIdByName, effectFilter, classificationFilter]);

  /* ---- group by agent_id ------------------------------------------ */
  const groupedByAgent = useMemo(() => {
    const groups: Record<string, typeof filteredRules> = {};
    for (const rule of filteredRules) {
      if (!groups[rule.agent_id]) {
        groups[rule.agent_id] = [];
      }
      groups[rule.agent_id].push(rule);
    }
    return groups;
  }, [filteredRules]);

  const agentIds = Object.keys(groupedByAgent);

  /* ---- clear all filters ------------------------------------------ */
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setAgentFilter(null);
    setEffectFilter(null);
    setClassificationFilter(null);
  }, []);

  /* ---- navigate to agent detail ----------------------------------- */
  const handleAgentClick = useCallback(
    (agentId: string) => {
      router.push(`/agents/${agentId}`);
    },
    [router],
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Policies"
        subtitle="Policy rules define the effect of each operation across integration, scope, and data classification."
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Search rules"
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-52"
          />
          <PillFilter
            label="Agent"
            options={agentNames}
            value={agentFilter}
            onChange={setAgentFilter}
          />
          <PillFilter
            label="Effect"
            options={["allow", "approval_required", "deny"]}
            value={effectFilter}
            onChange={setEffectFilter}
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

      {filteredRules.length === 0 ? (
        <EmptyState
          title="No policy rules match the current filters"
          body="Adjust filters to view policy decisions across agents and integrations."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <div className="space-y-8">
          {agentIds.map((agentId, groupIndex) => (
            <div key={agentId}>
              <h2
                className={`mb-3 text-[13px] font-medium uppercase tracking-wide text-muted-foreground ${
                  groupIndex === 0 ? "mt-0" : "mt-6"
                }`}
              >
                {agentNameById[agentId] ?? agentId}
              </h2>
              <div className="space-y-3">
                {groupedByAgent[agentId].map((rule) => (
                  <DecisionCard
                    key={rule.id}
                    policyRule={rule}
                    agentName={agentNameById[rule.agent_id] ?? rule.agent_id}
                    onAgentClick={handleAgentClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense>
      <PoliciesContent />
    </Suspense>
  );
}
