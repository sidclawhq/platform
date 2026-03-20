"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Agents", href: "/agents" },
  { label: "Policies", href: "/policies" },
  { label: "Approval Queue", href: "/approvals" },
  { label: "Audit", href: "/audit" },
  { label: "Architecture", href: "/architecture" },
];

export function TopNav({ onReset }: { onReset: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between px-6 h-14 border-b border-white/[0.06] bg-[#0a0a0f]">
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/agents" && pathname.startsWith("/agents"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-white/[0.08] text-white/90 font-medium"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <button
        onClick={onReset}
        className="px-3 py-1.5 text-xs text-white/40 border border-white/[0.08] rounded-md hover:text-white/60 hover:border-white/[0.12] transition-colors"
      >
        Reset simulation
      </button>
    </nav>
  );
}
