"use client";

import { useState, useRef, useEffect } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

export function TraceBulkExportButton() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleExport() {
    if (!from || !to) {
      setError("Both dates are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const blob = await api.exportTracesCsv({
        from: new Date(from).toISOString(),
        to: new Date(to + "T23:59:59.999Z").toISOString(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 413) {
        setError(err.message);
      } else {
        setError("Export failed. Try a smaller date range.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-0 px-2.5 py-1 text-xs text-text-secondary hover:bg-surface-1"
      >
        <Download size={12} />
        Export CSV
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-border bg-surface-0 p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-text-primary">
            Export date range
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-surface-1 px-2 font-mono text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent-blue"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-surface-1 px-2 font-mono text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent-blue"
            />
            {error && (
              <p className="text-xs text-accent-red">{error}</p>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="h-8 rounded-md bg-accent-blue px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Exporting..." : "Download CSV"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
