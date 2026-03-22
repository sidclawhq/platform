'use client';

import { useEffect, useRef } from 'react';
import { PolicyEditorForm } from './PolicyEditorForm';
import type { AgentSummary, PolicyListItem } from '@/lib/api-client';

interface PolicyEditorModalProps {
  isOpen: boolean;
  policy?: PolicyListItem;
  agents: AgentSummary[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export function PolicyEditorModal({
  isOpen,
  policy,
  agents,
  onSubmit,
  onClose,
}: PolicyEditorModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      data-testid="policy-editor"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh] overflow-y-auto"
    >
      <div className="bg-surface-0 border border-border rounded-lg p-6 w-full max-w-[640px] mb-10">
        <h2 className="text-base font-medium text-foreground mb-5">
          {policy ? 'Edit Policy' : 'Create Policy'}
        </h2>
        <PolicyEditorForm
          agents={agents}
          initialData={policy}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
