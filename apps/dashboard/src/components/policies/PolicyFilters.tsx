'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgentSummary } from '@/lib/api-client';

export interface PolicyFilterValues {
  agent_id: string;
  effect: string;
  data_classification: string;
  search: string;
}

interface PolicyFiltersProps {
  filters: PolicyFilterValues;
  onFilterChange: (filters: PolicyFilterValues) => void;
  agents: AgentSummary[];
}

export function PolicyFilters({ filters, onFilterChange, agents }: PolicyFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync external search changes
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ ...filters, search: value });
    }, 300);
  };

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const selectClass =
    'h-8 rounded border border-border bg-surface-1 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <div className="flex items-center gap-3">
      {/* Agent filter */}
      <select
        value={filters.agent_id}
        onChange={(e) => onFilterChange({ ...filters, agent_id: e.target.value })}
        className={selectClass}
      >
        <option value="">All Agents</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>

      {/* Effect filter */}
      <select
        value={filters.effect}
        onChange={(e) => onFilterChange({ ...filters, effect: e.target.value })}
        className={selectClass}
      >
        <option value="">All Effects</option>
        <option value="allow">Allow</option>
        <option value="approval_required">Approval Required</option>
        <option value="deny">Deny</option>
      </select>

      {/* Classification filter */}
      <select
        value={filters.data_classification}
        onChange={(e) => onFilterChange({ ...filters, data_classification: e.target.value })}
        className={selectClass}
      >
        <option value="">All Classifications</option>
        <option value="public">Public</option>
        <option value="internal">Internal</option>
        <option value="confidential">Confidential</option>
        <option value="restricted">Restricted</option>
      </select>

      {/* Search */}
      <input
        type="text"
        placeholder="Search policies..."
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="h-8 w-48 rounded border border-border bg-surface-1 px-3 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
