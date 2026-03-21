"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

export default function AuditExportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!from || !to) {
      setError("Both From and To dates are required.");
      return;
    }

    setError(null);
    setExporting(true);

    try {
      const blob = await api.exportAuditEvents({
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        format,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-events-${from}-to-${to}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Export failed. Try a smaller date range.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-foreground">Audit Export</h2>
        <p className="mt-1 text-sm text-text-muted">
          Export audit events for compliance and SIEM integration.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface-1 p-6">
        <h3 className="text-sm font-medium text-foreground">Manual Export</h3>
        <p className="mt-1 text-xs text-text-muted">
          Download all audit events within a date range. Maximum 100,000 events per export.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="from" className="block text-xs text-text-muted">
              From
            </label>
            <input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-foreground focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="to" className="block text-xs text-text-muted">
              To
            </label>
            <input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-foreground focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="format" className="block text-xs text-text-muted">
              Format
            </label>
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "json" | "csv")}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-foreground focus:outline-none"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full rounded bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Download Export"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-[#EF4444]">{error}</p>
        )}
      </div>

      <div className="rounded-md border border-border bg-surface-1 p-6">
        <h3 className="text-sm font-medium text-foreground">Continuous Export</h3>
        <p className="mt-2 text-xs text-text-muted">
          Set up a webhook endpoint subscribed to{" "}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">audit.event</code>{" "}
          or{" "}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">audit.batch</code>{" "}
          for real-time SIEM integration. Batch events are dispatched every 60 seconds.
        </p>
        <div className="mt-4">
          <Link
            href="/dashboard/settings/webhooks"
            className="inline-flex items-center gap-1 text-sm text-[#3B82F6] hover:underline"
          >
            Configure Webhooks &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
