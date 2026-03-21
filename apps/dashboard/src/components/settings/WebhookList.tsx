'use client';

import { cn } from '@/lib/utils';

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
}

interface WebhookListProps {
  webhooks: WebhookRow[];
  loading: boolean;
  onSelect: (webhook: WebhookRow) => void;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  actionLoading: string | null;
}

export function WebhookList({
  webhooks,
  loading,
  onSelect,
  onDelete,
  confirmDeleteId,
  onConfirmDelete,
  onCancelDelete,
  actionLoading,
}: WebhookListProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-1">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">URL</th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">Events</th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">Status</th>
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">
                Loading...
              </td>
            </tr>
          ) : webhooks.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">
                No webhooks configured
              </td>
            </tr>
          ) : (
            webhooks.map((w) => (
              <tr
                key={w.id}
                className="border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-2/30 transition-colors"
                onClick={() => onSelect(w)}
              >
                <td className="px-4 py-3">
                  <div className="text-sm text-foreground font-mono truncate max-w-xs">
                    {w.url}
                  </div>
                  {w.description && (
                    <div className="text-xs text-text-muted mt-0.5">{w.description}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {w.events.map((e) => (
                      <span
                        key={e}
                        className="inline-block rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-secondary font-mono"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                      w.is_active
                        ? 'text-accent-green bg-accent-green/10'
                        : 'text-text-muted bg-surface-2'
                    )}
                  >
                    {w.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteId === w.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDelete(w.id)}
                        disabled={actionLoading === w.id}
                        className="text-xs text-accent-red hover:underline disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={onCancelDelete}
                        className="text-xs text-text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onConfirmDelete(w.id)}
                      className="text-xs text-accent-red hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
