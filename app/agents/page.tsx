"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/lib/state/AppContext";
import { AgentRowCard } from "@/components/agents/AgentRowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillFilter } from "@/components/ui/PillFilter";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AgentsPage() {
  const { agents } = useAppContext();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState<string | null>(null);
  const [authorityFilter, setAuthorityFilter] = useState<string | null>(null);
  const [autonomyFilter, setAutonomyFilter] = useState<string | null>(null);
  const [lifecycleFilter, setLifecycleFilter] = useState<string | null>(null);

  const filteredAgents = agents.filter((agent) => {
    if (searchQuery && !agent.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (environmentFilter && agent.environment !== environmentFilter) {
      return false;
    }
    if (authorityFilter && agent.authority_model !== authorityFilter) {
      return false;
    }
    if (autonomyFilter && agent.autonomy_tier !== autonomyFilter) {
      return false;
    }
    if (lifecycleFilter && agent.lifecycle_state !== lifecycleFilter) {
      return false;
    }
    return true;
  });

  function clearFilters() {
    setSearchQuery("");
    setEnvironmentFilter(null);
    setAuthorityFilter(null);
    setAutonomyFilter(null);
    setLifecycleFilter(null);
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Known AI agents with defined ownership, authority models, lifecycle states, and authorized integrations."
      >
        <div className="flex flex-wrap items-center gap-4">
          <SearchInput
            placeholder="Search agents..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <PillFilter
            label="Environment"
            options={["dev", "test", "prod"]}
            value={environmentFilter}
            onChange={setEnvironmentFilter}
          />
          <PillFilter
            label="Authority"
            options={["self", "delegated", "hybrid"]}
            value={authorityFilter}
            onChange={setAuthorityFilter}
          />
          <PillFilter
            label="Autonomy"
            options={["low", "medium", "high"]}
            value={autonomyFilter}
            onChange={setAutonomyFilter}
          />
          <PillFilter
            label="Lifecycle"
            options={["active", "suspended", "revoked"]}
            value={lifecycleFilter}
            onChange={setLifecycleFilter}
          />
        </div>
      </PageHeader>

      {filteredAgents.length === 0 ? (
        <EmptyState
          title="No agents match the current filters"
          body="Try clearing one or more filters to view registered agents."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAgents.map((agent) => (
            <AgentRowCard
              key={agent.id}
              agent={agent}
              onClick={() => router.push(`/agents/${agent.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
