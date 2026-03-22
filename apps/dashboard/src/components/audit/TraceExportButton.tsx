"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api-client";

export function TraceExportButton({ traceId }: { traceId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const blob = await api.exportTrace(traceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace-${traceId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — user sees no download
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      data-testid="export-json"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-0 px-2.5 py-1 text-xs text-text-secondary hover:bg-surface-1 disabled:opacity-50"
    >
      <Download size={12} />
      {loading ? "Exporting..." : "Export JSON"}
    </button>
  );
}
