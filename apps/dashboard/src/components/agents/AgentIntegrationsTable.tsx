import { cn } from '@/lib/utils';
import type { AuthorizedIntegration } from '@/lib/api-client';

const classificationBadgeStyles: Record<string, string> = {
  public: 'bg-surface-2 text-text-secondary',
  internal: 'bg-accent-blue/10 text-accent-blue',
  confidential: 'bg-accent-amber/10 text-accent-amber',
  restricted: 'bg-accent-red/10 text-accent-red',
};

interface AgentIntegrationsTableProps {
  integrations: AuthorizedIntegration[];
  onAdd?: () => void;
}

export function AgentIntegrationsTable({ integrations, onAdd }: AgentIntegrationsTableProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Authorized Integrations
        </h2>
        {onAdd && (
          <button
            onClick={onAdd}
            className="rounded-md bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3B82F6]/90 transition-colors"
          >
            Add Integration
          </button>
        )}
      </div>

      {integrations.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-text-muted">
          No authorized integrations configured
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-border">
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Integration Name
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Resource Scope
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Data Classification
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Allowed Operations
                </th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((integration, i) => (
                <tr
                  key={integration.name}
                  className={cn('border-t border-border', i % 2 === 1 && 'bg-surface-0/50')}
                >
                  <td className="px-5 py-3 text-sm text-foreground font-medium">
                    {integration.name}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-primary">
                    {integration.resource_scope}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                        classificationBadgeStyles[integration.data_classification] ??
                          classificationBadgeStyles.public,
                      )}
                    >
                      {integration.data_classification}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-text-primary">
                    {integration.allowed_operations.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
