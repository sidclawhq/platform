'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export interface AgentFilterValues {
  environment: string;
  lifecycle_state: string;
  authority_model: string;
  autonomy_tier: string;
  search: string;
}

const FILTER_OPTIONS = {
  environment: [
    { label: 'All Environments', value: '' },
    { label: 'dev', value: 'dev' },
    { label: 'test', value: 'test' },
    { label: 'prod', value: 'prod' },
  ],
  lifecycle_state: [
    { label: 'All Lifecycle', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Revoked', value: 'revoked' },
  ],
  authority_model: [
    { label: 'All Authority', value: '' },
    { label: 'Self', value: 'self' },
    { label: 'Delegated', value: 'delegated' },
    { label: 'Hybrid', value: 'hybrid' },
  ],
  autonomy_tier: [
    { label: 'All Autonomy', value: '' },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
  ],
} as const;

interface AgentFiltersProps {
  filters: AgentFilterValues;
  onChange: (filters: AgentFilterValues) => void;
}

export function AgentFilters({ filters, onChange }: AgentFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, search: value });
    }, 300);
  };

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const handleSelect = (key: keyof Omit<AgentFilterValues, 'search'>, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex items-center gap-3">
      {(Object.keys(FILTER_OPTIONS) as Array<keyof typeof FILTER_OPTIONS>).map((key) => (
        <select
          key={key}
          value={filters[key]}
          onChange={(e) => handleSelect(key, e.target.value)}
          className="h-8 rounded-md border border-border bg-surface-1 px-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {FILTER_OPTIONS[key].map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          placeholder="Search name or owner…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-8 w-52 rounded-md border border-border bg-surface-1 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}
