'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';

interface SlackForm {
  enabled: boolean;
  webhook_url: string;
  bot_token: string;
  channel_id: string;
  signing_secret: string;
}

interface TelegramForm {
  enabled: boolean;
  bot_token: string;
  chat_id: string;
  webhook_secret: string;
}

interface TeamsForm {
  enabled: boolean;
  webhook_url: string;
  bot_id: string;
  bot_secret: string;
}

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const [slack, setSlack] = useState<SlackForm>({
    enabled: false, webhook_url: '', bot_token: '', channel_id: '', signing_secret: '',
  });
  const [telegram, setTelegram] = useState<TelegramForm>({
    enabled: false, bot_token: '', chat_id: '', webhook_secret: '',
  });
  const [teams, setTeams] = useState<TeamsForm>({
    enabled: false, webhook_url: '', bot_id: '', bot_secret: '',
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
      setTelegram({
        enabled: d.telegram.enabled,
        bot_token: d.telegram.bot_token ?? '',
        chat_id: d.telegram.chat_id ?? '',
        webhook_secret: d.telegram.webhook_secret ?? '',
      });
      setTeams({
        enabled: d.teams.enabled,
        webhook_url: d.teams.webhook_url ?? '',
        bot_id: d.teams.bot_id ?? '',
        bot_secret: d.teams.bot_secret ?? '',
      });
    } catch {
      toast.error('Failed to load integration settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async (provider: 'slack' | 'telegram' | 'teams') => {
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
      } else if (provider === 'telegram') {
        payload = {
          telegram: {
            enabled: telegram.enabled,
            bot_token: telegram.bot_token || null,
            chat_id: telegram.chat_id || null,
            webhook_secret: telegram.webhook_secret || null,
          },
        };
      } else {
        payload = {
          teams: {
            enabled: teams.enabled,
            webhook_url: teams.webhook_url || null,
            bot_id: teams.bot_id || null,
            bot_secret: teams.bot_secret || null,
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

  const handleTest = async (provider: 'slack' | 'telegram' | 'teams') => {
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
            <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.527 2.527 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.527 2.527 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.312z"/></svg>
              Slack
            </h2>
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

        {/* Telegram */}
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              Telegram
            </h2>
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

            <div>
              <label className="block text-xs text-text-secondary mb-1">Webhook Secret</label>
              <input
                type="password"
                value={telegram.webhook_secret}
                onChange={e => setTelegram(s => ({ ...s, webhook_secret: e.target.value }))}
                placeholder="Required for interactive Approve/Deny buttons"
                className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
              <p className="mt-1 text-xs text-text-muted">Passed as <code className="text-xs font-mono">secret_token</code> to Telegram&apos;s setWebhook API. Required for verifying incoming callbacks.</p>
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

        {/* Microsoft Teams */}
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor"><path d="M19.404 4.478c.608 0 1.1.493 1.1 1.1v5.695a3.028 3.028 0 0 1-3.028 3.028h-.758c-.2 2.3-1.702 4.2-3.77 5.05v1.447a.69.69 0 0 1-.688.69H8.034a.69.69 0 0 1-.688-.69V19.35c-2.34-.92-4-3.216-4-5.882v-4.81a1.38 1.38 0 0 1 1.376-1.38h7.59a1.38 1.38 0 0 1 1.376 1.38v4.81c0 .67-.098 1.318-.28 1.928h.068a1.65 1.65 0 0 0 1.65-1.65V5.578c0-.607.493-1.1 1.1-1.1h3.178zM17.17 2.25a1.87 1.87 0 1 1 0 3.74 1.87 1.87 0 0 1 0-3.74zM10.62 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>
              Microsoft Teams
            </h2>
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
              <label className="block text-xs text-text-secondary mb-1">Webhook URL</label>
              <input
                type="text"
                value={teams.webhook_url}
                onChange={e => setTeams(s => ({ ...s, webhook_url: e.target.value }))}
                placeholder="https://your-org.webhook.office.com/webhookb2/..."
                className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs text-text-muted mb-2">For interactive Approve/Deny buttons, also provide Bot Framework credentials:</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Bot App ID</label>
                  <input
                    type="text"
                    value={teams.bot_id}
                    onChange={e => setTeams(s => ({ ...s, bot_id: e.target.value }))}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Bot App Secret</label>
                  <input
                    type="password"
                    value={teams.bot_secret}
                    onChange={e => setTeams(s => ({ ...s, bot_secret: e.target.value }))}
                    placeholder="..."
                    className="w-full rounded border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs text-text-muted">
                Setup: Create an Incoming Webhook in your Teams channel, or register a Bot at{' '}
                <a href="https://dev.botframework.com/bots/new" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">
                  dev.botframework.com
                </a>
                {' '}for interactive buttons. Set the messaging endpoint to:
              </p>
              <code className="mt-1 block text-xs font-mono bg-surface-2 px-2 py-1 rounded text-text-secondary select-all">
                https://api.sidclaw.com/api/v1/integrations/teams/callback
              </code>
            </div>
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
      </div>
    </div>
  );
}
