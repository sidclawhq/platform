"use client";

import React, { useEffect, ReactNode } from "react";

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  width?: string;
  children: ReactNode;
}

export default function SlideOverPanel({
  isOpen,
  onClose,
  width = "w-full max-w-[520px]",
  children,
}: SlideOverPanelProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full overflow-y-auto border-l border-border bg-surface-1 shadow-2xl transform transition-transform duration-300 ease-in-out ${width} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {children}
      </div>
    </>
  );
}
