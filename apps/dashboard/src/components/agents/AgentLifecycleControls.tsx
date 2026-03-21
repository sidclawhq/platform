'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { LifecycleConfirmDialog } from './LifecycleConfirmDialog';

type LifecycleAction = 'suspend' | 'revoke' | 'reactivate';

interface AgentLifecycleControlsProps {
  agentId: string;
  agentName: string;
  lifecycleState: string;
  onLifecycleChange: () => void;
}

export function AgentLifecycleControls({
  agentId,
  agentName,
  lifecycleState,
  onLifecycleChange,
}: AgentLifecycleControlsProps) {
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;
    setLoading(true);
    try {
      if (pendingAction === 'suspend') {
        await api.suspendAgent(agentId);
        toast('Agent suspended');
      } else if (pendingAction === 'revoke') {
        await api.revokeAgent(agentId);
        toast('Agent revoked');
      } else {
        await api.reactivateAgent(agentId);
        toast('Agent reactivated');
      }
      setPendingAction(null);
      onLifecycleChange();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'An error occurred';
      toast(message);
    } finally {
      setLoading(false);
    }
  }, [pendingAction, agentId, onLifecycleChange]);

  if (lifecycleState === 'revoked') {
    return (
      <p className="text-sm text-accent-red">
        This agent has been permanently revoked
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {lifecycleState === 'active' && (
          <>
            <button
              type="button"
              onClick={() => setPendingAction('suspend')}
              className="border border-accent-amber text-accent-amber px-4 py-1.5 rounded text-sm font-medium hover:bg-accent-amber/10 transition-colors"
            >
              Suspend
            </button>
            <button
              type="button"
              onClick={() => setPendingAction('revoke')}
              className="border border-accent-red text-accent-red px-4 py-1.5 rounded text-sm font-medium hover:bg-accent-red/10 transition-colors"
            >
              Revoke
            </button>
          </>
        )}
        {lifecycleState === 'suspended' && (
          <>
            <button
              type="button"
              onClick={() => setPendingAction('reactivate')}
              className="border border-accent-green text-accent-green px-4 py-1.5 rounded text-sm font-medium hover:bg-accent-green/10 transition-colors"
            >
              Reactivate
            </button>
            <button
              type="button"
              onClick={() => setPendingAction('revoke')}
              className="border border-accent-red text-accent-red px-4 py-1.5 rounded text-sm font-medium hover:bg-accent-red/10 transition-colors"
            >
              Revoke
            </button>
          </>
        )}
      </div>

      {pendingAction && (
        <LifecycleConfirmDialog
          open={!!pendingAction}
          action={pendingAction}
          agentName={agentName}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  );
}
