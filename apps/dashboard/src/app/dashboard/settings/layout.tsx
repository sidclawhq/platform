'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';

const settingsNav = [
  { label: 'General', href: '/dashboard/settings/general' },
  { label: 'Users', href: '/dashboard/settings/users' },
  { label: 'API Keys', href: '/dashboard/settings/api-keys' },
  { label: 'Webhooks', href: '/dashboard/settings/webhooks' },
  { label: 'Audit Export', href: '/dashboard/settings/audit-export' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAdmin } = usePermissions();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg text-foreground font-medium">Admin Access Required</p>
        <p className="text-sm text-text-muted mt-2">
          You need administrator privileges to access settings.
          Contact your workspace admin to change your role.
        </p>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === '/dashboard/settings/general') {
      return pathname === '/dashboard/settings' || pathname === '/dashboard/settings/general';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex gap-6">
      <nav className="w-48 shrink-0 border-r border-border pr-4">
        <h2 className="text-sm font-medium text-foreground mb-3">Settings</h2>
        <div className="flex flex-col gap-0.5">
          {settingsNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm py-2 px-3 rounded transition-colors',
                isActive(item.href)
                  ? 'bg-surface-2 text-foreground font-medium'
                  : 'text-text-secondary hover:text-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
