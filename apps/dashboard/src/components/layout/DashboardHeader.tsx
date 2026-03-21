"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, LogOut } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SearchResponse } from "@/lib/api-client";
import { GlobalSearchResults } from "./GlobalSearchResults";
import { DashboardBreadcrumbs } from "./DashboardBreadcrumbs";
import { useAuth } from "@/lib/auth-context";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    try {
      const data = await api.search(q);
      setResults(data);
    } catch {
      setResults(null);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length > 0) {
      setIsOpen(true);
      debounceRef.current = setTimeout(() => handleSearch(query), 300);
    } else {
      setIsOpen(false);
      setResults(null);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, handleSearch]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery("");
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface-0 px-6">
      <DashboardBreadcrumbs />

      <div className="flex items-center gap-4">
        <div ref={containerRef} className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length > 0 && setIsOpen(true)}
            className="h-8 w-64 rounded-md border border-border bg-surface-1 pl-8 pr-3 text-[13px] text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {isOpen && (
            <GlobalSearchResults
              results={results}
              query={query}
              onClose={handleClose}
            />
          )}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[11px] font-medium text-text-secondary">
              {getInitials(user.name)}
            </div>
            <span className="text-sm text-text-secondary">{user.name}</span>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-text-muted transition-colors hover:text-foreground"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        {!user && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[11px] font-medium text-text-secondary">
            AI
          </div>
        )}
      </div>
    </header>
  );
}
