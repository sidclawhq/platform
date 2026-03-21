"use client";

import { useState } from "react";
import { TraceList } from "@/components/audit/TraceList";
import { TraceDetail } from "@/components/audit/TraceDetail";

export default function AuditPage() {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)]">
      {/* Left panel: trace list */}
      <div className="w-[40%] shrink-0 overflow-hidden border-r border-border">
        <TraceList
          selectedTraceId={selectedTraceId}
          onSelectTrace={setSelectedTraceId}
        />
      </div>

      {/* Right panel: trace detail */}
      <div className="flex-1 overflow-y-auto">
        <TraceDetail traceId={selectedTraceId} />
      </div>
    </div>
  );
}
