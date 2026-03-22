'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';

const DATA_CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;

export default function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [ttl, setTtl] = useState(86400);
  const [classification, setClassification] = useState('internal');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getTenantSettings();
        setName(res.data.name);
        setTtl(res.data.settings.default_approval_ttl_seconds);
        setClassification(res.data.settings.default_data_classification);
        setNotificationEmail(res.data.settings.notification_email ?? '');
        setNotificationsEnabled(res.data.settings.notifications_enabled);
      } catch {
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await api.updateTenantSettings({
        name: name.trim(),
        settings: {
          default_approval_ttl_seconds: ttl,
          default_data_classification: classification,
          notification_email: notificationEmail.trim() || null,
          notifications_enabled: notificationsEnabled,
        },
      });
      toast.success('Settings saved');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-text-muted">Loading settings...</p>
      </div>
    );
  }

  const ttlHours = Math.round((ttl / 3600) * 10) / 10;

  return (
    <div>
      <div>
        <h1 className="text-lg font-medium text-foreground">General Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure workspace defaults and notification preferences.
        </p>
      </div>

      <div className="mt-6 max-w-lg space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Workspace Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="ttl" className="block text-sm font-medium text-foreground">
            Default Approval TTL
          </label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              id="ttl"
              type="number"
              value={ttl}
              onChange={(e) => setTtl(parseInt(e.target.value, 10) || 0)}
              min={60}
              max={604800}
              className="w-32 rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-sm text-text-muted">
              seconds ({ttlHours} {ttlHours === 1 ? 'hour' : 'hours'})
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            How long approval requests remain pending before auto-expiring.
          </p>
        </div>

        <div>
          <label htmlFor="classification" className="block text-sm font-medium text-foreground">
            Default Data Classification
          </label>
          <select
            id="classification"
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            className="mt-1.5 w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {DATA_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-text-muted">
            Applied when SDK evaluate call doesn&apos;t specify classification.
          </p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Notification Email
          </label>
          <input
            id="email"
            type="email"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder="notifications@company.com"
            className="mt-1.5 w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-text-muted">
            Override default recipients for approval notifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="notifications"
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="notifications" className="text-sm text-foreground cursor-pointer">
            Email Notifications Enabled
          </label>
        </div>

        {error && (
          <p className="text-sm text-accent-red">{error}</p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            data-testid="save-settings"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-md bg-[#3B82F6] px-6 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
