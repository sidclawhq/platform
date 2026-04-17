'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';

const EVENT_GROUPS = [
  {
    category: 'Approvals',
    events: [
      'approval.requested',
      'approval.approved',
      'approval.denied',
      'approval.expired',
    ],
  },
  {
    category: 'Traces',
    events: ['trace.completed'],
  },
  {
    category: 'Agents',
    events: ['agent.suspended', 'agent.revoked', 'agent.drift_detected'],
  },
  {
    category: 'Policies',
    events: ['policy.updated'],
  },
  {
    category: 'Audit',
    events: ['audit.event', 'audit.batch'],
  },
];

interface WebhookCreateModalProps {
  onClose: () => void;
  onCreated: () => void;
  onSecretRevealed: (secret: string) => void;
}

export function WebhookCreateModal({ onClose, onCreated, onSecretRevealed }: WebhookCreateModalProps) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const toggleCategory = (events: string[]) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      const allSelected = events.every((e) => next.has(e));
      if (allSelected) {
        events.forEach((e) => next.delete(e));
      } else {
        events.forEach((e) => next.add(e));
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!url.trim()) {
      toast.error('URL is required');
      return;
    }
    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
      toast.error('URL must start with https://');
      return;
    }
    if (selectedEvents.size === 0) {
      toast.error('Select at least one event');
      return;
    }

    setCreating(true);
    try {
      const result = await api.createWebhook({
        url: url.trim(),
        events: Array.from(selectedEvents),
        description: description.trim() || undefined,
      });
      onSecretRevealed(result.data.secret);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-1 p-6 max-h-[80vh] overflow-y-auto">
        <h2 className="text-base font-medium text-foreground">Create Webhook</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.example.com/webhook"
              className="w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Slack notifications"
              className="w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Events</label>
            <div className="space-y-3">
              {EVENT_GROUPS.map((group) => (
                <div key={group.category}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.events)}
                    className="text-xs font-medium text-text-muted uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    {group.category}
                  </button>
                  <div className="mt-1 space-y-1.5 ml-1">
                    {group.events.map((event) => (
                      <label key={event} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEvents.has(event)}
                          onChange={() => toggleEvent(event)}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground font-mono">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
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
  );
}
