"use client";

import { ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { TopNav } from "./TopNav";
import { AppProvider, useAppContext } from "@/lib/state";

function AppShellInner({ children }: { children: ReactNode }) {
  const { resetScenarios } = useAppContext();

  const handleReset = () => {
    resetScenarios();
    toast("Simulation state reset");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white/80">
      <TopNav onReset={handleReset} />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1a1a24",
            color: "#e0e0e6",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: "13px",
          },
        }}
      />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <AppShellInner>{children}</AppShellInner>
    </AppProvider>
  );
}
