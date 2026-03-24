"use client";

import { useState, useEffect } from "react";
import { Shield, ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { PRIMITIVES } from "./data";

export function V2Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!productOpen) return;
    const close = () => setProductOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [productOpen]);

  return (
    <header className="sticky top-0 z-50">
      <nav
        className={`transition-all duration-300 border-b ${
          scrolled
            ? "bg-surface-0/90 backdrop-blur-md border-border-muted"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6 lg:px-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-accent-blue" />
            <span className="text-[15px] font-medium tracking-tight text-white">
              SidClaw
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setProductOpen(!productOpen);
                }}
                className="flex items-center gap-1.5 text-[14px] text-text-secondary hover:text-white transition-colors"
              >
                Product
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${productOpen ? "rotate-180" : ""}`}
                />
              </button>
              {productOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[520px] rounded-xl border border-border-muted bg-surface-1 p-2 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-2 gap-1">
                    {PRIMITIVES.map((p) => {
                      const Icon = p.icon;
                      return (
                        <a
                          key={p.title}
                          href={p.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-3 rounded-lg p-3 hover:bg-surface-2 transition-colors group"
                        >
                          <Icon className="h-5 w-5 mt-0.5 text-accent-blue shrink-0" />
                          <div>
                            <div className="text-[13px] font-medium text-white group-hover:text-accent-blue transition-colors">
                              {p.title}
                            </div>
                            <div className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                              {p.description}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <a
              href="https://docs.sidclaw.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-text-secondary hover:text-white transition-colors"
            >
              Docs
            </a>
            <a
              href="#pricing"
              className="text-[14px] text-text-secondary hover:text-white transition-colors"
            >
              Pricing
            </a>
            <a
              href="https://github.com/sidclawhq/platform"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-text-secondary hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <a
              href="https://app.sidclaw.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:block text-[14px] text-text-secondary hover:text-white transition-colors"
            >
              Sign in
            </a>
            <a
              href="https://app.sidclaw.com/signup"
              className="rounded-full bg-accent-blue px-5 py-2 text-[13px] font-medium text-white hover:bg-[#2563EB] transition-colors shadow-[0_0_20px_rgba(59,130,246,0.15)]"
            >
              Get Started Free
            </a>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-text-muted hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border-muted bg-surface-1 px-6 py-4 space-y-3">
            <a href="https://docs.sidclaw.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-text-secondary hover:text-white">
              Docs
            </a>
            <a href="#pricing" className="block text-sm text-text-secondary hover:text-white">
              Pricing
            </a>
            <a href="https://github.com/sidclawhq/platform" target="_blank" rel="noopener noreferrer" className="block text-sm text-text-secondary hover:text-white">
              GitHub
            </a>
            <a href="https://app.sidclaw.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-text-secondary hover:text-white">
              Sign in
            </a>
          </div>
        )}
      </nav>
    </header>
  );
}
