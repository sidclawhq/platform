"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/agents": "Agents",
  "/dashboard/policies": "Policies",
  "/dashboard/approvals": "Approvals",
  "/dashboard/audit": "Audit",
  "/dashboard/settings": "Settings",
};

export function DashboardHeader() {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] ?? "Dashboard";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface-0 px-6">
      <span className="text-[13px] font-medium text-foreground">
        {pageTitle}
      </span>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Search..."
            readOnly
            className="h-8 w-64 rounded-md border border-border bg-surface-1 pl-8 pr-3 text-[13px] text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[11px] font-medium text-text-secondary">
          AI
        </div>
      </div>
    </header>
  );
}
