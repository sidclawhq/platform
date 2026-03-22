'use client';

import { AgentActionButton } from './AgentActionButton';

interface ActionState {
  status: 'idle' | 'loading' | 'awaiting' | 'done' | 'blocked';
}

interface AgentRecommendationsProps {
  actionStates: Record<string, ActionState>;
  onAction: (actionId: string) => void;
}

export function AgentRecommendations({ actionStates, onAction }: AgentRecommendationsProps) {
  const getState = (id: string) => actionStates[id] ?? { status: 'idle' };

  return (
    <div className="rounded-lg border border-[#2A2A2E] bg-[#111113] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse" />
        <span className="text-sm font-medium text-[#E4E4E7]">AI Agent Recommendations</span>
      </div>
      <p className="text-sm text-[#A1A1AA] mb-3">
        Agent detected: <span className="text-[#F59E0B]">user-service</span> is under memory pressure.
        v1.8.8 fixes the connection pool leak.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <AgentActionButton
          icon="⚡"
          label="Scale to 6 replicas"
          sublabel="Immediate relief"
          risk="medium"
          loading={getState('scale').status === 'loading'}
          status={getState('scale').status}
          onClick={() => onAction('scale')}
        />
        <AgentActionButton
          icon="🚀"
          label="Deploy v1.8.8 to prod"
          sublabel="Permanent fix"
          risk="high"
          loading={getState('deploy-prod').status === 'loading'}
          status={getState('deploy-prod').status}
          onClick={() => onAction('deploy-prod')}
        />
      </div>
      <div className="mt-2">
        <AgentActionButton
          icon="📋"
          label="Deploy v1.8.8 to staging first"
          sublabel="Validate fix before production"
          risk="medium"
          loading={getState('deploy-staging').status === 'loading'}
          status={getState('deploy-staging').status}
          onClick={() => onAction('deploy-staging')}
        />
      </div>
    </div>
  );
}
