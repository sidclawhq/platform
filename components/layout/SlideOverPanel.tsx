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
  width = "w-[45vw]",
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
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 bg-[#0f0f14] border-l border-white/[0.06] overflow-y-auto transform transition-transform duration-300 ease-in-out ${width} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {children}
      </div>
    </>
  );
}
