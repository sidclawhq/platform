"use client";

import { ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { TopNav } from "./TopNav";
import { AppProvider, useAppContext } from "@/lib/state";

function AppShellInner({ children }: { children: ReactNode }) {
  const { resetScenarios } = useAppContext();

  const handleReset = () => {
    resetScenarios();
    toast("Simulation state reset", {
      description: "All scenarios restored to initial state.",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav onReset={handleReset} />
      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#141821",
            color: "#d8dde8",
            border: "1px solid #232a38",
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
