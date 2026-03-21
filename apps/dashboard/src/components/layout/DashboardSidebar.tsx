"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Shield,
  CheckCircle,
  ScrollText,
  Network,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PendingApprovalBadge } from "./PendingApprovalBadge";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/dashboard/agents", icon: Bot },
  { label: "Policies", href: "/dashboard/policies", icon: Shield },
  { label: "Approvals", href: "/dashboard/approvals", icon: CheckCircle, badge: true },
  { label: "Audit", href: "/dashboard/audit", icon: ScrollText },
  { label: "Architecture", href: "/dashboard/architecture", icon: Network },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-surface-1">
      <div className="px-4 py-5">
        <span className="text-[13px] font-semibold text-foreground">
          Agent Identity
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-text-secondary hover:bg-surface-2/50 hover:text-foreground"
              )}
            >
              <Icon size={16} />
              {item.label}
              {'badge' in item && item.badge && <PendingApprovalBadge />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-2 py-2">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
            pathname.startsWith("/dashboard/settings")
              ? "bg-surface-2 text-foreground"
              : "text-text-secondary hover:bg-surface-2/50 hover:text-foreground"
          )}
        >
          <Settings size={16} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
