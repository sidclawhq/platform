'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import type { AuthorizedIntegration } from '@/lib/api-client';

const DATA_CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;

interface AddIntegrationModalProps {
  agentId: string;
  existing: AuthorizedIntegration[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddIntegrationModal({ agentId, existing, onClose, onAdded }: AddIntegrationModalProps) {
  const [name, setName] = useState('');
  const [resourceScope, setResourceScope] = useState('*');
  const [dataClassification, setDataClassification] = useState<string>('internal');
  const [operations, setOperations] = useState('read, write');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const newIntegration: AuthorizedIntegration = {
      name: name.trim(),
      resource_scope: resourceScope.trim(),
      data_classification: dataClassification,
      allowed_operations: operations.split(',').map((op) => op.trim()).filter(Boolean),
    };

    try {
      await api.patch(`/api/v1/agents/${agentId}`, {
        authorized_integrations: [...existing, newIntegration],
      });
      toast.success(`Integration "${name}" added`);
      onAdded();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to add integration');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring';
  const labelClass = 'block text-sm font-medium text-foreground';
  const selectClass =
    'mt-1 w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-foreground">Add Integration</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Define a service this agent is authorized to interact with.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="int-name" className={labelClass}>Integration Name</label>
            <input id="int-name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Slack, GitHub, PostgreSQL" className={inputClass} />
          </div>

          <div>
            <label htmlFor="int-scope" className={labelClass}>Resource Scope</label>
            <input id="int-scope" type="text" required value={resourceScope} onChange={(e) => setResourceScope(e.target.value)}
              placeholder="e.g. * or channels/general" className={inputClass} />
          </div>

          <div>
            <label htmlFor="int-classification" className={labelClass}>Data Classification</label>
            <select id="int-classification" value={dataClassification} onChange={(e) => setDataClassification(e.target.value)} className={selectClass}>
              {DATA_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="int-ops" className={labelClass}>Allowed Operations</label>
            <input id="int-ops" type="text" required value={operations} onChange={(e) => setOperations(e.target.value)}
              placeholder="e.g. read, write, delete" className={inputClass} />
            <p className="mt-1 text-xs text-text-muted">Comma-separated list of operations</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-50">
              {submitting ? 'Adding...' : 'Add Integration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
