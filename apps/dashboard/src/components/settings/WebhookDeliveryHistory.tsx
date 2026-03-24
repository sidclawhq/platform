'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Delivery {
  id: string;
  event_type: string;
  status: string;
  http_status: number | null;
  attempts: number;
  created_at: string;
  delivered_at: string | null;
  next_retry_at: string | null;
}

interface WebhookInfo {
  id: string;
  url: string;
}

interface WebhookDeliveryHistoryProps {
  webhook: WebhookInfo;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  delivered: 'text-accent-green bg-accent-green/10',
  pending: 'text-accent-amber bg-accent-amber/10',
  retrying: 'text-accent-amber bg-accent-amber/10',
  failed: 'text-accent-red bg-accent-red/10',
};

export function WebhookDeliveryHistory({ webhook, onClose }: WebhookDeliveryHistoryProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await api.getWebhookDeliveries(webhook.id, { limit: 50 });
      setDeliveries(res.data);
    } catch {
      toast.error('Failed to load delivery history');
    } finally {
      setLoading(false);
    }
  }, [webhook.id]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await api.testWebhook(webhook.id);
      if (result.delivered) {
        toast.success(`Test delivered (${result.http_status}, ${result.response_time_ms}ms)`);
      } else {
        toast.error(`Test failed: ${result.error ?? `HTTP ${result.http_status}`}`);
      }
      fetchDeliveries();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to send test');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="w-full max-w-lg bg-surface-1 border-l border-border h-full overflow-y-auto">
        <div className="sticky top-0 bg-surface-1 border-b border-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Delivery History</h2>
            <p className="text-xs text-text-muted font-mono mt-0.5 truncate max-w-sm">
              {webhook.url}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="rounded border border-border px-2.5 py-1 text-xs text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              {testing ? 'Sending...' : 'Test'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-text-muted text-center py-8">Loading...</p>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No deliveries yet</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="rounded border border-border bg-surface-0 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground font-mono">{d.event_type}</span>
                    <span
                      className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                        statusColors[d.status] ?? 'text-text-muted bg-surface-2'
                      )}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-4 text-xs text-text-muted">
                    <span>{new Date(d.created_at).toLocaleString()}</span>
                    {d.http_status !== null && (
                      <span className="font-mono">HTTP {d.http_status}</span>
                    )}
                    {d.attempts > 1 && (
                      <span>{d.attempts} attempts</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
