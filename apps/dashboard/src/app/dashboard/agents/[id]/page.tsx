'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { AgentDetail } from '@/lib/api-client';
import { AgentDetailHeader } from '@/components/agents/AgentDetailHeader';
import { AgentOverviewSection } from '@/components/agents/AgentOverviewSection';
import { AgentAuthoritySection } from '@/components/agents/AgentAuthoritySection';
import { AgentIntegrationsTable } from '@/components/agents/AgentIntegrationsTable';
import { AddIntegrationModal } from '@/components/agents/AddIntegrationModal';
import { AgentPolicySummary } from '@/components/agents/AgentPolicySummary';
import { AgentRecentActivity } from '@/components/agents/AgentRecentActivity';

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddIntegration, setShowAddIntegration] = useState(false);

  const fetchAgent = useCallback(async () => {
    try {
      const result = await api.getAgent(id);
      setAgent(result.data);
      setError(null);
    } catch {
      setError('Failed to load agent details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  const handleLifecycleChange = () => {
    fetchAgent();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-text-muted">{error ?? 'Agent not found'}</p>
        <Link
          href="/dashboard/agents"
          className="mt-2 text-sm text-foreground underline underline-offset-2"
        >
          Return to registry
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-text-muted">
        <Link
          href="/dashboard/agents"
          className="hover:text-foreground transition-colors"
        >
          Agents
        </Link>
        <ChevronRight size={14} />
        <span className="text-foreground">{agent.name}</span>
      </nav>

      {/* Header */}
      <AgentDetailHeader agent={agent} onLifecycleChange={handleLifecycleChange} />

      {/* Two-column grid: Overview + Authority */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AgentOverviewSection agent={agent} />
        <AgentAuthoritySection agent={agent} />
      </div>

      {/* Integrations table */}
      <div className="mt-6">
        <AgentIntegrationsTable
          integrations={agent.authorized_integrations}
          onAdd={() => setShowAddIntegration(true)}
        />
      </div>

      {showAddIntegration && (
        <AddIntegrationModal
          agentId={agent.id}
          existing={agent.authorized_integrations}
          onClose={() => setShowAddIntegration(false)}
          onAdded={() => { setShowAddIntegration(false); fetchAgent(); }}
        />
      )}

      {/* Policy summary + Recent activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AgentPolicySummary agentId={agent.id} policyCount={agent.stats.policy_count} />
        <AgentRecentActivity agent={agent} />
      </div>
    </div>
  );
}
