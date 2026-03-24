import { Shield } from "lucide-react";
import { FOOTER_COLUMNS, COMPLIANCE_BADGES } from "./data";

export function V2Footer() {
  return (
    <footer className="border-t border-border-muted bg-surface-deep px-6 py-14">
      <div className="mx-auto max-w-[1200px]">
        {/* Brand */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-2">
            <Shield className="h-4 w-4 text-accent-blue" />
            <span className="text-[15px] font-medium text-white">SidClaw</span>
          </div>
          <p className="text-[13px] text-text-muted">Enterprise governance for AI agents.</p>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted mb-4">{col.title}</div>
              <div className="space-y-2.5">
                {col.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="block text-[13px] text-text-secondary hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border-muted pt-6">
          <p className="text-[12px] text-text-muted">&copy; 2026 SidClaw. SDK: Apache 2.0. Platform: FSL 1.1.</p>
          <div className="flex items-center gap-4">
            {COMPLIANCE_BADGES.slice(0, 4).map((badge) => (
              <span key={badge} className="text-[11px] text-text-muted">
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
