"use client";

import { useState, useEffect } from "react";
import { Shield } from "lucide-react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <nav
        className={`transition-all duration-300 border-b ${
          scrolled
            ? "bg-surface-0/80 backdrop-blur-sm border-border-default"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-semibold text-text-primary">
              SidClaw
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#pricing"
              className="hidden text-sm text-text-secondary hover:text-text-primary transition-colors sm:block"
            >
              Pricing
            </a>
            <a
              href="https://github.com/sidclawhq/sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm text-text-secondary hover:text-text-primary transition-colors sm:block"
            >
              GitHub
            </a>
            <a
              href="https://app.sidclaw.com/signup"
              className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get Started Free
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
