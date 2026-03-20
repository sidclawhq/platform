"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/lib/state";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Agents", href: "/agents" },
  { label: "Policies", href: "/policies" },
  { label: "Approval Queue", href: "/approvals" },
  { label: "Audit", href: "/audit" },
  { label: "Architecture", href: "/architecture" },
];

export function TopNav({ onReset }: { onReset: () => void }) {
  const pathname = usePathname();
  const { approvalRequests } = useAppContext();
  const pendingCount = approvalRequests.filter((r) => r.status === "pending").length;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface-1">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between px-6">
        <div className="flex items-center gap-1">
          <span className="mr-6 text-[13px] font-semibold tracking-tight text-foreground">
            Agent Governance
          </span>
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/agents" && pathname.startsWith("/agents"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded px-3 py-1.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground"
                )}
              >
                {item.label}
                {item.label === "Approval Queue" && pendingCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-status-approval text-[10px] font-semibold text-primary-foreground">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Simulation mode
          </span>
          <button
            onClick={onReset}
            className="rounded border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-all hover:border-muted-foreground/30 hover:text-foreground active:scale-[0.97]"
          >
            Reset simulation
          </button>
        </div>
      </div>
    </nav>
  );
}
