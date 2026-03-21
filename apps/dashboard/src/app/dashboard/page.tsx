"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { DashboardOverviewResponse } from "@/lib/api-client";
import { OverviewStats } from "@/components/overview/OverviewStats";
import { OverviewPendingList } from "@/components/overview/OverviewPendingList";
import { OverviewRecentTraces } from "@/components/overview/OverviewRecentTraces";
import { SystemHealthIndicator } from "@/components/overview/SystemHealthIndicator";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const result = await api.getOverview();
        setData(result);
        setError(null);
      } catch {
        setError("Failed to load dashboard data");
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error && !data) {
    return (
      <div>
        <h1 className="text-lg font-medium text-foreground">
          Dashboard Overview
        </h1>
        <div className="mt-6 rounded-lg border border-border bg-surface-1 p-6">
          <p className="text-sm text-accent-amber">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-lg font-medium text-foreground">
          Dashboard Overview
        </h1>
        <p className="mt-2 text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-foreground">
        Dashboard Overview
      </h1>

      <div className="mt-6">
        <OverviewStats stats={data.stats} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <OverviewPendingList approvals={data.pending_approvals} />
        <OverviewRecentTraces traces={data.recent_traces} />
      </div>

      <div className="mt-6">
        <SystemHealthIndicator health={data.system_health} />
      </div>
    </div>
  );
}
