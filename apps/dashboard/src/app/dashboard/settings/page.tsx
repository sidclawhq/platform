'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Users, Key, Webhook, Download, Settings } from 'lucide-react';

interface SettingsStats {
  tenantName: string;
  plan: string;
  userCount: number;
  apiKeyCount: number;
  webhookCount: number;
}

const statCards = [
  { label: 'Users', href: '/dashboard/settings/users', icon: Users, key: 'userCount' as const },
  { label: 'API Keys', href: '/dashboard/settings/api-keys', icon: Key, key: 'apiKeyCount' as const },
  { label: 'Webhooks', href: '/dashboard/settings/webhooks', icon: Webhook, key: 'webhookCount' as const },
  { label: 'Audit Export', href: '/dashboard/settings/audit-export', icon: Download, key: null },
  { label: 'General', href: '/dashboard/settings/general', icon: Settings, key: null },
];

export default function SettingsOverviewPage() {
  const [stats, setStats] = useState<SettingsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [tenantRes, usersRes, keysRes, webhooksRes] = await Promise.all([
          api.getTenantSettings(),
          api.get<{ data: unknown[]; pagination: { total: number } }>('/api/v1/users?limit=1'),
          api.get<{ data: unknown[] }>('/api/v1/api-keys'),
          api.listWebhooks(),
        ]);

        setStats({
          tenantName: tenantRes.data.name,
          plan: tenantRes.data.plan,
          userCount: usersRes.pagination.total,
          apiKeyCount: keysRes.data.length,
          webhookCount: webhooksRes.data.length,
        });
      } catch {
        // Fallback — show page without stats
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div>
      <div>
        <h1 className="text-lg font-medium text-foreground">Settings</h1>
        {stats && (
          <div className="mt-1 text-sm text-text-secondary">
            <span className="text-foreground font-medium">{stats.tenantName}</span>
            <span className="mx-2 text-text-muted">&middot;</span>
            <span className="capitalize">{stats.plan}</span> plan
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          const count = card.key && stats ? stats[card.key] : null;

          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-surface-2 p-2 group-hover:bg-surface-1">
                  <Icon size={16} className="text-text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{card.label}</p>
                  {count !== null && (
                    <p className="text-xs text-text-muted font-mono">{loading ? '—' : count}</p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
