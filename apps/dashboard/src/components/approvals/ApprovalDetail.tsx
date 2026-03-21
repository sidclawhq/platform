'use client';

import { useEffect, useState } from 'react';
import { SlideOverPanel } from '@/components/ui/SlideOverPanel';
import { ApprovalDetailSections } from './ApprovalDetailSections';
import { ApprovalReviewerAction } from './ApprovalReviewerAction';
import { api } from '@/lib/api-client';
import type { ApprovalDetailResponse } from '@/lib/api-client';

interface ApprovalDetailProps {
  approvalId: string | null;
  onClose: () => void;
  onActionComplete: () => void;
}

export function ApprovalDetail({
  approvalId,
  onClose,
  onActionComplete,
}: ApprovalDetailProps) {
  const [data, setData] = useState<ApprovalDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!approvalId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    api
      .getApproval(approvalId)
      .then((result) => {
        setData(result);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load approval');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [approvalId]);

  const handleComplete = () => {
    onClose();
    onActionComplete();
  };

  return (
    <SlideOverPanel
      isOpen={approvalId !== null}
      onClose={onClose}
      title="Approval Detail"
    >
      {loading && (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-text-muted">Loading approval details...</p>
        </div>
      )}

      {error && (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-accent-red">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          <ApprovalDetailSections data={data} />
          <ApprovalReviewerAction
            approvalId={data.id}
            status={data.status}
            onComplete={handleComplete}
          />
        </>
      )}
    </SlideOverPanel>
  );
}
