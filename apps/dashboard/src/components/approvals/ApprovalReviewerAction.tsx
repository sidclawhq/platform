'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';

interface ApprovalReviewerActionProps {
  approvalId: string;
  status: string;
  onComplete: () => void;
}

export function ApprovalReviewerAction({
  approvalId,
  status,
  onComplete,
}: ApprovalReviewerActionProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null);

  if (status !== 'pending') {
    return null;
  }

  const handleAction = async (action: 'approve' | 'deny') => {
    setLoading(action);
    try {
      const body: { approver_name: string; decision_note?: string } = {
        // TODO(P3.4): Use actual authenticated user name
        approver_name: 'Dashboard User',
      };
      if (note.trim()) {
        body.decision_note = note.trim();
      }

      if (action === 'approve') {
        await api.approveRequest(approvalId, body);
        toast.success('Approved');
      } else {
        await api.denyRequest(approvalId, body);
        toast.success('Denied');
      }

      onComplete();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error('This approval has already been decided');
          onComplete();
        } else if (err.status === 403) {
          toast.error('Agent owner cannot self-approve');
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="border-t border-border px-6 py-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
        Reviewer Action
      </h3>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        rows={3}
        className="mt-3 w-full resize-none rounded border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => handleAction('approve')}
          disabled={loading !== null}
          className="rounded bg-accent-green/80 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => handleAction('deny')}
          disabled={loading !== null}
          className="rounded bg-accent-red/80 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-red disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'deny' ? 'Denying...' : 'Deny'}
        </button>
      </div>
    </section>
  );
}
