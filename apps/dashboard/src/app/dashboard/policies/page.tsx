'use client';

import { Suspense } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import type { AgentSummary, PolicyListItem } from '@/lib/api-client';
import { PolicyFilters } from '@/components/policies/PolicyFilters';
import type { PolicyFilterValues } from '@/components/policies/PolicyFilters';
import { PolicyList } from '@/components/policies/PolicyList';
import { PolicyEditorModal } from '@/components/policies/PolicyEditorModal';
import { PolicyTestModal } from '@/components/policies/PolicyTestModal';
import { PolicyVersionHistory } from '@/components/policies/PolicyVersionHistory';
import { usePermissions } from '@/lib/permissions';

function PoliciesContent() {
  const searchParams = useSearchParams();
  const urlAgentId = searchParams.get('agent_id') ?? '';

  const { canManagePolicies } = usePermissions();
  const [policies, setPolicies] = useState<PolicyListItem[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PolicyFilterValues>({
    agent_id: urlAgentId,
    effect: '',
    data_classification: '',
    search: '',
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyListItem | undefined>();

  // Test modal state
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testInitialValues, setTestInitialValues] = useState<{
    agent_id?: string;
    operation?: string;
    target_integration?: string;
    resource_scope?: string;
    data_classification?: string;
  } | undefined>();

  // Version history state
  const [historyPolicyId, setHistoryPolicyId] = useState<string | null>(null);
  const [historyPolicyName, setHistoryPolicyName] = useState('');
  const [historyCurrentVersion, setHistoryCurrentVersion] = useState(1);

  // Fetch agents once
  useEffect(() => {
    api.listAgents({ limit: 100 }).then((res) => setAgents(res.data)).catch(() => {});
  }, []);

  // Fetch policies whenever filters change
  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listPolicies({
        agent_id: filters.agent_id || undefined,
        effect: filters.effect || undefined,
        data_classification: filters.data_classification || undefined,
        search: filters.search || undefined,
        limit: 100,
      });
      setPolicies(result.data);
    } catch {
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // Handlers
  const handleEdit = (policy: PolicyListItem) => {
    setEditingPolicy(policy);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingPolicy(undefined);
    setModalOpen(true);
  };

  const handleDeactivate = async (policy: PolicyListItem) => {
    try {
      await api.deletePolicy(policy.id);
      toast.success(`Policy "${policy.policy_name}" deactivated`);
      fetchPolicies();
    } catch {
      toast.error('Failed to deactivate policy');
    }
  };

  const handleModalSubmit = async (data: Record<string, unknown>) => {
    if (editingPolicy) {
      await api.updatePolicy(editingPolicy.id, data);
      toast.success('Policy updated');
    } else {
      await api.createPolicy(data);
      toast.success('Policy created');
    }
    setModalOpen(false);
    setEditingPolicy(undefined);
    fetchPolicies();
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingPolicy(undefined);
  };

  // Test modal handlers
  const handleTestFromHeader = () => {
    setTestInitialValues(undefined);
    setTestModalOpen(true);
  };

  const handleTestFromCard = (policy: PolicyListItem) => {
    setTestInitialValues({
      agent_id: policy.agent_id,
      operation: policy.operation,
      target_integration: policy.target_integration,
      resource_scope: policy.resource_scope,
      data_classification: policy.data_classification,
    });
    setTestModalOpen(true);
  };

  const handleTestModalClose = () => {
    setTestModalOpen(false);
    setTestInitialValues(undefined);
  };

  // Version history handlers
  const handleHistory = (policy: PolicyListItem) => {
    setHistoryPolicyId(policy.id);
    setHistoryPolicyName(policy.policy_name);
    setHistoryCurrentVersion(policy.policy_version);
  };

  const handleHistoryClose = () => {
    setHistoryPolicyId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">Policies</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Define rules that govern agent operations across integrations and data classifications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PolicyFilters
            filters={filters}
            onFilterChange={setFilters}
            agents={agents}
          />
          <button
            type="button"
            onClick={handleTestFromHeader}
            className="h-8 rounded border border-border bg-surface-1 px-4 text-xs font-medium text-foreground hover:bg-surface-2 transition-colors"
          >
            Test Policy
          </button>
          {canManagePolicies && (
            <button
              type="button"
              data-testid="create-policy"
              onClick={handleCreate}
              className="h-8 rounded bg-accent-blue px-4 text-xs font-medium text-white hover:bg-accent-blue/90 transition-colors"
            >
              Create Policy
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <PolicyList
          policies={policies}
          loading={loading}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onTest={handleTestFromCard}
          onHistory={handleHistory}
        />
      </div>

      <PolicyEditorModal
        isOpen={modalOpen}
        policy={editingPolicy}
        agents={agents}
        onSubmit={handleModalSubmit}
        onClose={handleModalClose}
      />

      <PolicyTestModal
        isOpen={testModalOpen}
        agents={agents}
        initialValues={testInitialValues}
        onClose={handleTestModalClose}
      />

      <PolicyVersionHistory
        policyId={historyPolicyId}
        policyName={historyPolicyName}
        currentVersion={historyCurrentVersion}
        onClose={handleHistoryClose}
      />
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense>
      <PoliciesContent />
    </Suspense>
  );
}
