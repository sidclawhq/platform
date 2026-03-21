'use client';

import type { AgentDetail } from '@/lib/api-client';
import { AgentLifecycleBadge } from './AgentLifecycleBadge';
import { AgentLifecycleControls } from './AgentLifecycleControls';

interface AgentDetailHeaderProps {
  agent: AgentDetail;
  onLifecycleChange: () => void;
}

export function AgentDetailHeader({ agent, onLifecycleChange }: AgentDetailHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium text-foreground">{agent.name}</h1>
          <AgentLifecycleBadge state={agent.lifecycle_state} />
        </div>
        <p className="mt-1 text-sm text-text-secondary">{agent.description}</p>
      </div>
      <AgentLifecycleControls
        agentId={agent.id}
        agentName={agent.name}
        lifecycleState={agent.lifecycle_state}
        onLifecycleChange={onLifecycleChange}
      />
    </div>
  );
}
