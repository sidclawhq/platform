'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions';

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
  const { user } = useAuth();
  const { canApprove } = usePermissions();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null);

  if (status !== 'pending') {
    return null;
  }

  if (!canApprove) {
    return (
      <section className="border-t border-border px-6 py-5">
        <p className="text-sm text-text-muted">
          You don&apos;t have permission to approve or deny requests. Contact an admin to change your role.
        </p>
      </section>
    );
  }

  const handleAction = async (action: 'approve' | 'deny') => {
    setLoading(action);
    try {
      const body: { approver_name: string; decision_note?: string } = {
        approver_name: user?.name ?? 'Unknown',
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
          toast.error('You cannot approve this request because you are the agent\'s owner (separation of duties). Ask another team member with the \'reviewer\' or \'admin\' role to approve it.');
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
        data-testid="reviewer-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        rows={3}
        className="mt-3 w-full resize-none rounded border border-border bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          data-testid="approve-button"
          onClick={() => handleAction('approve')}
          disabled={loading !== null}
          className="rounded bg-accent-green/80 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-green disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          type="button"
          data-testid="deny-button"
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
