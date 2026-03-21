"use client";

import { useEffect, useState } from "react";
import { api, type TraceVerifyResult } from "@/lib/api-client";

export function TraceIntegrityBadge({ traceId }: { traceId: string }) {
  const [result, setResult] = useState<TraceVerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .verifyTrace(traceId)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [traceId]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-text-muted" />
        Verifying
      </span>
    );
  }

  if (!result || (result.total_events > 0 && result.verified_events === 0)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
        No integrity data
      </span>
    );
  }

  if (result.verified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-0.5 text-xs text-[#22C55E]">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Verified ({result.verified_events})
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[#EF4444]/30 bg-[#EF4444]/10 px-2 py-0.5 text-xs text-[#EF4444]"
      title={
        result.broken_at
          ? `Integrity broken at event ${result.broken_at.event_type}`
          : "Integrity check failed"
      }
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      Integrity broken at {result.broken_at?.event_type}
    </span>
  );
}
