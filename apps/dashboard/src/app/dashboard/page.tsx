"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export default function DashboardPage() {
  const [apiStatus, setApiStatus] = useState<{
    connected: boolean;
    version?: string;
  } | null>(null);

  useEffect(() => {
    api.healthCheck().then((result) => {
      if (result) {
        setApiStatus({ connected: true, version: result.version });
      } else {
        setApiStatus({ connected: false });
      }
    });
  }, []);

  return (
    <div>
      <h1 className="text-lg font-medium text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Agent Identity & Approval Layer
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface-1 p-6">
        <p className="text-sm text-text-muted">Dashboard shell is running</p>

        <div className="mt-4">
          {apiStatus === null ? (
            <p className="text-sm text-text-muted">
              Checking API connection...
            </p>
          ) : apiStatus.connected ? (
            <p className="text-sm text-accent-green">
              API connected — v{apiStatus.version}
            </p>
          ) : (
            <p className="text-sm text-accent-amber">API not connected</p>
          )}
        </div>
      </div>
    </div>
  );
}
