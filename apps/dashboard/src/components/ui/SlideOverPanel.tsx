'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  'data-testid'?: string;
}

export function SlideOverPanel({ isOpen, onClose, title, children, 'data-testid': dataTestId }: SlideOverPanelProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div data-testid={dataTestId} className="fixed inset-y-0 right-0 z-50 w-[560px] border-l border-border bg-surface-0 shadow-xl transition-transform duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 57px)' }}>
          {children}
        </div>
      </div>
    </>
  );
}
