'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sectionLabels: Record<string, string> = {
  agents: 'Agents',
  policies: 'Policies',
  approvals: 'Approvals',
  audit: 'Audit',
  architecture: 'Architecture',
  settings: 'Settings',
};

export function DashboardBreadcrumbs() {
  const pathname = usePathname();

  // /dashboard → just "Overview"
  if (pathname === '/dashboard') {
    return (
      <nav data-testid="breadcrumbs">
        <span className="text-xs text-text-secondary">Overview</span>
      </nav>
    );
  }

  // Split path: /dashboard/agents/agent-001 → ['agents', 'agent-001']
  const segments = pathname.replace('/dashboard/', '').split('/');
  const section = segments[0];
  const detailId = segments[1];

  if (!section) {
    return <nav data-testid="breadcrumbs"><span className="text-xs text-text-secondary">Dashboard</span></nav>;
  }

  const sectionLabel = sectionLabels[section] ?? section;

  if (!detailId) {
    // Section page: just show section name
    return (
      <nav data-testid="breadcrumbs">
        <span className="text-xs text-text-secondary">{sectionLabel}</span>
      </nav>
    );
  }

  // Detail page: Section > Detail ID
  return (
    <nav data-testid="breadcrumbs">
      <div className="flex items-center gap-1.5 text-xs">
        <Link
          href={`/dashboard/${section}`}
          className="text-text-muted transition-colors hover:text-text-secondary"
        >
          {sectionLabel}
        </Link>
        <span className="text-text-muted/50">&gt;</span>
        <span className="text-text-secondary">{detailId}</span>
      </div>
    </nav>
  );
}
