'use client';

import { useRouter } from 'next/navigation';
import type { SearchResponse } from '@/lib/api-client';

interface GlobalSearchResultsProps {
  results: SearchResponse | null;
  query: string;
  onClose: () => void;
}

interface ResultItemProps {
  label: string;
  sublabel: string;
  onClick: () => void;
}

function ResultItem({ label, sublabel, onClick }: ResultItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="search-result-item"
      className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-2/50"
    >
      <span className="text-foreground">{label}</span>
      <span className="text-xs text-text-muted">{sublabel}</span>
    </button>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
      {title}
    </div>
  );
}

export function GlobalSearchResults({
  results,
  query,
  onClose,
}: GlobalSearchResultsProps) {
  const router = useRouter();

  const navigate = (path: string) => {
    onClose();
    router.push(path);
  };

  if (query.length < 2) {
    return (
      <div data-testid="search-results" className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-surface-1 p-3 shadow-lg">
        <p className="text-xs text-text-muted">Type at least 2 characters</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div data-testid="search-results" className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-surface-1 p-3 shadow-lg">
        <p className="text-xs text-text-muted">Searching...</p>
      </div>
    );
  }

  if (results.total === 0) {
    return (
      <div data-testid="search-results" className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-surface-1 p-3 shadow-lg">
        <p className="text-xs text-text-muted">No results</p>
      </div>
    );
  }

  return (
    <div data-testid="search-results" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface-1 shadow-lg">
      {results.results.agents.length > 0 && (
        <div>
          <SectionHeader title="Agents" />
          {results.results.agents.map((agent) => (
            <ResultItem
              key={agent.id}
              label={agent.name}
              sublabel="Agent"
              onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
            />
          ))}
        </div>
      )}

      {results.results.policies.length > 0 && (
        <div>
          <SectionHeader title="Policies" />
          {results.results.policies.map((policy) => (
            <ResultItem
              key={policy.id}
              label={policy.policy_name}
              sublabel={policy.agent_name}
              onClick={() => navigate('/dashboard/policies')}
            />
          ))}
        </div>
      )}

      {results.results.approvals.length > 0 && (
        <div>
          <SectionHeader title="Approvals" />
          {results.results.approvals.map((approval) => (
            <ResultItem
              key={approval.id}
              label={approval.highlight}
              sublabel={approval.agent_name}
              onClick={() => navigate('/dashboard/approvals')}
            />
          ))}
        </div>
      )}

      {results.results.traces.length > 0 && (
        <div>
          <SectionHeader title="Traces" />
          {results.results.traces.map((trace) => (
            <ResultItem
              key={trace.trace_id}
              label={trace.highlight}
              sublabel={trace.agent_name}
              onClick={() => navigate('/dashboard/audit')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
