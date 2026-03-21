'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { WebhookList } from '@/components/settings/WebhookList';
import { WebhookCreateModal } from '@/components/settings/WebhookCreateModal';
import { WebhookDeliveryHistory } from '@/components/settings/WebhookDeliveryHistory';

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Secret display
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await api.listWebhooks();
      setWebhooks(res.data);
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await api.deleteWebhook(id);
      toast.success('Webhook deleted');
      setConfirmDeleteId(null);
      if (selectedWebhook?.id === id) setSelectedWebhook(null);
      fetchWebhooks();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to delete webhook');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopySecret = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">Webhooks</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Receive real-time notifications when events occur.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface-0 hover:bg-foreground/90 transition-colors"
        >
          Create Webhook
        </button>
      </div>

      <div className="mt-6">
        <WebhookList
          webhooks={webhooks}
          loading={loading}
          onSelect={setSelectedWebhook}
          onDelete={handleDelete}
          confirmDeleteId={confirmDeleteId}
          onConfirmDelete={setConfirmDeleteId}
          onCancelDelete={() => setConfirmDeleteId(null)}
          actionLoading={actionLoading}
        />
      </div>

      <p className="mt-3 text-xs text-text-muted">
        Click a webhook to view delivery history.
      </p>

      {showCreate && (
        <WebhookCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchWebhooks}
          onSecretRevealed={setRevealedSecret}
        />
      )}

      {selectedWebhook && (
        <WebhookDeliveryHistory
          webhook={selectedWebhook}
          onClose={() => setSelectedWebhook(null)}
        />
      )}

      {/* Secret revealed dialog */}
      {revealedSecret && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface-1 p-6">
            <h2 className="text-base font-medium text-foreground">Webhook Secret</h2>
            <p className="mt-2 text-sm text-accent-amber">
              Copy this secret now. It won&apos;t be shown again.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 select-all rounded bg-surface-2 p-3 font-mono text-sm text-foreground break-all">
                {revealedSecret}
              </code>
              <button
                type="button"
                onClick={handleCopySecret}
                className="shrink-0 rounded border border-border px-3 py-2 text-xs text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRevealedSecret(null);
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
