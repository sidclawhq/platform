'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { usePermissions } from '@/lib/permissions';

type ApiKeyScope = 'evaluate' | 'traces:read' | 'traces:write' | 'agents:read' | 'approvals:read' | 'admin';

const ALL_SCOPES: { value: ApiKeyScope; label: string; abbrev: string }[] = [
  { value: 'evaluate', label: 'Evaluate', abbrev: 'evaluate' },
  { value: 'traces:read', label: 'Traces Read', abbrev: 'traces:r' },
  { value: 'traces:write', label: 'Traces Write', abbrev: 'traces:w' },
  { value: 'agents:read', label: 'Agents Read', abbrev: 'agents:r' },
  { value: 'approvals:read', label: 'Approvals Read', abbrev: 'approvals:r' },
  { value: 'admin', label: 'Admin (full access)', abbrev: 'admin' },
];

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface CreateResponse {
  data: ApiKeyRow & { key: string };
}

interface RotateResponse {
  data: { id: string; name: string; key: string; key_prefix: string; scopes: string[] };
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function scopeAbbrev(scope: string): string {
  const found = ALL_SCOPES.find((s) => s.value === scope);
  return found?.abbrev ?? scope;
}

export default function ApiKeysPage() {
  const { isAdmin } = usePermissions();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createScopes, setCreateScopes] = useState<Set<ApiKeyScope>>(new Set());
  const [createExpiry, setCreateExpiry] = useState('');
  const [creating, setCreating] = useState(false);

  // Key display dialog
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Confirmations
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRotateId, setConfirmRotateId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const result = await api.get<{ data: ApiKeyRow[] }>('/api/v1/api-keys');
      setKeys(result.data);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchKeys();
    else setLoading(false);
  }, [isAdmin, fetchKeys]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-text-secondary">Admin access required</p>
        <p className="mt-1 text-xs text-text-muted">
          Contact an admin to manage API keys.
        </p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (createScopes.size === 0) {
      toast.error('Select at least one scope');
      return;
    }

    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: createName.trim(),
        scopes: Array.from(createScopes),
      };
      if (createExpiry) {
        payload.expires_at = new Date(createExpiry).toISOString();
      }
      const result = await api.post<CreateResponse>('/api/v1/api-keys', payload);
      setRevealedKey(result.data.key);
      setShowCreate(false);
      setCreateName('');
      setCreateScopes(new Set());
      setCreateExpiry('');
      fetchKeys();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await api.delete(`/api/v1/api-keys/${id}`);
      toast.success('API key deleted');
      setConfirmDeleteId(null);
      fetchKeys();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to delete API key');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRotate = async (id: string) => {
    setActionLoading(id);
    try {
      const result = await api.post<RotateResponse>(`/api/v1/api-keys/${id}/rotate`, {});
      setRevealedKey(result.data.key);
      setConfirmRotateId(null);
      fetchKeys();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to rotate API key');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopy = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: ApiKeyScope) => {
    setCreateScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">API Keys</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage API keys for SDK and programmatic access.
          </p>
        </div>
        <button
          type="button"
          data-testid="create-api-key"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface-0 hover:bg-foreground/90 transition-colors"
        >
          Create Key
        </button>
      </div>

      {/* Keys table */}
      <div className="mt-6 rounded-lg border border-border bg-surface-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">Name</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">Key Prefix</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">Scopes</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">Last Used</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">Loading...</td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">No API keys found</td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-sm text-foreground">{k.name}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary font-mono">{k.key_prefix}...</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes as string[]).map((s) => (
                        <span
                          key={s}
                          className="inline-block rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-secondary font-mono"
                        >
                          {scopeAbbrev(s)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted font-mono">
                    {formatRelativeTime(k.last_used_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {confirmRotateId === k.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRotate(k.id)}
                            disabled={actionLoading === k.id}
                            className="text-xs text-accent-amber hover:underline disabled:opacity-50"
                          >
                            Confirm Rotate
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRotateId(null)}
                            className="text-xs text-text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </>
                      ) : confirmDeleteId === k.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDelete(k.id)}
                            disabled={actionLoading === k.id}
                            className="text-xs text-accent-red hover:underline disabled:opacity-50"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmRotateId(k.id)}
                            className="text-xs text-text-secondary hover:text-foreground"
                          >
                            Rotate
                          </button>
                          <button
                            type="button"
                            data-testid="delete-key"
                            onClick={() => setConfirmDeleteId(k.id)}
                            className="text-xs text-accent-red hover:underline"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div data-testid="api-key-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface-1 p-6">
            <h2 className="text-base font-medium text-foreground">Create API Key</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Production SDK"
                  className="w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Scopes</label>
                <div className="space-y-2">
                  {ALL_SCOPES.map((scope) => (
                    <label key={scope.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createScopes.has(scope.value)}
                        onChange={() => toggleScope(scope.value)}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">{scope.label}</span>
                      <span className="text-xs text-text-muted font-mono">({scope.abbrev})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Expiry (optional)
                </label>
                <input
                  type="date"
                  value={createExpiry}
                  onChange={(e) => setCreateExpiry(e.target.value)}
                  className="w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface-0 hover:bg-foreground/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revealed key dialog */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface-1 p-6">
            <h2 className="text-base font-medium text-foreground">Your API Key</h2>
            <p className="mt-2 text-sm text-accent-amber">
              Copy this key now. It won&apos;t be shown again.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <code data-testid="raw-key-value" className="flex-1 select-all rounded bg-surface-2 p-3 font-mono text-sm text-foreground break-all">
                {revealedKey}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded border border-border px-3 py-2 text-xs text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRevealedKey(null);
                  setCopied(false);
                }}
                className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface-0 hover:bg-foreground/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
