'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';

interface IntegrationConfig {
  slack: {
    enabled: boolean;
    webhook_url: string | null;
    bot_token: string | null;
    channel_id: string | null;
    signing_secret: string | null;
  };
  teams: {
    enabled: boolean;
    webhook_url: string | null;
  };
  telegram: {
    enabled: boolean;
    bot_token: string | null;
    chat_id: string | null;
  };
}

interface SlackForm {
  enabled: boolean;
  webhook_url: string;
  bot_token: string;
  channel_id: string;
  signing_secret: string;
}

interface TeamsForm {
  enabled: boolean;
  webhook_url: string;
}

interface TelegramForm {
  enabled: boolean;
  bot_token: string;
  chat_id: string;
}

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const [slack, setSlack] = useState<SlackForm>({
    enabled: false, webhook_url: '', bot_token: '', channel_id: '', signing_secret: '',
  });
  const [teams, setTeams] = useState<TeamsForm>({
    enabled: false, webhook_url: '',
  });
  const [telegram, setTelegram] = useState<TelegramForm>({
    enabled: false, bot_token: '', chat_id: '',
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.getIntegrations();
      const d = res.data;
      setSlack({
        enabled: d.slack.enabled,
        webhook_url: d.slack.webhook_url ?? '',
        bot_token: d.slack.bot_token ?? '',
        channel_id: d.slack.channel_id ?? '',
        signing_secret: d.slack.signing_secret ?? '',
      });
      setTeams({
        enabled: d.teams.enabled,
        webhook_url: d.teams.webhook_url ?? '',
      });
      setTelegram({
        enabled: d.telegram.enabled,
        bot_token: d.telegram.bot_token ?? '',
        chat_id: d.telegram.chat_id ?? '',
      });
    } catch {
      toast.error('Failed to load integration settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async (provider: 'slack' | 'teams' | 'telegram') => {
    setSaving(provider);
    try {
      let payload: Record<string, unknown> = {};
      if (provider === 'slack') {
        payload = {
          slack: {
            enabled: slack.enabled,
            webhook_url: slack.webhook_url || null,
            bot_token: slack.bot_token || null,
            channel_id: slack.channel_id || null,
            signing_secret: slack.signing_secret || null,
          },
        };
      } else if (provider === 'teams') {
        payload = {
          teams: {
            enabled: teams.enabled,
            webhook_url: teams.webhook_url || null,
          },
        };
      } else {
        payload = {
          telegram: {
            enabled: telegram.enabled,
            bot_token: telegram.bot_token || null,
            chat_id: telegram.chat_id || null,
          },
        };
      }
      await api.updateIntegrations(payload);
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} settings saved`);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (provider: 'slack' | 'teams' | 'telegram') => {
    setTesting(provider);
    try {
      await api.testIntegration(provider);
      toast.success(`Test notification sent to ${provider}`);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to send test notification');
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-text-muted">Loading integrations...</div>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="text-lg font-medium text-foreground">Chat Integrations</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Get approval notifications with Approve/Deny buttons directly in your team&apos;s chat.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {/* Slack */}
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Slack</h2>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={slack.enabled}
                onChange={e => setSlack(s => ({ ...s, enabled: e.target.checked }))}
                className="rounded border-border"
              />
              Enabled
            </label>
          </div>

          <div className="mt-4 space-y-3">
            <p className="text-xs text-text-muted">
              For interactive Approve/Deny buttons, provide a Bot Token + Channel ID.
              For simple notifications, use a Webhook URL instead.
            </p>

            <div>
              <label className="block text-xs text-text-secondary mb-1">Bot Token</label>
              <input
                type="password"
                value={slack.bot_token}
                onChange={e => setSlack(s => ({ ...s, bot_token: e.target.value }))}
                placeholder="xoxb-..."
                className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Channel ID</label>
                <input
                  type="text"
                  value={slack.channel_id}
                  onChange={e => setSlack(s => ({ ...s, channel_id: e.target.value }))}
                  placeholder="C0123456789"
                  className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Signing Secret</label>
                <input
                  type="password"
                  value={slack.signing_secret}
                  onChange={e => setSlack(s => ({ ...s, signing_secret: e.target.value }))}
                  placeholder="..."
                  className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs text-text-muted mb-2">Or use a simple webhook (no buttons):</p>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Webhook URL</label>
                <input
                  type="text"
                  value={slack.webhook_url}
                  onChange={e => setSlack(s => ({ ...s, webhook_url: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs text-text-muted">
                Setup: Create a Slack app at{' '}
                <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">
                  api.slack.com/apps
                </a>
                , add bot scopes: <code className="text-xs font-mono bg-surface-2 px-1 rounded">chat:write</code>, and set the Interactivity Request URL to:
              </p>
              <code className="mt-1 block text-xs font-mono bg-surface-2 px-2 py-1 rounded text-text-secondary select-all">
                https://api.sidclaw.com/api/v1/integrations/slack/actions
              </code>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleTest('slack')}
              disabled={!slack.enabled || testing === 'slack'}
              className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              {testing === 'slack' ? 'Sending...' : 'Test'}
            </button>
            <button
              type="button"
              onClick={() => handleSave('slack')}
              disabled={saving === 'slack'}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-surface-0 hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {saving === 'slack' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Microsoft Teams */}
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Microsoft Teams</h2>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={teams.enabled}
                onChange={e => setTeams(s => ({ ...s, enabled: e.target.checked }))}
                className="rounded border-border"
              />
              Enabled
            </label>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Incoming Webhook URL</label>
              <input
                type="text"
                value={teams.webhook_url}
                onChange={e => setTeams(s => ({ ...s, webhook_url: e.target.value }))}
                placeholder="https://...webhook.office.com/..."
                className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </div>

            <p className="text-xs text-text-muted">
              Teams webhooks support notifications with links to the dashboard.
              For in-chat approve/deny buttons, use Slack or Telegram.
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleTest('teams')}
              disabled={!teams.enabled || testing === 'teams'}
              className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              {testing === 'teams' ? 'Sending...' : 'Test'}
            </button>
            <button
              type="button"
              onClick={() => handleSave('teams')}
              disabled={saving === 'teams'}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-surface-0 hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {saving === 'teams' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Telegram */}
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Telegram</h2>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={telegram.enabled}
                onChange={e => setTelegram(s => ({ ...s, enabled: e.target.checked }))}
                className="rounded border-border"
              />
              Enabled
            </label>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Bot Token</label>
              <input
                type="password"
                value={telegram.bot_token}
                onChange={e => setTelegram(s => ({ ...s, bot_token: e.target.value }))}
                placeholder="123456:ABC-DEF..."
                className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1">Chat ID</label>
              <input
                type="text"
                value={telegram.chat_id}
                onChange={e => setTelegram(s => ({ ...s, chat_id: e.target.value }))}
                placeholder="-100123456789"
                className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs text-text-muted">
                Setup: Create a bot via{' '}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">
                  @BotFather
                </a>
                , add it to your group. The webhook is auto-registered when you save:
              </p>
              <code className="mt-1 block text-xs font-mono bg-surface-2 px-2 py-1 rounded text-text-secondary select-all">
                https://api.sidclaw.com/api/v1/integrations/telegram/webhook
              </code>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleTest('telegram')}
              disabled={!telegram.enabled || testing === 'telegram'}
              className="rounded border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              {testing === 'telegram' ? 'Sending...' : 'Test'}
            </button>
            <button
              type="button"
              onClick={() => handleSave('telegram')}
              disabled={saving === 'telegram'}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-surface-0 hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {saving === 'telegram' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
